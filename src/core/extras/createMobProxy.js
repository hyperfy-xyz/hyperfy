import * as THREE from './three'

/**
 * Create Mob Proxy
 *
 * - Provides Degen-branded API methods for mob scripts
 * - Includes AI movement, sensors, and health systems
 * - Only available on entities with type: 'mob'
 *
 */
export function createMobProxy() {
  const tempVector = new THREE.Vector3()

  const mobGetters = {
    health(entity) {
      return entity.data.health
    },
    maxHealth(entity) {
      return entity.data.maxHealth
    },
    aiState(entity) {
      return entity.aiState
    },
  }

  const mobMethods = {
    takeDamage(entity, amount, source) {
      if (!entity.isMob) {
        console.error('[takeDamage] only available on mobs')
        return
      }
      entity.takeDamage(amount, source)
    },

    heal(entity, amount) {
      if (!entity.isMob) {
        console.error('[heal] only available on mobs')
        return
      }
      entity.heal(amount)
    },
  }

  // Degen-branded AI methods
  const degenMethods = {
    /**
     * Move mob to a target position
     * @param {Vector3|Array} position - Target position
     * @param {number} speed - Movement speed in units/second
     */
    moveTo(entity, position, speed = 2) {
      if (!entity.world.network.isServer) return

      // Convert position to Vector3 if array
      const targetPos = Array.isArray(position)
        ? tempVector.set(position[0], position[1], position[2])
        : position

      // Get current position
      const currentPos = new THREE.Vector3().fromArray(entity.data.position)

      // Calculate direction
      const direction = new THREE.Vector3().subVectors(targetPos, currentPos)
      const distance = direction.length()

      if (distance < 0.1) {
        // Reached destination
        entity.aiState.mode = 'idle'
        return
      }

      // Normalize and apply speed
      direction.normalize().multiplyScalar(speed * entity.world.fixedDeltaTime)

      // Update position
      currentPos.add(direction)

      // Look at target
      const lookQuat = new THREE.Quaternion()
      const lookDir = new THREE.Vector3().subVectors(targetPos, currentPos).normalize()
      if (lookDir.length() > 0.01) {
        const targetQuat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          lookDir
        )
        lookQuat.copy(targetQuat)
      }

      // Send network update
      entity.world.network.send('entityModified', {
        id: entity.data.id,
        position: currentPos.toArray(),
        quaternion: lookQuat.toArray(),
      })

      entity.aiState.mode = 'moving'
      entity.aiState.target = targetPos.toArray()
    },

    /**
     * Patrol between waypoints
     * @param {Array<Vector3|Array>} waypoints - Array of positions
     * @param {number} speed - Movement speed
     * @param {boolean} loop - Whether to loop back to start
     */
    patrol(entity, waypoints, speed = 2, loop = true) {
      if (!entity.world.network.isServer) return
      if (!waypoints || waypoints.length === 0) return

      entity.aiState.mode = 'patrol'
      entity.aiState.waypoints = waypoints
      entity.aiState.loop = loop

      // Initialize waypoint index
      if (entity.aiState.waypointIndex === undefined) {
        entity.aiState.waypointIndex = 0
      }

      // Get current waypoint
      const currentWaypoint = waypoints[entity.aiState.waypointIndex]
      const currentPos = new THREE.Vector3().fromArray(entity.data.position)
      const targetPos = Array.isArray(currentWaypoint)
        ? new THREE.Vector3().fromArray(currentWaypoint)
        : currentWaypoint

      const distance = currentPos.distanceTo(targetPos)

      // Check if reached waypoint
      if (distance < 0.5) {
        entity.aiState.waypointIndex++

        // Handle end of waypoints
        if (entity.aiState.waypointIndex >= waypoints.length) {
          if (loop) {
            entity.aiState.waypointIndex = 0
          } else {
            entity.aiState.mode = 'idle'
            return
          }
        }
      }

      // Move to current waypoint
      this.moveTo(entity, waypoints[entity.aiState.waypointIndex], speed)
    },

    /**
     * Chase a target entity
     * @param {string} targetId - Entity ID to chase
     * @param {number} speed - Movement speed
     * @param {number} minDistance - Minimum distance to maintain
     */
    chase(entity, targetId, speed = 3, minDistance = 1.5) {
      if (!entity.world.network.isServer) return

      const target = entity.world.entities.get(targetId)
      if (!target) {
        entity.aiState.mode = 'idle'
        return
      }

      const currentPos = new THREE.Vector3().fromArray(entity.data.position)
      const targetPos = new THREE.Vector3().fromArray(target.data.position)
      const distance = currentPos.distanceTo(targetPos)

      entity.aiState.mode = 'chase'
      entity.aiState.target = targetId

      // Stop if within minimum distance
      if (distance <= minDistance) {
        return
      }

      // Move towards target
      this.moveTo(entity, targetPos, speed)
    },

    /**
     * Flee from a threat
     * @param {string} threatId - Entity ID to flee from
     * @param {number} speed - Movement speed
     * @param {number} safeDistance - Distance to maintain
     */
    flee(entity, threatId, speed = 4, safeDistance = 10) {
      if (!entity.world.network.isServer) return

      const threat = entity.world.entities.get(threatId)
      if (!threat) {
        entity.aiState.mode = 'idle'
        return
      }

      const currentPos = new THREE.Vector3().fromArray(entity.data.position)
      const threatPos = new THREE.Vector3().fromArray(threat.data.position)
      const distance = currentPos.distanceTo(threatPos)

      entity.aiState.mode = 'flee'
      entity.aiState.threat = threatId

      // Stop if safe distance reached
      if (distance >= safeDistance) {
        entity.aiState.mode = 'idle'
        return
      }

      // Calculate flee direction (opposite of threat)
      const fleeDir = new THREE.Vector3()
        .subVectors(currentPos, threatPos)
        .normalize()
        .multiplyScalar(safeDistance)

      const fleePos = new THREE.Vector3().addVectors(currentPos, fleeDir)

      // Move away from threat
      this.moveTo(entity, fleePos, speed)
    },

    /**
     * Enter idle state
     */
    idle(entity) {
      if (!entity.world.network.isServer) return
      entity.aiState.mode = 'idle'
      entity.aiState.target = null
    },

    /**
     * Find nearest player within range
     * @param {number} maxDistance - Maximum search distance
     * @returns {Object|null} - { id, distance } or null
     */
    findNearestPlayer(entity, maxDistance = 20) {
      if (!entity.world.network.isServer) return null

      const currentPos = new THREE.Vector3().fromArray(entity.data.position)
      let nearest = null
      let nearestDistance = maxDistance

      entity.world.entities.players.forEach(player => {
        const playerPos = new THREE.Vector3().fromArray(player.data.position)
        const distance = currentPos.distanceTo(playerPos)

        if (distance < nearestDistance) {
          nearest = { id: player.data.id, distance }
          nearestDistance = distance
        }
      })

      return nearest
    },

    /**
     * Check if mob can see a player (raycast line of sight)
     * @param {string} playerId - Player entity ID
     * @param {number} maxDistance - Maximum sight distance
     * @returns {boolean}
     */
    canSeePlayer(entity, playerId, maxDistance = 15) {
      if (!entity.world.network.isServer) return false

      const player = entity.world.entities.get(playerId)
      if (!player) return false

      const currentPos = new THREE.Vector3().fromArray(entity.data.position)
      const playerPos = new THREE.Vector3().fromArray(player.data.position)
      const distance = currentPos.distanceTo(playerPos)

      if (distance > maxDistance) return false

      // Raycast for line of sight
      const direction = new THREE.Vector3().subVectors(playerPos, currentPos).normalize()
      const hit = entity.world.physics.raycast(currentPos, direction, distance)

      // If nothing hit or hit the player, we can see them
      return !hit || hit.handle?.playerId === playerId
    },

    /**
     * Get all players within a radius
     * @param {number} radius - Search radius
     * @returns {Array<Object>} - Array of { id, distance }
     */
    getPlayersInRange(entity, radius = 10) {
      if (!entity.world.network.isServer) return []

      const currentPos = new THREE.Vector3().fromArray(entity.data.position)
      const playersInRange = []

      entity.world.entities.players.forEach(player => {
        const playerPos = new THREE.Vector3().fromArray(player.data.position)
        const distance = currentPos.distanceTo(playerPos)

        if (distance <= radius) {
          playersInRange.push({ id: player.data.id, distance })
        }
      })

      return playersInRange
    },
  }

  return {
    mobGetters,
    mobMethods,
    degenMethods,
  }
}
