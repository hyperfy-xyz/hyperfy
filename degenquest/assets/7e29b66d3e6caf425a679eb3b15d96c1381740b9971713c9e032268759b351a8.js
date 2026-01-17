/**
 * RAT MOB V24 - Embedded Sounds (Scalable Architecture)
 *
 * Features:
 * - ALL 18 sounds embedded in .hyp file
 * - Self-contained (no external dependencies)
 * - Scalable (no core game code changes)
 * - Immersive sound design (idle, movement, reactions)
 * - Full animation system from v19 (WORKING)
 *
 * @version 1.0.24
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
app.configure([
  { key: 'moveSpeed', type: 'number', default: 2.0, label: 'Movement Speed' },
  { key: 'detectionRange', type: 'number', default: 15.0, label: 'Detection Range' },
  { key: 'attackRange', type: 'number', default: 3.0, label: 'Attack Range' },
  { key: 'attackCooldown', type: 'number', default: 1500, label: 'Attack Cooldown (ms)' },
  { key: 'updateRate', type: 'number', default: 50, label: 'AI Update Rate (ms)' },

  // Animation defaults
  { key: 'idleAnimName', type: 'string', default: 'rat_idle_01', label: 'Idle Animation' },
  { key: 'walkAnimName', type: 'string', default: 'rat_walk', label: 'Walk Animation' },
  { key: 'attackAnimName', type: 'string', default: 'rat_attack_01', label: 'Attack Animation' },
  { key: 'deathAnimName', type: 'string', default: 'rat_death', label: 'Death Animation' },

  // Options
  { key: 'useVariedIdle', type: 'boolean', default: true, label: 'Use Varied Idle Animations' },
  { key: 'useVariedAttacks', type: 'boolean', default: true, label: 'Use Varied Attack Animations' },
  { key: 'aggressive', type: 'boolean', default: true, label: 'Aggressive' },
  { key: 'enableSounds', type: 'boolean', default: true, label: 'Enable Sounds' },

  // Sound map (injected by builder with asset:// URLs)
  { key: 'soundMap', type: 'object', default: {}, label: 'Sound Map' },

  // Boid flocking parameters
  { key: 'boidEnabled', type: 'boolean', default: true, label: 'Enable Boid Flocking' },
  { key: 'boidPerceptionRadius', type: 'number', default: 8.0, label: 'Boid Perception Radius' },
  { key: 'boidSeparationRadius', type: 'number', default: 2.0, label: 'Separation Radius' },
  { key: 'boidSeparationWeight', type: 'number', default: 1.5, label: 'Separation Weight' },
  { key: 'boidAlignmentWeight', type: 'number', default: 1.0, label: 'Alignment Weight' },
  { key: 'boidCohesionWeight', type: 'number', default: 1.0, label: 'Cohesion Weight' },
  { key: 'boidObstacleWeight', type: 'number', default: 2.0, label: 'Obstacle Avoidance Weight' },
  { key: 'boidMaxForce', type: 'number', default: 3.0, label: 'Max Steering Force' },
  { key: 'boidUpdateRate', type: 'number', default: 200, label: 'Boid Update Interval (ms)' },
  { key: 'spawnGroupSize', type: 'number', default: 10.0, label: 'Spawn Group Grid Size (m)' }
])

// ============================================================================
// ANIMATION POOLS
// ============================================================================
const ANIMATIONS = {
  idle: ['rat_idle_01', 'rat_idle_02', 'rat_idle_03', 'rat_idle_eat'],
  idleRare: ['rat_sleep'],
  chase: ['rat_walk', 'rat_run_fast'],
  attack: ['rat_attack_01', 'rat_attack_02'],
  attackRare: ['rat_butting_heads', 'rat_roar'],
  death: ['rat_death'],
  injured: ['rat_injured'],
  surprised: ['rat_surprised'],
  turn: ['rat_turn_left', 'rat_turn_right']
}

// ============================================================================
// HELPERS
// ============================================================================
function pickRandom(pool) {
  if (!pool || pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

const mobName = app.data?.name || 'Rat'
let npcTypeId = null
let spawnId = null

// ============================================================================
// CLIENT-SIDE SOUND SYSTEM
// ============================================================================
if (world.isClient) {
  // Create audio nodes upfront and add them to scene tree
  const audioNodes = []
  const POOL_SIZE = 3

  // Initialize audio nodes and mount them immediately
  for (let i = 0; i < POOL_SIZE; i++) {
    const node = app.create('audio', {
      spatial: false,  // Non-spatial (simpler, no positioning needed)
      volume: 1.0,
      loop: false,
      group: 'sfx'
    })
    app.add(node)  // ← CRITICAL: Mount node to scene tree so ctx.world is set
    audioNodes.push(node)
  }
  console.log(`[${mobName}] Created and mounted ${POOL_SIZE} audio nodes`)

  /**
   * Get next available audio node from pool
   */
  let currentNodeIndex = 0
  function getAudioNode() {
    const node = audioNodes[currentNodeIndex]
    currentNodeIndex = (currentNodeIndex + 1) % POOL_SIZE

    // Stop if currently playing
    if (node.isPlaying) {
      node.stop()
    }

    return node
  }

  /**
   * Play a sound from embedded assets
   */
  function playSound(soundName, volume = 1.0, loop = false) {
    if (!app.props.enableSounds) return
    if (!app.props.soundMap) {
      console.warn(`[${mobName}] No soundMap in props`)
      return
    }

    const soundUrl = app.props.soundMap[soundName]
    if (!soundUrl) {
      console.warn(`[${mobName}] Sound "${soundName}" not found in soundMap`)
      return
    }

    try {
      const node = getAudioNode()
      node.src = soundUrl
      node.volume = volume
      node.loop = loop
      node.play(true)  // restart if playing

      console.log(`[${mobName}] 🔊 ${soundName} (${volume.toFixed(1)})`)
    } catch (err) {
      console.error(`[${mobName}] Error playing sound:`, err)
    }
  }

  /**
   * Play random sound from a list
   */
  function playRandomSound(soundNames, volume = 1.0) {
    if (!soundNames || soundNames.length === 0) return
    const soundName = soundNames[Math.floor(Math.random() * soundNames.length)]
    playSound(soundName, volume)
  }

  // Expose to server via events
  app.on('playSound', (data) => {
    playSound(data.sound, data.volume, data.loop)
  })

  app.on('playRandomSound', (data) => {
    playRandomSound(data.sounds, data.volume)
  })

  // ============================================================================
  // CLIENT-SIDE POSITION SYNC (With Interpolation)
  // ============================================================================

  // Target position from server
  let targetPos = null
  let targetYaw = null

  // Interpolation rate (0.125 matches Hyperfy's LerpVector3 rate)
  const LERP_RATE = 0.125

  // Receive pose updates from server
  app.on('pose', ({ p, yaw }) => {
    if (Array.isArray(p) && p.length === 3) {
      targetPos = { x: p[0], y: p[1], z: p[2] }
    }
    if (typeof yaw === 'number') {
      targetYaw = yaw
    }
  })

  // Apply interpolation every frame
  app.on('update', (delta) => {
    if (!targetPos || !app.position) return

    // Lerp position toward target
    app.position.x += (targetPos.x - app.position.x) * LERP_RATE
    app.position.y += (targetPos.y - app.position.y) * LERP_RATE
    app.position.z += (targetPos.z - app.position.z) * LERP_RATE

    // Lerp rotation toward target yaw
    if (targetYaw !== null && app.rotation) {
      // Shortest path interpolation for angles
      let diff = targetYaw - app.rotation.y
      // Normalize to [-PI, PI]
      while (diff > Math.PI) diff -= 2 * Math.PI
      while (diff < -Math.PI) diff += 2 * Math.PI

      app.rotation.y += diff * LERP_RATE
      app.rotation.x = 0
      app.rotation.z = 0
    }
  })
}

