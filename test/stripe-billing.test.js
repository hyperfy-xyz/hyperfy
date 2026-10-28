import test from 'node:test'
import assert from 'node:assert/strict'
import Knex from 'knex'
import Stripe from 'stripe'
import { createStripeBilling, BillingError } from '../src/server/stripe.js'
import { getBillingStatus } from '../src/core/billing.js'

const WEBHOOK_SECRET = 'whsec_test_secret'
const ENV = {
  BILLING_ENABLED: 'true',
  STRIPE_SECRET_KEY: 'sk_test_dummy',
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_PRICE_ID: 'price_test_pro',
  PUBLIC_API_URL: 'https://play.example.com/api',
}

async function setup({ env = ENV, subscription } = {}) {
  const db = Knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true })
  await db.schema.createTable('users', t => {
    t.string('id').primary()
    t.string('name')
    t.string('plan').defaultTo('free')
    t.string('subscriptionStatus').defaultTo('inactive')
    t.string('subscriptionPlan')
    t.string('trialStartedAt')
    t.string('trialEndsAt')
    t.string('stripeCustomerId')
    t.string('stripeSubscriptionId')
    t.string('currentPeriodEnd')
  })
  await db('users').insert({ id: 'user_1', name: 'Operative' })
  const real = new Stripe('sk_test_dummy')
  const calls = { checkout: [], portal: [], updated: [] }
  const fakeStripe = {
    webhooks: real.webhooks,
    subscriptions: { retrieve: async id => ({ ...subscription, id }) },
    checkout: {
      sessions: {
        create: async args => {
          calls.checkout.push(args)
          return { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }
        },
      },
    },
    billingPortal: {
      sessions: {
        create: async args => {
          calls.portal.push(args)
          return { url: 'https://billing.stripe.com/p/session/test' }
        },
      },
    },
  }
  const billing = createStripeBilling({ db, env, stripe: fakeStripe, onUserUpdated: u => calls.updated.push(u) })
  const sign = event => {
    const payload = JSON.stringify(event)
    return {
      body: Buffer.from(payload),
      signature: real.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }),
    }
  }
  return { db, billing, calls, sign }
}

test('checkout is created server-side for the signed-in user', async () => {
  const { db, billing, calls } = await setup()
  const user = await db('users').where('id', 'user_1').first()
  const session = await billing.createCheckout(user)
  assert.equal(session.url, 'https://checkout.stripe.com/c/pay/cs_test_1')
  assert.equal(calls.checkout[0].client_reference_id, 'user_1')
  assert.equal(calls.checkout[0].line_items[0].price, 'price_test_pro')
  assert.equal(calls.checkout[0].success_url, 'https://play.example.com/?checkout=success')
  // creating checkout grants nothing
  const after = await db('users').where('id', 'user_1').first()
  assert.equal(getBillingStatus(after).isPaid, false)
  await db.destroy()
})

test('payments are unavailable unless billing is enabled and configured', async () => {
  const { db, billing } = await setup({ env: { ...ENV, BILLING_ENABLED: 'false' } })
  const user = await db('users').where('id', 'user_1').first()
  await assert.rejects(billing.createCheckout(user), err => err instanceof BillingError && err.statusCode === 503)
  await assert.rejects(billing.handleWebhook(Buffer.from('{}'), 't=1,v1=x'), err => err.statusCode === 503)
  await db.destroy()
})

test('unsigned or forged webhooks are rejected and change nothing', async () => {
  const { db, billing } = await setup()
  const forged = JSON.stringify({
    type: 'checkout.session.completed',
    data: { object: { mode: 'subscription', client_reference_id: 'user_1', subscription: 'sub_1' } },
  })
  await assert.rejects(billing.handleWebhook(Buffer.from(forged), undefined), err => err.statusCode === 400)
  await assert.rejects(billing.handleWebhook(Buffer.from(forged), 't=123,v1=deadbeef'), err => err.statusCode === 400)
  const user = await db('users').where('id', 'user_1').first()
  assert.equal(getBillingStatus(user).isPaid, false)
  await db.destroy()
})

test('verified checkout activates Pro; cancellation and failed payments revoke it', async () => {
  const subscription = {
    status: 'active',
    customer: 'cus_1',
    metadata: { userId: 'user_1' },
    current_period_end: 1893456000,
  }
  const { db, billing, calls, sign } = await setup({ subscription })

  const completed = sign({
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: { object: { mode: 'subscription', client_reference_id: 'user_1', subscription: 'sub_1', customer: 'cus_1' } },
  })
  const res = await billing.handleWebhook(completed.body, completed.signature)
  assert.equal(res.handled, true)
  let user = await db('users').where('id', 'user_1').first()
  assert.equal(getBillingStatus(user).isPaid, true)
  assert.equal(user.stripeSubscriptionId, 'sub_1')
  assert.equal(user.stripeCustomerId, 'cus_1')
  assert.equal(calls.updated.length, 1, 'live session notified')

  const pastDue = sign({
    id: 'evt_2',
    type: 'customer.subscription.updated',
    data: { object: { id: 'sub_1', status: 'past_due', customer: 'cus_1', metadata: { userId: 'user_1' } } },
  })
  await billing.handleWebhook(pastDue.body, pastDue.signature)
  user = await db('users').where('id', 'user_1').first()
  assert.equal(user.subscriptionStatus, 'past_due')
  assert.equal(getBillingStatus(user).isPaid, false)

  const deleted = sign({
    id: 'evt_3',
    type: 'customer.subscription.deleted',
    data: { object: { id: 'sub_1', status: 'canceled', customer: 'cus_1', metadata: { userId: 'user_1' } } },
  })
  await billing.handleWebhook(deleted.body, deleted.signature)
  user = await db('users').where('id', 'user_1').first()
  assert.equal(user.subscriptionStatus, 'canceled')
  assert.equal(getBillingStatus(user).isPaid, false)

  // portal is available once a customer exists
  const portal = await billing.createPortal(user)
  assert.equal(portal.url, 'https://billing.stripe.com/p/session/test')
  assert.equal(calls.portal[0].customer, 'cus_1')
  await db.destroy()
})
