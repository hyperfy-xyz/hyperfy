import Stripe from 'stripe'
import { getBillingStatus, isBillingEnabled, mapStripeSubscription } from '../core/billing.js'

/**
 * Stripe billing for Architect Pro.
 *
 * - Checkout and the billing portal are created server-side for the signed-in user.
 * - Entitlements change ONLY from Stripe webhooks whose signature verifies against
 *   STRIPE_WEBHOOK_SECRET. Nothing the client sends can grant Pro.
 */

export class BillingError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
  }
}

const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
])

export function createStripeBilling({ db, env = process.env, stripe: injectedStripe, onUserUpdated } = {}) {
  const enabled = isBillingEnabled(env)
  const secretKey = env.STRIPE_SECRET_KEY
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET
  const priceId = env.STRIPE_PRICE_ID
  const configured = Boolean(secretKey && webhookSecret && priceId)
  const stripe = injectedStripe || (secretKey ? new Stripe(secretKey) : null)

  function appOrigin() {
    const base = env.PUBLIC_APP_URL || env.PUBLIC_API_URL || ''
    try {
      return new URL(base).origin
    } catch {
      return ''
    }
  }

  function assertReady() {
    if (!enabled || !configured || !stripe) {
      throw new BillingError(503, 'Payments are not enabled on this world yet.')
    }
  }

  async function createCheckout(user) {
    assertReady()
    if (getBillingStatus(user).isPaid) {
      throw new BillingError(409, 'Architect Pro is already active on this account.')
    }
    const origin = appOrigin()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
      ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : {}),
      allow_promotion_codes: true,
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
    })
    return { id: session.id, url: session.url }
  }

  async function createPortal(user) {
    assertReady()
    if (!user.stripeCustomerId) {
      throw new BillingError(404, 'No subscription found for this account.')
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appOrigin()}/`,
    })
    return { url: session.url }
  }

  async function findUser({ userId, subscriptionId, customerId }) {
    if (subscriptionId) {
      const user = await db('users').where('stripeSubscriptionId', subscriptionId).first()
      if (user) return user
    }
    if (userId) {
      const user = await db('users').where('id', userId).first()
      if (user) return user
    }
    if (customerId) {
      const user = await db('users').where('stripeCustomerId', customerId).first()
      if (user) return user
    }
    return null
  }

  async function applySubscription(subscription, hintUserId) {
    const fields = mapStripeSubscription(subscription)
    const user = await findUser({
      userId: subscription.metadata?.userId || hintUserId,
      subscriptionId: subscription.id,
      customerId: fields.stripeCustomerId,
    })
    if (!user) return { handled: false, reason: 'user_not_found' }
    // ignore late events for an older subscription when a different one is active
    const stale =
      user.stripeSubscriptionId &&
      user.stripeSubscriptionId !== subscription.id &&
      getBillingStatus(user).isPaid &&
      fields.subscriptionStatus !== 'active'
    if (stale) return { handled: false, reason: 'stale_subscription', userId: user.id }
    await db('users').where('id', user.id).update(fields)
    const updated = { ...user, ...fields }
    try {
      onUserUpdated?.(updated)
    } catch (err) {
      console.error('[billing] failed to notify live session', err)
    }
    return { handled: true, userId: user.id, subscriptionStatus: fields.subscriptionStatus }
  }

  async function retrieveSubscription(subscriptionOrId) {
    if (!subscriptionOrId) return null
    if (typeof subscriptionOrId === 'object') return subscriptionOrId
    return await stripe.subscriptions.retrieve(subscriptionOrId)
  }

  async function handleWebhook(rawBody, signature) {
    if (!enabled || !webhookSecret || !stripe) {
      throw new BillingError(503, 'Payments are not enabled on this world yet.')
    }
    if (!signature) throw new BillingError(400, 'Missing Stripe-Signature header')
    let event
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
    } catch (err) {
      throw new BillingError(400, 'Invalid webhook signature')
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      if (session.mode !== 'subscription' || !session.subscription) return { received: true, ignored: true }
      // client_reference_id was set by this server when it created the session
      const userId = session.client_reference_id || session.metadata?.userId
      const subscription = await retrieveSubscription(session.subscription)
      return { received: true, ...(await applySubscription(subscription, userId)) }
    }

    if (SUBSCRIPTION_EVENTS.has(event.type)) {
      return { received: true, ...(await applySubscription(event.data.object)) }
    }

    if (event.type === 'invoice.payment_failed' || event.type === 'invoice.paid') {
      const invoice = event.data.object
      const subscriptionId = invoice.subscription || invoice.parent?.subscription_details?.subscription
      if (!subscriptionId) return { received: true, ignored: true }
      const subscription = await retrieveSubscription(subscriptionId)
      return { received: true, ...(await applySubscription(subscription)) }
    }

    return { received: true, ignored: true }
  }

  return { enabled, configured, createCheckout, createPortal, handleWebhook }
}
