import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  canExplore,
  canBuildAndHost,
  getBillingStatus,
  isBillingEnabled,
  mapStripeSubscription,
  startTrial,
  applySubscription,
  cancelSubscription,
  TRIAL_DURATION_DAYS,
  PLANS,
} from '../src/core/billing.js'
import {
  calculateTier,
  claimMission,
  claimMissionReward,
  equipCosmetic,
  getProgressionStatus,
  normalizeMissionProgress,
  recordMissionActivity,
  MissionActivities,
  MISSIONS,
  COSMETIC_ITEMS,
  STORYLINE,
  TIER_THRESHOLDS,
} from '../src/core/progression.js'
import { packets } from '../src/core/packets.js'

test('Billing & Entitlements: Explorer and Trial Access', () => {
  // Free user
  const freeUser = {
    plan: 'free',
    subscriptionStatus: null,
    trialStartedAt: null,
    trialEndsAt: null,
  }

  assert.equal(canExplore(freeUser), true, 'Free user should always be able to explore')
  assert.equal(canBuildAndHost(freeUser), false, 'Free user cannot host/build without trial or subscription')

  const statusBefore = getBillingStatus(freeUser)
  assert.equal(statusBefore.plan, 'free')
  assert.equal(statusBefore.isTrialActive, false)
  assert.equal(statusBefore.isTrialExpired, false)

  // Start trial
  const trialingUser = startTrial(freeUser)
  assert.ok(trialingUser.trialStartedAt)
  assert.ok(trialingUser.trialEndsAt)
  assert.equal(canExplore(trialingUser), true)
  assert.equal(canBuildAndHost(trialingUser), true, 'Active trial allows building and hosting')

  const statusDuring = getBillingStatus(trialingUser)
  assert.equal(statusDuring.isTrialActive, true)
  assert.equal(statusDuring.isTrialExpired, false)
  assert.equal(statusDuring.trialDaysRemaining, TRIAL_DURATION_DAYS)

  // Expired trial
  const expiredTrialUser = {
    plan: 'free',
    trialStartedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    trialEndsAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    subscriptionStatus: null,
  }
  assert.equal(canExplore(expiredTrialUser), true, 'Expired trial user can still explore freely')
  assert.equal(canBuildAndHost(expiredTrialUser), false, 'Expired trial user cannot build or host')

  const statusExpired = getBillingStatus(expiredTrialUser)
  assert.equal(statusExpired.isTrialActive, false)
  assert.equal(statusExpired.isTrialExpired, true)
})

test('Billing & Entitlements: Paid Subscriptions', () => {
  const user = { plan: 'free' }
  const upgraded = applySubscription(user, PLANS.PRO.id, 'sub_12345')

  assert.equal(upgraded.plan, 'paid')
  assert.equal(upgraded.subscriptionPlan, 'pro')
  assert.equal(upgraded.subscriptionStatus, 'active')
  assert.equal(upgraded.subscriptionId, 'sub_12345')
  assert.equal(canExplore(upgraded), true)
  assert.equal(canBuildAndHost(upgraded), true, 'Active paid subscriber can build and host')

  const statusPaid = getBillingStatus(upgraded)
  assert.equal(statusPaid.isPaid, true)
  assert.equal(statusPaid.plan, 'paid')

  const canceled = cancelSubscription(upgraded)
  assert.equal(canceled.subscriptionStatus, 'canceled')
})

test('Progression & XP Curve', () => {
  const tier0 = calculateTier(0)
  assert.equal(tier0.tier, 1)
  assert.equal(tier0.title, 'Cadet Operative')
  assert.equal(tier0.progressToNext, 0)

  const tier1 = calculateTier(200)
  assert.equal(tier1.tier, 2)
  assert.equal(tier1.title, 'Grid Specialist')

  const tierApex = calculateTier(2500)
  assert.equal(tierApex.tier, 6)
  assert.equal(tierApex.title, 'Apex Overdrive')
  assert.equal(tierApex.progressToNext, 1)
})

test('Progression Missions & Family-Safe Grinding', () => {
  assert.ok(MISSIONS.length >= 4, 'Should have multiple daily and weekly missions')
  for (const m of MISSIONS) {
    assert.ok(m.id)
    assert.ok(m.title)
    assert.ok(m.desc)
    assert.ok(m.xp > 0)
    // Non-violent check: mission descriptions should not contain violence keywords
    const text = (m.title + ' ' + m.desc).toLowerCase()
    assert.ok(
      !text.includes('kill') && !text.includes('blood') && !text.includes('gore') && !text.includes('murder'),
      `Mission ${m.id} must be family safe and non-violent`
    )
  }

  // every mission is driven by a server-tracked activity
  for (const m of MISSIONS) {
    assert.ok(Object.values(MissionActivities).includes(m.activity), `Mission ${m.id} must declare a tracked activity`)
    assert.ok(m.target >= 1)
  }
})

