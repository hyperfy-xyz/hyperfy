import { readJWT } from '../core/utils-server'
import { getBillingStatus, isBillingEnabled, startUserTrial, TRIAL_DURATION_DAYS } from '../core/billing'
import {
  getProgressionStatus,
  claimMission,
  equipCosmetic,
  MISSIONS,
  COSMETIC_ITEMS,
  STORYLINE,
} from '../core/progression'
import { createStripeBilling, BillingError } from './stripe'

const PUBLIC_PLANS = {
  free: {
    name: 'Free Explorer',
    price: 0,
    description: 'Explore the Grid, chat, complete missions and unlock cosmetics. Free forever.',
  },
  trial: {
    name: 'Architect Trial',
    durationDays: TRIAL_DURATION_DAYS,
    description: '14 days of builder access: place, move and script apps in the world.',
  },
  pro: {
    name: 'Architect Pro',
    price: 15,
    period: 'monthly',
    description: 'Keep builder access after your trial. Cancel anytime.',
  },
}

const limit = max => ({ config: { rateLimit: { max, timeWindow: '1 minute' } } })

export async function registerMonetizationRoutes(fastify, { db, world }) {
  const billingEnabled = isBillingEnabled()
  const billing = createStripeBilling({
    db,
    onUserUpdated: user => world.network.onUserBillingUpdated?.(user),
  })

  // Resolve the signed-in user. Prefer the live session object so REST and realtime
  // updates never overwrite each other.
  async function getUser(req) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.body?.authToken
    if (!token) return null
    let payload
    try {
      payload = await readJWT(token)
    } catch {
      return null
    }
    if (!payload?.userId) return null
    const live = world.network.getLiveUser?.(payload.userId)
    if (live) return live
    return (await db('users').where('id', payload.userId).first()) || null
  }

  const billingStatus = user => getBillingStatus(user, { enabled: billingEnabled })

  function sendError(reply, err) {
    if (err instanceof BillingError) return reply.code(err.statusCode).send({ error: err.message })
    console.error('[billing]', err)
    return reply.code(500).send({ error: 'Something went wrong. Please try again.' })
  }

  // Storyline & lore narrative
  fastify.get('/api/storyline', limit(100), async () => {
    return { success: true, storyline: STORYLINE }
  })

  // Billing status
  fastify.get('/api/billing/status', limit(60), async req => {
    const user = await getUser(req)
    return {
      success: true,
      enabled: billingEnabled,
      authenticated: !!user,
      plans: PUBLIC_PLANS,
      ...(user ? { billing: billingStatus(user) } : {}),
    }
  })

  // Start 14-day trial (only when billing is enabled)
  fastify.post('/api/billing/start-trial', limit(30), async (req, reply) => {
    if (!billingEnabled) return reply.code(409).send({ error: 'Trials are not active on this world.' })
    const user = await getUser(req)
    if (!user) return reply.code(401).send({ error: 'Unauthorized' })
    if (user.trialStartedAt) {
      return reply.code(400).send({ error: 'Trial already activated', billing: billingStatus(user) })
    }
    const trial = startUserTrial(user)
    await db('users').where('id', user.id).update(trial)
    Object.assign(user, trial)
    world.network.onUserBillingUpdated?.(user)
    return { success: true, billing: billingStatus(user) }
  })

  // Create a Stripe Checkout session for Architect Pro
  fastify.post('/api/billing/checkout', limit(20), async (req, reply) => {
    const user = await getUser(req)
    if (!user) return reply.code(401).send({ error: 'Unauthorized' })
    try {
      return { success: true, ...(await billing.createCheckout(user)) }
    } catch (err) {
      return sendError(reply, err)
    }
  })

  // Open the Stripe billing portal (manage / cancel)
  fastify.post('/api/billing/portal', limit(20), async (req, reply) => {
    const user = await getUser(req)
    if (!user) return reply.code(401).send({ error: 'Unauthorized' })
    try {
      return { success: true, ...(await billing.createPortal(user)) }
    } catch (err) {
      return sendError(reply, err)
    }
  })

  // Old endpoint granted Pro without payment. Pro is now only granted by verified Stripe webhooks.
  fastify.post('/api/billing/upgrade', limit(20), async (req, reply) => {
    return reply.code(410).send({ error: 'Use POST /api/billing/checkout to subscribe.' })
  })

  // Stripe webhook: needs the raw body for signature verification, so it lives in its own
  // encapsulated context with a buffer JSON parser.
  await fastify.register(async instance => {
    instance.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
      done(null, body)
    })
    instance.post('/api/billing/webhook', limit(300), async (req, reply) => {
      try {
        return await billing.handleWebhook(req.body, req.headers['stripe-signature'])
      } catch (err) {
        return sendError(reply, err)
      }
    })
  })

  // Progression status
  fastify.get('/api/progression', limit(60), async req => {
    const user = await getUser(req)
    return {
      success: true,
      authenticated: !!user,
      progression: getProgressionStatus(user || {}),
      cosmetics: COSMETIC_ITEMS,
      missions: MISSIONS,
    }
  })

  // Claim a completed mission
  fastify.post('/api/progression/claim', limit(30), async (req, reply) => {
    const user = await getUser(req)
    if (!user) return reply.code(401).send({ error: 'Unauthorized' })
    const result = claimMission(user, req.body?.missionId)
    if (!result.success) return reply.code(result.code).send({ error: result.reason })
    Object.assign(user, result.updates)
    await world.network.persistProgression(user)
    world.network.onUserProgressionUpdated?.(user.id)
    return { success: true, progression: getProgressionStatus(user), claimedMission: result.mission }
  })

  // Equip an unlocked cosmetic (skins only for now)
  fastify.post('/api/progression/equip', limit(30), async (req, reply) => {
    const user = await getUser(req)
    if (!user) return reply.code(401).send({ error: 'Unauthorized' })
    const result = equipCosmetic(user, req.body?.cosmeticId)
    if (!result.success) return reply.code(result.code).send({ error: result.reason })
    await world.network.applyEquip(user, result)
    return { success: true, equipped: result.item, avatar: user.avatar, progression: getProgressionStatus(user) }
  })
}
