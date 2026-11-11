import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  canExplore,
  canBuildAndHost,
  getBillingStatus,
  startTrial,
  applySubscription,
  cancelSubscription,
  TRIAL_DURATION_DAYS,
  PLANS,
} from '../src/core/billing.js'
import {
  calculateTier,
  claimMissionReward,
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
    assert.ok(!text.includes('kill') && !text.includes('blood') && !text.includes('gore') && !text.includes('murder'),
      `Mission ${m.id} must be family safe and non-violent`)
  }

  // Claiming a mission
  const initialProgression = {
    xp: 0,
    tier: 1,
    unlockedCosmetics: ['badge_initiate'],
    missionProgress: {},
  }

  const result1 = claimMissionReward(initialProgression, 'daily_explore')
  assert.ok(result1.success)
  assert.equal(result1.xpAdded, 100)
  assert.equal(result1.progression.xp, 100)
  assert.ok(result1.progression.missionProgress['daily_explore'].claimed)

  // Double claim prevention
  const resultDuplicate = claimMissionReward(result1.progression, 'daily_explore')
  assert.equal(resultDuplicate.success, false, 'Should reject duplicate claim')

  // Claiming a weekly mission that unlocks a cosmetic
  const resultWeekly = claimMissionReward(result1.progression, 'weekly_overdrive')
  assert.ok(resultWeekly.success)
  assert.ok(resultWeekly.progression.unlockedCosmetics.includes('badge_overdrive'))
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
  db.prepare(`
    INSERT INTO users (id, name, plan, xp, tier, unlockedCosmetics, storylineSeen)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('user_test', 'CyberPilot', 'trial', 350, 1, JSON.stringify(['badge_initiate', 'skin_neon_grid']), 1)

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
