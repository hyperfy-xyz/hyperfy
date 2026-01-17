/**
 * RaycastSensor
 *
 * - Performs raycast for line-of-sight detection
 * - Can check visibility to specific targets
 * - Useful for aggro detection and combat
 *
 */
export class RaycastSensor {
  constructor(options = {}) {
    this.options = {
      maxDistance: 15,
      updateRate: 0.3, // Update every 300ms (~3Hz)
      heightOffset: 1, // Cast from mob's eye level
      ...options,
    }

    this.visibleTargets = new Map()
    this.lastUpdate = 0
  }

  update(delta) {
    if (!this.controller) return

    // Rate limiting
    this.lastUpdate += delta
    if (this.lastUpdate < this.options.updateRate) return
    this.lastUpdate = 0

    // Clear previous results
    this.visibleTargets.clear()
  }

  /**
   * Check if mob can see a specific player
   * @param {string} playerId - Player entity ID
   * @returns {boolean}
   */
  canSeePlayer(playerId) {
    if (!this.controller) return false

    const mob = this.controller.mob
    const result = mob.degen.canSeePlayer(playerId, this.options.maxDistance)

    // Cache result
    this.visibleTargets.set(playerId, result)

    return result
  }

  /**
   * Check if mob can see any player from a list
   * @param {Array<string>} playerIds - Array of player entity IDs
   * @returns {Array<string>} - IDs of visible players
   */
  getVisiblePlayers(playerIds) {
    const visible = []

    for (const playerId of playerIds) {
      if (this.canSeePlayer(playerId)) {
        visible.push(playerId)
      }
    }

    return visible
  }

  /**
   * Get cached visibility results
   */
  getVisibleTargets() {
    return this.visibleTargets
  }

  /**
   * Clear cached results
   */
  clear() {
    this.visibleTargets.clear()
  }
}