test('Mission claims require server-recorded completion', () => {
  const now = new Date('2026-10-28T12:00:00Z')
  const user = { xp: 0, tier: 1, unlockedCosmetics: ['badge_initiate'], missionProgress: {} }

  // nothing done yet: claim rejected, no XP
  const early = claimMission(user, 'daily_explore', now)
  assert.equal(early.success, false)
  assert.equal(early.reason, 'Mission not completed yet')

  // forged progress from an old cycle (or the old exploit) is not trusted
  const forged = { ...user, missionProgress: { daily_explore: { progress: 150, completed: true, claimed: false } } }
  assert.equal(claimMission(forged, 'daily_explore', now).success, false)

  // partial progress
  let step = recordMissionActivity(user.missionProgress, MissionActivities.DISTANCE, 100, now)
  assert.equal(step.changed, true)
  assert.equal(step.completedNow.length, 0)
  assert.equal(claimMission({ ...user, missionProgress: step.missionProgress }, 'daily_explore', now).success, false)

  // completes at the target
  step = recordMissionActivity(step.missionProgress, MissionActivities.DISTANCE, 60, now)
  assert.deepEqual(
    step.completedNow.map(m => m.id),
    ['daily_explore']
  )
  assert.equal(step.missionProgress.daily_explore.progress, 150)

  const claimed = claimMission({ ...user, missionProgress: step.missionProgress }, 'daily_explore', now)
  assert.ok(claimed.success)
  assert.equal(claimed.xpAdded, 100)
  assert.equal(claimed.updates.xp, 100)
  assert.ok(claimed.updates.missionProgress.daily_explore.claimed)

  // double claim rejected
  const again = claimMission({ ...user, ...claimed.updates }, 'daily_explore', now)
  assert.equal(again.success, false)

  // the claim counts toward the weekly overdrive mission
  assert.equal(claimed.updates.missionProgress.weekly_overdrive.progress, 1)

  // backwards-compatible wrapper behaves the same
  assert.equal(claimMissionReward(user, 'daily_explore', now).success, false)
})

test('Missions reset on UTC daily / weekly cycles', () => {
  const monday = new Date('2026-10-26T10:00:00Z')
  const tuesday = new Date('2026-10-27T10:00:00Z')
  const nextMonday = new Date('2026-11-02T00:00:01Z')
  let progress = recordMissionActivity({}, MissionActivities.CHAT, 1, monday).missionProgress
  progress = recordMissionActivity(progress, MissionActivities.SPRINT_JUMP, 10, monday).missionProgress
  const user = { xp: 0, missionProgress: progress }
  const claimedDaily = claimMission(user, 'daily_chat', monday)
  assert.ok(claimedDaily.success)

  // next day: daily resets, weekly keeps its progress
  const tue = normalizeMissionProgress(claimedDaily.updates.missionProgress, tuesday)
  assert.equal(tue.daily_chat.claimed, false)
  assert.equal(tue.daily_chat.progress, 0)
  assert.equal(tue.weekly_velocity.completed, true)

  // next week: weekly resets too
  const next = normalizeMissionProgress(claimedDaily.updates.missionProgress, nextMonday)
  assert.equal(next.weekly_velocity.completed, false)
  assert.equal(next.weekly_overdrive.progress, 0)
})

test('Tier jumps unlock every reached tier reward', () => {
  const now = new Date('2026-10-28T12:00:00Z')
  const progress = recordMissionActivity({}, MissionActivities.BUILD, 1, now).missionProgress
  const result = claimMission({ xp: 450, missionProgress: progress }, 'weekly_architect', now)
  assert.ok(result.success)
  assert.equal(result.updates.xp, 850)
  for (const id of ['badge_initiate', 'item_quantum_visor', 'skin_neon_vanguard', 'skin_neon_surge']) {
    assert.ok(result.updates.unlockedCosmetics.includes(id), `expected ${id} unlocked`)
  }
  assert.equal(result.tieredUp, true)
})

test('Cosmetic equipping', () => {
  const user = { unlockedCosmetics: ['badge_initiate', 'skin_neon_surge'] }
  assert.equal(equipCosmetic(user, 'badge_initiate').success, false, 'badges are collectibles, not equippable')
  assert.equal(equipCosmetic(user, 'skin_solar_flare').code, 403, 'locked skins cannot be equipped')
  const ok = equipCosmetic(user, 'skin_neon_surge')
  assert.ok(ok.success)
  assert.equal(ok.updates.equippedCosmetics.skin, 'skin_neon_surge')
  assert.deepEqual(getProgressionStatus({ ...user, ...ok.updates }).equippedCosmetics, { skin: 'skin_neon_surge' })
})