// ============================================================================
// SERVER-SIDE AI
// ============================================================================
if (world.isServer) {
  console.log(`[${mobName}] 🎮 Server starting...`)

  // ============================================================================
  // BOID SWARM SYSTEM - Global Registry
  // ============================================================================

  // Global rat registry (shared across all rat instances via closure)
  if (typeof globalThis.RAT_REGISTRY === 'undefined') {
    globalThis.RAT_REGISTRY = new Map()
  }
  const RAT_REGISTRY = globalThis.RAT_REGISTRY

  // Helper: Generate spawn group ID from position
  function getSpawnGroupId(position, gridSize = 10.0) {
    const x = Math.floor(position.x / gridSize) * gridSize
    const z = Math.floor(position.z / gridSize) * gridSize
    return `spawn_${x}_${z}`
  }

  // Register this rat on spawn
  const mySpawnGroupId = getSpawnGroupId(app.position, app.props.spawnGroupSize)
  RAT_REGISTRY.set(app.instanceId, {
    appId: app.instanceId,
    position: { x: app.position.x, y: app.position.y, z: app.position.z },
    velocity: { x: 0, y: 0, z: 0 },
    state: 'idle',
    spawnGroupId: mySpawnGroupId
  })

  console.log(`[${mobName}] 🐀 Registered in RAT_REGISTRY, spawn group: ${mySpawnGroupId}, total rats: ${RAT_REGISTRY.size}`)

  // Broadcast registration to other rats
  app.emit('rat:register', {
    appId: app.instanceId,
    position: [app.position.x, app.position.y, app.position.z],
    spawnGroupId: mySpawnGroupId
  })

  // Listen for other rats registering
  world.on('rat:register', (data) => {
    if (data.appId !== app.instanceId) {
      RAT_REGISTRY.set(data.appId, {
        appId: data.appId,
        position: { x: data.position[0], y: data.position[1], z: data.position[2] },
        velocity: { x: 0, y: 0, z: 0 },
        state: 'idle',
        spawnGroupId: data.spawnGroupId
      })
      console.log(`[${mobName}] 🐀 Another rat registered: ${data.appId}, group: ${data.spawnGroupId}`)
    }
  })

  // Listen for position updates from other rats
  world.on('rat:position', (data) => {
    if (data.appId !== app.instanceId) {
      const rat = RAT_REGISTRY.get(data.appId)
      if (rat) {
        rat.position.x = data.position[0]
        rat.position.y = data.position[1]
        rat.position.z = data.position[2]
        rat.state = data.state
      }
    }
  })

  // Listen for rats unregistering (death/destroy)
  world.on('rat:unregister', (data) => {
    RAT_REGISTRY.delete(data.appId)
    console.log(`[${mobName}] 🐀 Rat unregistered: ${data.appId}, remaining: ${RAT_REGISTRY.size}`)
  })

  // ============================================================================
  // AI STATE VARIABLES
  // ============================================================================

  let currentState = 'idle'
  let targetPlayer = null
  let lastAttackTime = 0
  let lastIdleVariation = 0
  let lastIdleSound = 0
  let attackComboCount = 0
  let hasPlayedSurprisedSound = false

  // Boid state variables
  // Initialize with small random velocity to break boid force symmetry
  let velocity = {
    x: (Math.random() - 0.5) * 2.0,  // Random [-1.0, 1.0]
    y: 0,
    z: (Math.random() - 0.5) * 2.0
  }

  // Normalize to small magnitude (0.5 - 1.5 m/s) for gentle initial wandering
  const velocityMag = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)
  if (velocityMag > 0.01) {
    const targetMag = 0.5 + Math.random() * 1.0  // Random [0.5, 1.5]
    velocity.x = (velocity.x / velocityMag) * targetMag
    velocity.z = (velocity.z / velocityMag) * targetMag
  }

  let acceleration = { x: 0, y: 0, z: 0 }
  let lastBoidUpdate = 0
  let lastPositionBroadcast = 0
  let obstacleCache = { time: 0, result: { x: 0, y: 0, z: 0 } }

  // Emit mob:spawn event for combat registration
  app.emit('mob:spawn', {
    name: mobName,
    health: 100,
    maxHealth: 100,
    damageMin: 5,
    damageMax: 10,
    aggressive: app.props.aggressive,
    detectionRange: app.props.detectionRange,
    attackRange: app.props.attackRange
  })

  // Handle mob:spawn response (from combat system)
  app.on('mob:spawn', (data) => {
    if (data && data.npcTypeId) {
      npcTypeId = data.npcTypeId
      spawnId = data.spawnId
      console.log(`[${mobName}] ✅ Combat registration confirmed:`, { npcTypeId, spawnId })
    }
  })

  /**
   * Play idle animation with variations
   */
  function playIdleAnimation() {
    let idleAnim = app.props.idleAnimName

    if (app.props.useVariedIdle) {
      if (Math.random() < 0.05) {
        idleAnim = pickRandom(ANIMATIONS.idleRare) || idleAnim
      } else {
        idleAnim = pickRandom(ANIMATIONS.idle) || idleAnim
      }
    }

    // Play eating sound for rat_idle_eat animation
    if (idleAnim === 'rat_idle_eat' && app.props.enableSounds) {
      app.send('playSound', { sound: 'rat_eating_chew', volume: 0.4 })
    }

    app.send('setAnimation', { animation: idleAnim })
  }

  /**
   * Enter chase state
   */
  function enterChaseState() {
    if (currentState !== 'chase') {
      currentState = 'chase'
      const chaseAnim = pickRandom(ANIMATIONS.chase) || app.props.walkAnimName
      console.log(`[${mobName}] 🏃 Entering chase state, animation: ${chaseAnim}`)
      app.send('setAnimation', { animation: chaseAnim })

      // Play movement sound
      if (app.props.enableSounds) {
        app.send('playRandomSound', {
          sounds: ['rat_footsteps_scurry', 'rat_movement_rustle'],
          volume: 0.3
        })
      }
    }
  }

  /**
   * Perform attack with animation + sound
   */
  function performAttack(target) {
    if (!world.combat || !target) return

    const mobState = world.combat.getMobState?.(app.id)
    if (!mobState) return

    const result = world.combat.attack(app.id, target.id)

    if (result && result.hit) {
      // Pick attack animation
      let attackAnim = app.props.attackAnimName
      let attackSound = null

      if (app.props.useVariedAttacks) {
        attackComboCount++
        if (attackComboCount % 3 === 0 && Math.random() < 0.2) {
          attackAnim = pickRandom(ANIMATIONS.attackRare) || attackAnim
          // Use roar sound for rat_roar animation
          if (attackAnim === 'rat_roar') {
            attackSound = 'rat_attack_roar'
          }
        } else {
          attackAnim = pickRandom(ANIMATIONS.attack) || attackAnim
        }
      }

      // Play attack sound
      if (app.props.enableSounds) {
        if (attackSound) {
          app.send('playSound', { sound: attackSound, volume: 0.8 })
        } else {
          app.send('playRandomSound', {
            sounds: ['rat_attack_bite_01', 'rat_attack_bite_02', 'rat_attack_lunge'],
            volume: 0.7
          })
        }
      }

      console.log(`[${mobName}] ⚔️  Attack: ${attackAnim}`)
      app.send('setAnimation', { animation: attackAnim })

      // Return to idle after attack
      setTimeout(() => {
        if (currentState === 'attack') {
          app.send('setAnimation', { animation: app.props.idleAnimName })
        }
      }, 800)
    }
  }

  /**
   * Handle death
   */
  function handleDeath() {
    console.log(`[${mobName}] 💀 Died`)

    // Play death sound
    if (app.props.enableSounds) {
      app.send('playSound', { sound: 'rat_death_squeal', volume: 0.9 })
    }

    app.send('setAnimation', {
      animation: app.props.deathAnimName,
      freeze: true
    })

    if (world.npcManager) {
      world.npcManager.onNPCDeath(app.id, {
        npcTypeId: npcTypeId,
        spawnId: spawnId
      })
    }
  }

  /**
   * Find nearest player
   */
  function findNearestPlayer(players) {
    if (!players || players.length === 0 || !app.position) return null

    let nearest = null
    let minDistance = app.props.detectionRange

    for (const p of players) {
      if (!p || !p.position) continue
      const distance = getDistance(app.position, p.position)
      if (distance < minDistance) {
        minDistance = distance
        nearest = p
      }
    }

    return nearest
  }

  function getDistance(pos1, pos2) {
    const dx = pos2.x - pos1.x
    const dz = pos2.z - pos1.z
    return Math.sqrt(dx * dx + dz * dz)
  }

  function faceTarget(target) {
    if (!target || !target.position || !app.position) return

    const dx = target.position.x - app.position.x
    const dz = target.position.z - app.position.z
    const yaw = Math.atan2(dx, dz)

    if (app.rotation) {
      app.rotation.x = 0
      app.rotation.y = yaw
      app.rotation.z = 0
    }

    app.send('pose', {
      p: [app.position.x, app.position.y || 0, app.position.z],
      yaw: yaw
    })
  }

  function moveToward(target, delta) {
    if (!target || !target.position || !app.position) return

    const dx = target.position.x - app.position.x
    const dz = target.position.z - app.position.z
    const distance = Math.sqrt(dx * dx + dz * dz)

    if (distance === 0) return

    const step = Math.min(app.props.moveSpeed * delta, distance - app.props.attackRange)
    const nx = app.position.x + (dx / distance) * step
    const nz = app.position.z + (dz / distance) * step
    const yaw = Math.atan2(dx, dz)

    app.position.x = nx
    app.position.z = nz

    if (app.rotation) {
      app.rotation.x = 0
      app.rotation.y = yaw
      app.rotation.z = 0
    }

    app.send('pose', {
      p: [nx, app.position.y || 0, nz],
      yaw: yaw
    })
  }

  // ============================================================================
  // BOID CALCULATIONS
  // ============================================================================

  /**
   * Find nearby rats from spawn group + neighbors
   */
  function findNearbyRats(radius) {
    const nearby = []
    const myPos = app.position

    // Get current spawn group + 8 neighbors
    const gridSize = app.props.spawnGroupSize
    const centerX = Math.floor(myPos.x / gridSize) * gridSize
    const centerZ = Math.floor(myPos.z / gridSize) * gridSize

    const groups = []
    for (let dx = -gridSize; dx <= gridSize; dx += gridSize) {
      for (let dz = -gridSize; dz <= gridSize; dz += gridSize) {
        groups.push(`spawn_${centerX + dx}_${centerZ + dz}`)
      }
    }

    // Check rats in relevant groups
    for (const [id, rat] of RAT_REGISTRY) {
      if (id === app.instanceId) continue
      if (!groups.includes(rat.spawnGroupId)) continue

      const dx = rat.position.x - myPos.x
      const dz = rat.position.z - myPos.z
      const distSq = dx * dx + dz * dz

      if (distSq <= radius * radius) {
        nearby.push({
          id: id,
          position: rat.position,
          state: rat.state,
          distance: Math.sqrt(distSq)
        })
      }
    }

    return nearby
  }

  /**
   * Separation: Avoid crowding neighbors
   */
  function calculateSeparation(neighbors) {
    const steer = { x: 0, y: 0, z: 0 }
    let count = 0

    for (const neighbor of neighbors) {
      if (neighbor.distance < app.props.boidSeparationRadius) {
        const dx = app.position.x - neighbor.position.x
        const dz = app.position.z - neighbor.position.z
        const dist = neighbor.distance || 0.01

        // Inverse square law for stronger repulsion at close range
        const weight = 1.0 / (dist * dist)
        steer.x += dx * weight
        steer.z += dz * weight
        count++
      }
    }

    if (count > 0) {
      steer.x /= count
      steer.z /= count
    }

    return steer
  }

  /**
   * Alignment: Match velocity with neighbors
   */
  function calculateAlignment(neighbors) {
    const avgVel = { x: 0, y: 0, z: 0 }
    let count = 0

    for (const neighbor of neighbors) {
      // Approximate velocity from position delta (stored in registry)
      const rat = RAT_REGISTRY.get(neighbor.id)
      if (rat && rat.velocity) {
        avgVel.x += rat.velocity.x
        avgVel.z += rat.velocity.z
        count++
      }
    }

    if (count > 0) {
      avgVel.x /= count
      avgVel.z /= count

      // Steering = desired - current
      avgVel.x -= velocity.x
      avgVel.z -= velocity.z
    }

    return avgVel
  }

  /**
   * Cohesion: Move toward group center
   */
  function calculateCohesion(neighbors) {
    const center = { x: 0, y: 0, z: 0 }
    let count = 0

    for (const neighbor of neighbors) {
      center.x += neighbor.position.x
      center.z += neighbor.position.z
      count++
    }

    if (count > 0) {
      center.x /= count
      center.z /= count

      // Steer toward center
      const steer = {
        x: center.x - app.position.x,
        y: 0,
        z: center.z - app.position.z
      }

      return steer
    }

    return { x: 0, y: 0, z: 0 }
  }

  /**
   * Obstacle Avoidance: Raycast in 5 directions, steer away from walls
   */
  function calculateObstacleAvoidance() {
    const now = Date.now()

    // Use cached results if fresh (200ms)
    if (now - obstacleCache.time < 200) {
      return obstacleCache.result || { x: 0, y: 0, z: 0 }
    }

    const steer = { x: 0, y: 0, z: 0 }
    const rayLength = 3.0
    const angles = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3] // 0°, ±30°, ±60°

    const currentYaw = app.rotation?.y || 0
    const layerMask = world.createLayerMask('environment')

    for (const angle of angles) {
      const yaw = currentYaw + angle
      // ✅ FIXED: Use Vector3 (exposed by Hyperfy sandbox, world.raycast requires Vector3 with isVector3 property)
      const direction = new Vector3(Math.sin(yaw), 0, Math.cos(yaw))

      const hit = world.raycast(
        app.position,
        direction,
        rayLength,
        layerMask
      )

      if (hit) {
        // Steer perpendicular to obstacle
        const normal = hit.normal || { x: -direction.x, y: 0, z: -direction.z }
        const weight = (rayLength - hit.distance) / rayLength // Stronger avoidance for closer obstacles

        steer.x += normal.x * weight
        steer.z += normal.z * weight
      }
    }

    // Cache result
    obstacleCache = {
      time: now,
      result: steer
    }

    return steer
  }

  /**
   * Apply boid forces and return blended movement direction
   */
  function getBlendedMovement(target, delta) {
    const now = Date.now()

    // Only recalculate boids every boidUpdateRate ms (default 200ms = 5Hz)
    if (now - lastBoidUpdate < app.props.boidUpdateRate) {
      // Return cached movement
      return { velocity, shouldMove: true }
    }

    lastBoidUpdate = now

    // Find nearby rats
    const neighbors = findNearbyRats(app.props.boidPerceptionRadius)

    // Calculate boid forces
    const separation = calculateSeparation(neighbors)
    const alignment = calculateAlignment(neighbors)
    const cohesion = calculateCohesion(neighbors)
    const obstacle = calculateObstacleAvoidance()

    // Blend forces based on AI state
    let boidWeight = 1.0
    let targetWeight = 0.0

    if (currentState === 'chase' && target) {
      boidWeight = 0.4 // 40% boids for coordinated hunting
      targetWeight = 0.6 // 60% direct pursuit
    } else if (currentState === 'idle') {
      boidWeight = 1.0 // 100% boids for natural wandering
      targetWeight = 0.0
    } else if (currentState === 'attack') {
      boidWeight = 0.0 // No boids during attack
      targetWeight = 1.0
    }

    // Reset acceleration
    acceleration.x = 0
    acceleration.z = 0

    // Apply weighted boid forces
    if (app.props.boidEnabled && boidWeight > 0) {
      acceleration.x += separation.x * app.props.boidSeparationWeight * boidWeight
      acceleration.z += separation.z * app.props.boidSeparationWeight * boidWeight

      acceleration.x += alignment.x * app.props.boidAlignmentWeight * boidWeight
      acceleration.z += alignment.z * app.props.boidAlignmentWeight * boidWeight

      acceleration.x += cohesion.x * app.props.boidCohesionWeight * boidWeight
      acceleration.z += cohesion.z * app.props.boidCohesionWeight * boidWeight

      acceleration.x += obstacle.x * app.props.boidObstacleWeight * boidWeight
      acceleration.z += obstacle.z * app.props.boidObstacleWeight * boidWeight
    }

    // Add target pursuit force
    if (target && target.position && targetWeight > 0) {
      const dx = target.position.x - app.position.x
      const dz = target.position.z - app.position.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist > 0) {
        acceleration.x += (dx / dist) * targetWeight * 2.0
        acceleration.z += (dz / dist) * targetWeight * 2.0
      }
    }

    // Limit acceleration
    const accelMag = Math.sqrt(acceleration.x * acceleration.x + acceleration.z * acceleration.z)
    if (accelMag > app.props.boidMaxForce) {
      acceleration.x = (acceleration.x / accelMag) * app.props.boidMaxForce
      acceleration.z = (acceleration.z / accelMag) * app.props.boidMaxForce
    }

    // Update velocity
    velocity.x += acceleration.x * delta
    velocity.z += acceleration.z * delta

    // Limit velocity to moveSpeed
    const velMag = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)
    if (velMag > app.props.moveSpeed) {
      velocity.x = (velocity.x / velMag) * app.props.moveSpeed
      velocity.z = (velocity.z / velMag) * app.props.moveSpeed
    }

    // Store velocity in registry for other rats
    const rat = RAT_REGISTRY.get(app.instanceId)
    if (rat) {
      rat.velocity = { x: velocity.x, y: 0, z: velocity.z }
    }

    return { velocity, shouldMove: velMag > 0.01 }
  }

  // ============================================================================
  // MAIN AI UPDATE LOOP
  // ============================================================================
  app.on('update', (delta) => {
    const now = Date.now()

    // Check if dead
    if (world.combat && world.combat.getMobState) {
      const mobState = world.combat.getMobState(app.id)
      if (mobState && mobState.state === 'dead') {
        if (currentState !== 'dead') {
          currentState = 'dead'
          handleDeath()
        }
        return
      }

      // Play pain sound when taking damage (health decreased)
      if (mobState && mobState.lastDamageTime &&
          now - mobState.lastDamageTime < 100 &&
          app.props.enableSounds) {
        app.send('playRandomSound', {
          sounds: ['rat_pain_01', 'rat_pain_02'],
          volume: 0.6
        })
      }
    }

    if (!app.props.aggressive) {
      if (currentState !== 'idle') {
        currentState = 'idle'
        playIdleAnimation()
      }
      return
    }

    const players = world.getPlayers()
    const nearest = findNearestPlayer(players)

    if (!nearest) {
      if (currentState !== 'idle') {
        currentState = 'idle'
        targetPlayer = null
        hasPlayedSurprisedSound = false
        playIdleAnimation()
      } else {
        // Idle boid wandering with nearby rats
        const movement = getBlendedMovement(null, delta)

        if (movement.shouldMove) {
          app.position.x += movement.velocity.x * delta
          app.position.z += movement.velocity.z * delta

          // Update rotation based on movement direction
          const velMag = Math.sqrt(movement.velocity.x * movement.velocity.x + movement.velocity.z * movement.velocity.z)
          if (velMag > 0.1 && app.rotation) {
            const yaw = Math.atan2(movement.velocity.x, movement.velocity.z)
            app.rotation.x = 0
            app.rotation.y = yaw
            app.rotation.z = 0
          }

          // Broadcast position (5Hz)
          if (now - lastPositionBroadcast >= 200) {
            lastPositionBroadcast = now
            app.send('pose', {
              p: [app.position.x, app.position.y || 0, app.position.z],
              yaw: app.rotation?.y || 0
            })

            app.emit('rat:position', {
              appId: app.instanceId,
              position: [app.position.x, app.position.y || 0, app.position.z],
              state: 'idle'
            })

            // Update registry
            const rat = RAT_REGISTRY.get(app.instanceId)
            if (rat) {
              rat.position.x = app.position.x
              rat.position.y = app.position.y || 0
              rat.position.z = app.position.z
              rat.state = 'idle'
            }
          }
        }

        // Idle variation
        if (app.props.useVariedIdle && now - lastIdleVariation > 10000) {
          lastIdleVariation = now
          playIdleAnimation()
        }

        // Random idle sounds (10% chance every 5 seconds)
        if (app.props.enableSounds && now - lastIdleSound > 5000 && Math.random() < 0.1) {
          lastIdleSound = now
          app.send('playRandomSound', {
            sounds: ['rat_idle_squeak_01', 'rat_idle_squeak_02', 'rat_idle_sniff', 'rat_idle_chitter'],
            volume: 0.4
          })
        }
      }
      return
    }

    const distance = getDistance(app.position, nearest.position)

    // Play surprised sound when first detecting player
    if (!hasPlayedSurprisedSound && distance < app.props.detectionRange && app.props.enableSounds) {
      hasPlayedSurprisedSound = true
      app.send('playSound', { sound: 'rat_surprised_squeak', volume: 0.6 })
    }

    // State transitions
    if (distance <= app.props.attackRange) {
      // ATTACK RANGE
      faceTarget(nearest)

      if (currentState === 'chase') {
        currentState = 'attack'
        // Play warning hiss when entering attack range
        if (app.props.enableSounds) {
          app.send('playSound', { sound: 'rat_warning_hiss', volume: 0.7 })
        }
        app.send('setAnimation', { animation: app.props.idleAnimName })
      }

      // Attack if cooldown ready
      if (now - lastAttackTime >= app.props.attackCooldown) {
        performAttack(nearest)
        lastAttackTime = now
      }

    } else if (distance <= app.props.detectionRange) {
      // CHASE RANGE
      enterChaseState()

      // Use boid-blended movement for coordinated hunting
      const movement = getBlendedMovement(nearest, delta)

      if (movement.shouldMove) {
        // Update position
        app.position.x += movement.velocity.x * delta
        app.position.z += movement.velocity.z * delta

        // Update rotation
        const yaw = Math.atan2(movement.velocity.x, movement.velocity.z)
        if (app.rotation) {
          app.rotation.x = 0
          app.rotation.y = yaw
          app.rotation.z = 0
        }

        // Broadcast position every 200ms (5Hz)
        if (now - lastPositionBroadcast >= 200) {
          lastPositionBroadcast = now

          app.send('pose', {
            p: [app.position.x, app.position.y || 0, app.position.z],
            yaw: yaw
          })

          // Broadcast to rat registry
          app.emit('rat:position', {
            appId: app.instanceId,
            position: [app.position.x, app.position.y || 0, app.position.z],
            state: currentState
          })

          // Update registry
          const rat = RAT_REGISTRY.get(app.instanceId)
          if (rat) {
            rat.position.x = app.position.x
            rat.position.y = app.position.y || 0
            rat.position.z = app.position.z
            rat.state = currentState
          }
        }
      }

    } else {
      // OUT OF RANGE
      if (currentState !== 'idle') {
        currentState = 'idle'
        targetPlayer = null
        hasPlayedSurprisedSound = false
        playIdleAnimation()
      }
    }
  })

  // ============================================================================
  // CLEANUP ON DESTROY
  // ============================================================================
  app.on('destroy', () => {
    console.log(`[${mobName}] 🗑️ Cleaning up, unregistering from RAT_REGISTRY`)
    app.emit('rat:unregister', { appId: app.instanceId })
    RAT_REGISTRY.delete(app.instanceId)
  })

  console.log(`[${mobName}] ✅ Server ready`)
}

