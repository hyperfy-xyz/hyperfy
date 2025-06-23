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

export function clamp(n: number, low: number, high: number): number {
  return Math.max(Math.min(n, high), low)
}

export function hasRole(arr: string[] | null | undefined, ...roles: string[]): boolean {
  if (!arr) return false
  // also includes temporary roles (prefixed with `~`)
  return roles.some((role: string) => arr.includes(role) || arr.includes(`~${role}`))
}

export function addRole(arr: string[], role: string): void {
  if (!hasRole(arr, role)) {
    arr.push(role)
  }
}

export function removeRole(arr: string[], role: string): void {
  const idx = arr.indexOf(role)
  if (idx !== -1) {
    arr.splice(idx, 1)
  }
}

export function serializeRoles(roles: string[]): string {
  // remove temporary (~) roles
  roles = roles.filter((role: string) => !role.startsWith('~'))
  // convert to string
  return roles.join(',')
}

export function num(min: number, max: number, dp: number = 0): number {
  const value = Math.random() * (max - min) + min
  return parseFloat(value.toFixed(dp))
}