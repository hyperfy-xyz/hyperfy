/**
 * Flee Behavior
 *
 * - Mob flees from a threat entity
 * - Stops at safe distance
 *
 */
export class Flee {
  constructor(options = {}) {
    this.options = {
      speed: 4,
      safeDistance: 10,
      panicDistance: 5, // Distance at which to start fleeing
      ...options,
    }
    this.threatId = null
  }

  onEnter() {
    // Threat can be set before entering or during update
  }

  update(delta) {
    if (!this.controller) return
    if (!this.threatId) return

    const mob = this.controller.mob
    const threat = mob.world.entities.get(this.threatId)

    if (!threat) {
      // Threat gone, go idle
      this.controller.setBehavior('idle')
      return
    }

    // Check distance to threat
    const currentPos = mob.root.position
    const threatPos = threat.root?.position || { x: threat.data.position[0], y: threat.data.position[1], z: threat.data.position[2] }

    const distance = Math.sqrt(
      Math.pow(currentPos.x - threatPos.x, 2) +
        Math.pow(currentPos.y - threatPos.y, 2) +
        Math.pow(currentPos.z - threatPos.z, 2)
    )

    if (distance >= this.options.safeDistance) {
      // Safe now, go idle
      this.controller.setBehavior('idle')
      return
    }

    // Flee using degen API
    mob.degen.flee(this.threatId, this.options.speed, this.options.safeDistance)
  }

  onExit() {
    this.threatId = null
  }

  /**
   * Set threat to flee from
   */
  setThreat(threatId) {
    this.threatId = threatId
  }
}