// ============================================================================
// CLIENT-SIDE ANIMATION
// ============================================================================
if (world.isClient) {
  let currentAnim = null
  let animationNode = null

  console.log(`[${mobName}] 🎨 Client starting...`)

  // Note: Collider is added by MobColliderSystem from core game code
  // This avoids SES compartment async boundary issues

  /**
   * Find animation node (uses app.traverse like v19)
   */
  function findAnimationNode() {
    if (animationNode) return animationNode

    app.traverse(node => {
      if (node && node.play && node.anims && node.anims.length > 0) {
        animationNode = node
        console.log(`[${mobName}] ✅ Found ${node.anims.length} animations`)
        return true
      }
    })

    return animationNode
  }

  /**
   * Play animation (uses node.play like v19)
   */
  function playAnimation(animName, freeze = false) {
    const node = findAnimationNode()
    if (!node || !animName) return

    if (currentAnim === animName && !freeze) return

    const clips = node.anims || []
    let clipName = clips.find(c => c === animName)
    if (!clipName) {
      clipName = clips.find(c => c && c.toLowerCase().includes(animName.toLowerCase()))
    }
    if (!clipName) {
      clipName = clips[0]
    }

    if (!clipName) {
      console.warn(`[${mobName}] No animation found for "${animName}"`)
      return
    }

    try {
      if (freeze) {
        node.play({ name: clipName, fade: 0.15, loop: false, speed: 1 })
        setTimeout(() => {
          if (node.action) {
            node.action.paused = true
            node.action.timeScale = 0
          }
        }, 2700)
      } else {
        const isAttack = animName.includes('attack') || animName.includes('roar') || animName.includes('butting')
        const loop = !isAttack
        node.play({ name: clipName, fade: 0.15, loop: loop })
      }

      currentAnim = animName
      console.log(`[${mobName}] ▶️  ${clipName}`)
    } catch (error) {
      console.error(`[${mobName}] Animation error:`, error)
    }
  }

  /**
   * Handle animation changes from server
   */
  app.on('setAnimation', (data) => {
    if (!data) return
    if (data.animation) {
      playAnimation(data.animation, data.freeze)
    }
  })

  console.log(`[${mobName}] ✅ Client ready`)
}

console.log(`[${mobName}] ✅ Rat v24 loaded (Embedded Sounds - Scalable Architecture)`)
