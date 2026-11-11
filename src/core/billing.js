import moment from 'moment'

export const BillingPlans = {
  FREE: 'free',
  TRIAL: 'trial',
  PAID: 'paid',
}

export const PLANS = {
  FREE: { id: 'free', name: 'Explorer', price: 0 },
  TRIAL: { id: 'trial', name: 'Architect Trial', price: 0, durationDays: 14 },
  PRO: { id: 'pro', name: 'Architect Pro', price: 15 },
}

export const SubscriptionStatuses = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
}

export const TRIAL_DURATION_DAYS = 14
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000

/**
 * Computes comprehensive billing and entitlement status for a user.
 * Server-side and client-safe helper.
 */
export function getBillingStatus(user = {}) {
  const plan = user.plan || BillingPlans.FREE
  const subscriptionStatus = user.subscriptionStatus || SubscriptionStatuses.INACTIVE
  const subscriptionPlan = user.subscriptionPlan || null
  const trialStartedAt = user.trialStartedAt || null
  const trialEndsAt = user.trialEndsAt || null

  const isPaid = plan === BillingPlans.PAID && subscriptionStatus === SubscriptionStatuses.ACTIVE

  let isTrialActive = false
  let isTrialExpired = false
  let trialDaysRemaining = 0

  if (trialEndsAt) {
    const endMs = new Date(trialEndsAt).getTime()
    const nowMs = Date.now()
    if (endMs > nowMs) {
      isTrialActive = true
      trialDaysRemaining = Math.max(1, Math.ceil((endMs - nowMs) / (24 * 60 * 60 * 1000)))
    } else {
      isTrialExpired = true
      trialDaysRemaining = 0
    }
  }

  // Builder and hosting actions require an active trial or paid subscription
  const canBuildAndHost = isPaid || isTrialActive

  // Free exploration is ALWAYS allowed - public and demo worlds remain accessible
  const canExplore = true

  return {
    plan,
    subscriptionStatus,
    subscriptionPlan,
    trialStartedAt,
    trialEndsAt,
    isPaid,
    isTrialActive,
    isTrialExpired,
    trialDaysRemaining,
    canBuildAndHost,
    canExplore,
  }
}

/**
 * Check whether a user is entitled to perform protected builder or hosting actions
 */
export function canUserBuild(user) {
  return getBillingStatus(user).canBuildAndHost
}

/**
 * Check whether a user is entitled to explore public worlds (always true)
 */
export function canUserExplore(user) {
  return true
}

export const canExplore = canUserExplore
export const canBuildAndHost = canUserBuild

/**
 * Generates trial start parameters for a user
 */
export function startUserTrial(user, durationDays = TRIAL_DURATION_DAYS) {
  const now = moment()
  const trialStartedAt = now.toISOString()
  const trialEndsAt = now.clone().add(durationDays, 'days').toISOString()
  return {
    plan: BillingPlans.TRIAL,
    trialStartedAt,
    trialEndsAt,
    subscriptionStatus: SubscriptionStatuses.INACTIVE,
  }
}

export function startTrial(user, durationDays = TRIAL_DURATION_DAYS) {
  const trialData = startUserTrial(user, durationDays)
  return {
    ...user,
    ...trialData,
  }
}

/**
 * Generates upgrade parameters for a user
 */
export function upgradeUserPlan(user, planName = 'architect_pro') {
  return {
    plan: BillingPlans.PAID,
    subscriptionStatus: SubscriptionStatuses.ACTIVE,
    subscriptionPlan: planName,
  }
}

export function applySubscription(user, planName = 'pro', subscriptionId = null) {
  return {
    ...user,
    plan: BillingPlans.PAID,
    subscriptionStatus: SubscriptionStatuses.ACTIVE,
    subscriptionPlan: planName,
    subscriptionId,
  }
}

export function cancelSubscription(user) {
  return {
    ...user,
    subscriptionStatus: SubscriptionStatuses.CANCELED,
  }
}
