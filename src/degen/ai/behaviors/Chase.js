/**
 * Chase Behavior
 *
 * - Mob chases a target entity
 * - Stops at minimum distance
 *
 */
export class Chase {
  constructor(options = {}) {
    this.options = {
      speed: 3,
      minDistance: 1.5,
      maxDistance: 20, // Give up chase if target too far
      ...options,
    }
    this.targetId = null
  }

  onEnter() {
    // Target can be set before entering or during update
  }

  update(delta) {
    if (!this.controller) return
    if (!this.targetId) return

    const mob = this.controller.mob
    const target = mob.world.entities.get(this.targetId)

    if (!target) {
      // Target lost, go idle
      this.controller.setBehavior('idle')
      return
    }

    // Check if target too far
    const currentPos = mob.root.position
    const targetPos = target.root?.position || { x: target.data.position[0], y: target.data.position[1], z: target.data.position[2] }

    const distance = Math.sqrt(
      Math.pow(currentPos.x - targetPos.x, 2) +
        Math.pow(currentPos.y - targetPos.y, 2) +
        Math.pow(currentPos.z - targetPos.z, 2)
    )

    if (distance > this.options.maxDistance) {
      // Too far, give up
      this.controller.setBehavior('idle')
      return
    }

    // Chase using degen API
    mob.degen.chase(this.targetId, this.options.speed, this.options.minDistance)
  }

  onExit() {
    this.targetId = null
  }

  /**
   * Set target to chase
   */
  setTarget(targetId) {
    this.targetId = targetId
  }
}
