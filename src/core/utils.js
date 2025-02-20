import { some } from 'lodash-es'
import { customAlphabet } from 'nanoid'

const ALPHABET = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * UUID
 *
 * We use 10 character uuids for simplicity and balance between probability and network packet size,
 * without the need to use smaller id mapping tech.
 *
 * alphanumeric @ 10 characters
 * ~148 years or 129M IDs needed, in order to have a 1% probability of at least one collision.
 * see: https://zelark.github.io/nano-id-cc/
 *
 */
export const uuid = customAlphabet(ALPHABET, 10)

export function clamp(n, low, high) {
  return Math.max(Math.min(n, high), low)
}

export function hasRole(arr, ...roles) {
  if (!arr) return false
  // also includes temporary roles (prefixed with `~`)
  return some(roles, role => arr.includes(role) || arr.includes(`~${role}`))
}

export function addRole(arr, role) {
  if (!hasRole(arr, role)) {
    arr.push(role)
  }
}

export function removeRole(arr, role) {
  const idx = arr.indexOf(role)
  if (idx !== -1) {
    arr.splice(idx, 1)
  }
}

export function serializeRoles(roles) {
  // remove temporary (~) roles
  roles = roles.filter(role => !role.startsWith('~'))
  // convert to string
  return roles.join(',')
}

export function num(min, max, dp = 0) {
  const value = Math.random() * (max - min) + min
  return parseFloat(value.toFixed(dp))
}
