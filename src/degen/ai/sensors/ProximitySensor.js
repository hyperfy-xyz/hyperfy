/**
 * ProximitySensor
 *
 * - Detects entities (players, mobs) within a radius
 * - Can filter by entity type
 * - Provides nearest entity detection
 *
 */
export class ProximitySensor {
  constructor(options = {}) {
    this.options = {
      radius: 10,
      updateRate: 0.2, // Update every 200ms (5Hz)
      detectPlayers: true,
      detectMobs: false,
      ...options,
    }

    this.entitiesInRange = []
    this.nearestEntity = null
    this.lastUpdate = 0
  }

  update(delta) {
    if (!this.controller) return

    // Rate limiting
    this.lastUpdate += delta
    if (this.lastUpdate < this.options.updateRate) return
    this.lastUpdate = 0

    const mob = this.controller.mob
    this.entitiesInRange = []
    this.nearestEntity = null
    let nearestDistance = Infinity

    // Detect players
    if (this.options.detectPlayers) {
      const players = mob.degen.getPlayersInRange(this.options.radius)
      for (const playerData of players) {
        this.entitiesInRange.push({
          id: playerData.id,
          distance: playerData.distance,
          type: 'player',
        })

        if (playerData.distance < nearestDistance) {
          nearestDistance = playerData.distance
          this.nearestEntity = {
            id: playerData.id,
            distance: playerData.distance,
            type: 'player',
          }
        }
      }
    }

    // Detect other mobs (if enabled)
    if (this.options.detectMobs) {
      // Get all entities and filter for mobs
      mob.world.entities.items.forEach(entity => {
        if (entity.isMob && entity.data.id !== mob.data.id) {
          const currentPos = mob.root.position
          const entityPos = entity.root?.position || { x: entity.data.position[0], y: entity.data.position[1], z: entity.data.position[2] }

          const distance = Math.sqrt(
            Math.pow(currentPos.x - entityPos.x, 2) +
              Math.pow(currentPos.y - entityPos.y, 2) +
              Math.pow(currentPos.z - entityPos.z, 2)
          )

          if (distance <= this.options.radius) {
            this.entitiesInRange.push({
              id: entity.data.id,
              distance,
              type: 'mob',
            })

            if (distance < nearestDistance) {
              nearestDistance = distance
              this.nearestEntity = {
                id: entity.data.id,
                distance,
                type: 'mob',
              }
            }
          }
        }
      })
    }
  }

  /**
   * Get all entities in range
   */
  getEntitiesInRange() {
    return this.entitiesInRange
  }

  /**
   * Get nearest entity
   */
  getNearestEntity() {
    return this.nearestEntity
  }

  /**
   * Check if any entities in range
   */
  hasEntitiesInRange() {
    return this.entitiesInRange.length > 0
  }
}
