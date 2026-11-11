import { readJWT } from '../core/utils-server'
import {
  getBillingStatus,
  startUserTrial,
  upgradeUserPlan,
  canUserBuild,
  BillingPlans,
  SubscriptionStatuses,
} from '../core/billing'
import {
  getProgressionStatus,
  calculateTier,
  MISSIONS,
  COSMETIC_ITEMS,
  STORYLINE,
} from '../core/progression'

export async function registerMonetizationRoutes(fastify, { db, world }) {
  // Helper to extract authenticated user
  async function getUser(req) {
    let token =
      req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
      req.query?.authToken ||
      req.body?.authToken
    if (!token) return null
    const payload = await readJWT(token)
    if (!payload?.userId) return null
    return await db('users').where('id', payload.userId).first()
  }

  // Storyline & lore narrative
  fastify.get('/api/storyline', { config: { rateLimit: { max: 100, timeWindow: '1 minute' } } }, async (req, reply) => {
    return {
      success: true,
      storyline: STORYLINE,
    }
  })

  // Billing status
  fastify.get('/api/billing/status', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const user = await getUser(req)
    if (!user) {
      return {
        success: true,
        authenticated: false,
        plans: {
          free: {
            name: 'Free Explorer',
            price: 0,
            description: 'Permanent unrestricted exploration of public/demo worlds',
          },
          trial: {
            name: 'Architect Trial',
            durationDays: 14,
            description: '14-day full builder mode and world hosting clearance',
          },
          pro: {
            name: 'Architect Pro',
            price: 15,
            period: 'monthly',
            description: 'Unlimited persistent sector hosting, builder tools, priority allocation',
          },
        },
      }
    }
    return {
      success: true,
      authenticated: true,
      billing: getBillingStatus(user),
    }
  })

  // Start 14-day trial
  fastify.post('/api/billing/start-trial', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const user = await getUser(req)
    if (!user) return reply.code(401).send({ error: 'Unauthorized' })
    if (user.trialStartedAt) {
      return reply.code(400).send({ error: 'Trial already activated', billing: getBillingStatus(user) })
    }
    const trial = startUserTrial(user)
    await db('users').where('id', user.id).update(trial)
    Object.assign(user, trial)
    return {
      success: true,
      billing: getBillingStatus(user),
    }
  })

  // Upgrade to paid plan
  fastify.post('/api/billing/upgrade', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const user = await getUser(req)
    if (!user) return reply.code(401).send({ error: 'Unauthorized' })
    const planName = req.body?.plan || 'architect_pro'
    const upgrade = upgradeUserPlan(user, planName)
    await db('users').where('id', user.id).update(upgrade)
    Object.assign(user, upgrade)
    return {
      success: true,
      billing: getBillingStatus(user),
    }
  })

  // Payment webhook endpoint
  fastify.post('/api/billing/webhook', { config: { rateLimit: { max: 100, timeWindow: '1 minute' } } }, async (req, reply) => {
    const event = req.body || {}
    const { type, data } = event
    if (data?.object?.userId) {
      const userId = data.object.userId
      if (
        type === 'payment_intent.succeeded' ||
        type === 'invoice.paid' ||
        type === 'checkout.session.completed'
      ) {
        const upgrade = upgradeUserPlan({}, 'architect_pro')
        await db('users').where('id', userId).update(upgrade)
      }
    }
    return { received: true }
  })

  // Progression status
  fastify.get('/api/progression', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const user = await getUser(req)
    if (!user) {
      return {
        success: true,
        authenticated: false,
        progression: getProgressionStatus({}),
        cosmetics: COSMETIC_ITEMS,
        missions: MISSIONS,
      }
    }
    return {
      success: true,
      authenticated: true,
      progression: getProgressionStatus(user),
      cosmetics: COSMETIC_ITEMS,
      missions: MISSIONS,
    }
  })

  // Claim mission
  fastify.post('/api/progression/claim', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const user = await getUser(req)
    if (!user) return reply.code(401).send({ error: 'Unauthorized' })
    const { missionId } = req.body || {}
    const mission = MISSIONS.find(m => m.id === missionId)
    if (!mission) return reply.code(404).send({ error: 'Mission not found' })

    let missionProgress = {}
    try {
      missionProgress =
        typeof user.missionProgress === 'string'
          ? JSON.parse(user.missionProgress)
          : user.missionProgress || {}
    } catch {
      missionProgress = {}
    }

    const currentProg = missionProgress[missionId] || { progress: 0, completed: false, claimed: false }
    if (currentProg.claimed) {
      return reply.code(400).send({ error: 'Mission already claimed' })
    }

    missionProgress[missionId] = {
      progress: Math.max(currentProg.progress, mission.target),
      completed: true,
      claimed: true,
      claimedAt: new Date().toISOString(),
    }

    const newXp = (user.xp || 0) + mission.xp
    user.xp = newXp
    const tierInfo = calculateTier(newXp)
    user.tier = tierInfo.tier

    let unlocked = []
    try {
      unlocked =
        typeof user.unlockedCosmetics === 'string'
          ? JSON.parse(user.unlockedCosmetics)
          : user.unlockedCosmetics || []
    } catch {
      unlocked = []
    }

    if (mission.rewardItem && !unlocked.includes(mission.rewardItem)) {
      unlocked.push(mission.rewardItem)
    }
    if (tierInfo.rewardId && !unlocked.includes(tierInfo.rewardId)) {
      unlocked.push(tierInfo.rewardId)
    }

    user.unlockedCosmetics = JSON.stringify(unlocked)
    user.missionProgress = JSON.stringify(missionProgress)

    await db('users').where('id', user.id).update({
      xp: user.xp,
      tier: user.tier,
      unlockedCosmetics: user.unlockedCosmetics,
      missionProgress: user.missionProgress,
    })

    return {
      success: true,
      progression: getProgressionStatus(user),
      claimedMission: mission,
    }
  })

  // Equip cosmetic
  fastify.post('/api/progression/equip', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const user = await getUser(req)
    if (!user) return reply.code(401).send({ error: 'Unauthorized' })
    const { cosmeticId } = req.body || {}
    const item = COSMETIC_ITEMS.find(c => c.id === cosmeticId)
    if (!item) return reply.code(404).send({ error: 'Cosmetic item not found' })

    let unlocked = []
    try {
      unlocked =
        typeof user.unlockedCosmetics === 'string'
          ? JSON.parse(user.unlockedCosmetics)
          : user.unlockedCosmetics || []
    } catch {
      unlocked = []
    }

    if (!unlocked.includes(cosmeticId)) {
      return reply.code(403).send({ error: 'Cosmetic locked. Grind missions or advance tiers to unlock.' })
    }

    if (item.type === 'skin' && item.avatarUrl) {
      await db('users').where('id', user.id).update({ avatar: item.avatarUrl })
      user.avatar = item.avatarUrl
    }

    return {
      success: true,
      equipped: item,
      avatar: user.avatar,
    }
  })
}