test('Billing switch and Stripe status mapping', () => {
  assert.equal(isBillingEnabled({}), false)
  assert.equal(isBillingEnabled({ BILLING_ENABLED: 'true' }), true)
  const free = { plan: 'free' }
  assert.equal(getBillingStatus(free, { enabled: false }).canBuildAndHost, true, 'billing off never blocks')
  assert.equal(getBillingStatus(free, { enabled: false }).enabled, false)
  assert.equal(getBillingStatus(free).canBuildAndHost, false)

  const active = mapStripeSubscription({
    id: 'sub_1',
    status: 'active',
    customer: 'cus_1',
    current_period_end: 1800000000,
  })
  assert.equal(active.subscriptionStatus, 'active')
  assert.equal(active.stripeCustomerId, 'cus_1')
  assert.equal(getBillingStatus(active).isPaid, true)
  for (const [status, expected] of [
    ['past_due', 'past_due'],
    ['unpaid', 'past_due'],
    ['canceled', 'canceled'],
    ['incomplete', 'inactive'],
  ]) {
    const fields = mapStripeSubscription({ id: 'sub_1', status, customer: 'cus_1' })
    assert.equal(fields.subscriptionStatus, expected)
    assert.equal(getBillingStatus(fields).isPaid, false, `${status} must not grant Pro`)
  }
})

test('Cosmetics & Badges System', () => {
  assert.ok(COSMETIC_ITEMS.length >= 5)
  for (const item of COSMETIC_ITEMS) {
    assert.ok(item.id)
    assert.ok(item.name)
    assert.ok(item.type)
    assert.ok(item.rarity)
    assert.ok(item.color)
  }
})

test('Storyline Introduction & Lore Narrative', () => {
  assert.ok(STORYLINE.title)
  assert.ok(STORYLINE.tagline)
  assert.ok(STORYLINE.intro)
  assert.ok(STORYLINE.chapters.length >= 3)

  // Storyline explains what the game is about
  assert.ok(STORYLINE.intro.toLowerCase().includes('hyperfy'))
  assert.ok(STORYLINE.intro.toLowerCase().includes('worlds') || STORYLINE.intro.toLowerCase().includes('metaverse'))
})

test('Network Packets Definition', () => {
  assert.ok(packets.includes('billingStatus'))
  assert.ok(packets.includes('billingBlocked'))
  assert.ok(packets.includes('billingUpgrade'))
  assert.ok(packets.includes('progressionUpdate'))
  assert.ok(packets.includes('claimMission'))
  assert.ok(packets.includes('equipCosmetic'))
  assert.ok(packets.includes('startTrial'))
})

test('Database Migration 19 Integrity', () => {
  // Test SQLite schema migration directly on an in-memory SQLite database
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT,
      account TEXT,
      avatar TEXT,
      admin INTEGER,
      builder INTEGER,
      createdAt TEXT
    );
  `)

  // Apply migration 19 additions
  db.exec(`
    ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free';
    ALTER TABLE users ADD COLUMN trialStartedAt TEXT;
    ALTER TABLE users ADD COLUMN trialEndsAt TEXT;
    ALTER TABLE users ADD COLUMN subscriptionStatus TEXT;
    ALTER TABLE users ADD COLUMN subscriptionPlan TEXT;
    ALTER TABLE users ADD COLUMN subscriptionId TEXT;
    ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN tier INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN unlockedCosmetics TEXT;
    ALTER TABLE users ADD COLUMN missionProgress TEXT;
    ALTER TABLE users ADD COLUMN storylineSeen INTEGER DEFAULT 0;
  `)

  // Insert a test user
  db.prepare(
    `
    INSERT INTO users (id, name, plan, xp, tier, unlockedCosmetics, storylineSeen)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run('user_test', 'CyberPilot', 'trial', 350, 1, JSON.stringify(['badge_initiate', 'skin_neon_grid']), 1)

  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get('user_test')
  assert.equal(row.id, 'user_test')
  assert.equal(row.name, 'CyberPilot')
  assert.equal(row.plan, 'trial')
  assert.equal(row.xp, 350)
  assert.equal(row.tier, 1)
  assert.deepEqual(JSON.parse(row.unlockedCosmetics), ['badge_initiate', 'skin_neon_grid'])
  assert.equal(row.storylineSeen, 1)

  db.close()
})
