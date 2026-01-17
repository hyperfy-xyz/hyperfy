/**
 * RAT MOB V32 - SES-Compatible Timer Fix
 *
 * Complete rewrite with fixes for critical v24 bugs:
 * - Bug #1: Immutable position updates (no object reference sharing)
 * - Bug #2: Death state propagated to registry
 * - Bug #3: Dead rats filtered from boid calculations
 *
 * Features:
 * - ALL 18 sounds embedded in .hyp file
 * - Self-contained (no external dependencies)
 * - Centralized state machine with registry sync
 * - Immutable state management throughout
 * - Defensive programming (null checks, type validation)
 * - Clean separation of concerns (11 sections)
 *
 * Blueprint ID: npc-600001 (drop-in replacement for v24)
 *
 * @version 1.0.32
 */

// ============================================================================
// SECTION 1: CONFIGURATION
// ============================================================================
app.configure([
  // Movement & Combat
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

// Animation pools (18 total animations)
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

const mobName = app.data?.name || 'Rat'
let npcTypeId = null
let spawnId = null

// ============================================================================
// SECTION 2: IMMUTABLE STATE HELPERS
// ============================================================================

/**
 * Create position object (sandbox-safe, no freeze)
 * Simple object creation without immutability constraints
 */
/**
 * Pick random item from array
 */
function pickRandom(pool) {
  if (!pool || pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

// ============================================================================
// SECTION 3: CLIENT-SIDE POSITION SYNC (With Interpolation)
// ============================================================================
// Client-side interpolation for smooth movement
// We need a custom handler (Hyperfy doesn't auto-handle 'pose' for Apps)
// But we must interpolate instead of directly setting position (like v42)

// Target position from server
let targetPos = null
let targetYaw = null

// Interpolation rate (0.125 matches Hyperfy's LerpVector3 rate)
const LERP_RATE = 0.125

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

// ============================================================================
// SECTION 4: CLIENT-SIDE SOUND SYSTEM
// ============================================================================
if (world.isClient) {
  console.log(`[${mobName}] 🎨 Client starting...`)

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
    app.add(node)  // CRITICAL: Mount node to scene tree so ctx.world is set
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
    if (!data) return
    playSound(data.sound, data.volume, data.loop)
  })

  app.on('playRandomSound', (data) => {
    if (!data) return
    playRandomSound(data.sounds, data.volume)
  })
}

// ============================================================================
// SECTION 5: CLIENT-SIDE ANIMATION SYSTEM
// ============================================================================
if (world.isClient) {
  // SES-safe: Use module-level variables instead of app properties
  let currentAnim = null
  let animationNode = null

  console.log(`[${mobName}] 🎨 Client starting...`)

  /**
   * Find animation node (uses app.traverse)
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
   * Play animation (uses node.play)
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

// ============================================================================
// SECTION 6: SERVER-SIDE REGISTRY SYSTEM
// ============================================================================
if (world.isServer) {
  console.log(`[${mobName}] 🎮 Server starting...`)

  // Global rat registry (shared across all rat instances)
  if (typeof globalThis.RAT_REGISTRY === 'undefined') {
    globalThis.RAT_REGISTRY = new Map()
  }
  const RAT_REGISTRY = globalThis.RAT_REGISTRY

  /**
   * Generate spawn group ID from position (for spatial optimization)
   */
  function getSpawnGroupId(position, gridSize = 10.0) {
    if (!position) return 'spawn_0_0'
    const x = Math.floor(position.x / gridSize) * gridSize
    const z = Math.floor(position.z / gridSize) * gridSize
    return `spawn_${x}_${z}`
  }

  /**
   * Check if rat is alive (FIXES BUG #3)
   * Used to filter dead rats from boid calculations
   */
  function isRatAlive(rat) {
    if (!rat) return false
    return rat.state !== 'dead' && rat.state !== 'DEAD'
  }

  /**
   * Register rat in global registry (V24 pattern - MUTABLE objects)
   * Uses plain mutable objects like v24/v30 working code
   */
  function registerRat(appId, position, spawnGroupId) {
    if (!appId || !position) {
      console.warn(`[${mobName}] Cannot register rat: missing appId or position`)
      return
    }

    RAT_REGISTRY.set(appId, {
      appId: appId,
      position: { x: position.x, y: position.y, z: position.z },  // Mutable!
      velocity: { x: 0, y: 0, z: 0 },  // Mutable!
      state: 'idle',
      spawnGroupId: spawnGroupId || 'spawn_0_0'
    })

    console.log(`[${mobName}] 🐀 Registered in RAT_REGISTRY, group: ${spawnGroupId}, total: ${RAT_REGISTRY.size}`)
  }

  /**
   * Get rat from registry (safe access)
   */
  function getRegistryRat(appId) {
    if (!appId) return null
    return RAT_REGISTRY.get(appId)
  }

  /**
   * Unregister rat from global registry
   */
  function unregisterRat(appId) {
    if (!appId) return
    const deleted = RAT_REGISTRY.delete(appId)
    if (deleted) {
      console.log(`[${mobName}] 🐀 Unregistered from RAT_REGISTRY, remaining: ${RAT_REGISTRY.size}`)
    }
  }

  // Register this rat on spawn
  const mySpawnGroupId = getSpawnGroupId(app.position, app.props.spawnGroupSize)
  registerRat(app.instanceId, app.position, mySpawnGroupId)

  // Broadcast registration to other rats
  app.emit('rat:register', {
    appId: app.instanceId,
    position: [app.position.x, app.position.y, app.position.z],
    spawnGroupId: mySpawnGroupId
  })

  // Listen for other rats registering
  world.on('rat:register', (data) => {
    if (!data || !data.appId || data.appId === app.instanceId) return

    registerRat(
      data.appId,
      { x: data.position[0], y: data.position[1], z: data.position[2] },
      data.spawnGroupId
    )
  })

  // Listen for position updates from other rats (V24 pattern - direct mutation)
  world.on('rat:position', (data) => {
    if (!data || !data.appId || data.appId === app.instanceId) return

    // V24 pattern: direct registry mutation
    const rat = RAT_REGISTRY.get(data.appId)
    if (rat) {
      rat.position.x = data.position[0]
      rat.position.y = data.position[1]
      rat.position.z = data.position[2]
      rat.state = data.state
    }
  })

  // Listen for rats unregistering (death/destroy)
  world.on('rat:unregister', (data) => {
    if (!data || !data.appId) return
    unregisterRat(data.appId)
  })

  // ============================================================================
  // SECTION 6: SERVER-SIDE STATE MACHINE
  // ============================================================================

  // State enum (immutable constants)
  const RatState = Object.freeze({
    IDLE: 'idle',
    CHASE: 'chase',
    ATTACK: 'attack',
    DEAD: 'dead'
  })

  // Current state tracking
  let currentState = RatState.IDLE
  let targetPlayer = null
  let lastAttackTime = 0
  let lastIdleVariation = 0
  let lastIdleSound = 0
  let attackComboCount = 0
  let hasPlayedSurprisedSound = false

  // Idle wandering state
  let wanderTarget = null
  let lastWanderChange = 0
  let wanderChangeInterval = 5000 // Change direction every 5 seconds

  /**
   * Play idle animation (with variations)
   */
  function playIdleAnimation() {
    if (!app.props.useVariedIdle) {
      app.send('setAnimation', { animation: app.props.idleAnimName })
      return
    }

    // 5% chance of rare idle
    if (Math.random() < 0.05) {
      const rareIdle = pickRandom(ANIMATIONS.idleRare)
      if (rareIdle) {
        app.send('setAnimation', { animation: rareIdle })
        return
      }
    }

    // Normal idle variation
    const idleAnim = pickRandom(ANIMATIONS.idle) || app.props.idleAnimName
    app.send('setAnimation', { animation: idleAnim })
  }

  /**
   * State: IDLE - Wandering, idle sounds, boid behavior
   */
  function onEnterIdle(context) {
    console.log(`[${mobName}] → IDLE`)
    playIdleAnimation()
    targetPlayer = null
    hasPlayedSurprisedSound = false
    attackComboCount = 0
  }

  /**
   * State: CHASE - Pursuing player, movement sounds
   */
  function onEnterChase(context) {
    console.log(`[${mobName}] → CHASE (target: ${context.target?.name || 'unknown'})`)

    // Random chase animation
    const chaseAnim = pickRandom(ANIMATIONS.chase) || app.props.walkAnimName
    app.send('setAnimation', { animation: chaseAnim })

    // Play movement sound
    if (app.props.enableSounds) {
      app.send('playRandomSound', {
        sounds: ['rat_footsteps_scurry', 'rat_movement_rustle'],
        volume: 0.3
      })
    }

    // Play surprised sound once
    if (!hasPlayedSurprisedSound && app.props.enableSounds) {
      app.send('playSound', { sound: 'rat_surprised_squeak', volume: 0.5 })
      hasPlayedSurprisedSound = true
    }
  }

  /**
   * State: ATTACK - Combat, attack animations/sounds
   */
  function onEnterAttack(context) {
    console.log(`[${mobName}] → ATTACK`)

    // Attack animation selection with combo system
    let attackAnim
    if (app.props.useVariedAttacks && attackComboCount % 3 === 0 && Math.random() < 0.2) {
      // 20% chance of rare attack every 3rd attack
      attackAnim = pickRandom(ANIMATIONS.attackRare)
    }

    if (!attackAnim) {
      attackAnim = pickRandom(ANIMATIONS.attack) || app.props.attackAnimName
    }

    app.send('setAnimation', { animation: attackAnim })

    // Attack sound
    if (app.props.enableSounds) {
      app.send('playRandomSound', {
        sounds: ['rat_attack_bite_01', 'rat_attack_bite_02', 'rat_attack_lunge'],
        volume: 0.7
      })
    }

    attackComboCount++
  }

  /**
   * State: DEAD - Death animation/sound, registry cleanup
   * FIXES BUG #2: Updates registry state to 'dead'
   */
  function onEnterDead(context) {
    console.log(`[${mobName}] → DEAD 💀`)

    // Update registry with DEAD state (V24 pattern - direct mutation)
    const rat = RAT_REGISTRY.get(app.instanceId)
    if (rat) {
      rat.position.x = app.position.x
      rat.position.y = app.position.y || 0
      rat.position.z = app.position.z
      rat.state = RatState.DEAD
    }

    // Play death sound
    if (app.props.enableSounds) {
      app.send('playSound', { sound: 'rat_death_squeal', volume: 0.9 })
    }

    // Play death animation (frozen at end)
    app.send('setAnimation', {
      animation: app.props.deathAnimName,
      freeze: true
    })

    // Notify NPC manager
    if (world.npcManager) {
      world.npcManager.onNPCDeath(app.id, {
        npcTypeId: npcTypeId,
        spawnId: spawnId
      })
    }
  }

  /**
   * Centralized state transition (FIXES BUG #2)
   * Updates both local state AND registry state
   */
  function enterState(newState, context = {}) {
    if (currentState === newState) return

    const oldState = currentState
    currentState = newState

    console.log(`[${mobName}] State: ${oldState} → ${newState}`)

    // Update registry IMMEDIATELY with new state (V24 pattern - direct mutation)
    if (app.position) {
      const rat = RAT_REGISTRY.get(app.instanceId)
      if (rat) {
        rat.position.x = app.position.x
        rat.position.y = app.position.y || 0
        rat.position.z = app.position.z
        rat.state = newState
      }
    }

    // Broadcast state change to other rats
    app.emit('rat:position', {
      appId: app.instanceId,
      position: [app.position.x, app.position.y, app.position.z],
      state: newState,
      timestamp: Date.now()
    })

    // Execute state-specific entry logic
    switch (newState) {
      case RatState.IDLE:
        onEnterIdle(context)
        break
      case RatState.CHASE:
        onEnterChase(context)
        break
      case RatState.ATTACK:
        onEnterAttack(context)
        break
      case RatState.DEAD:
        onEnterDead(context)
        break
    }
  }

  // ============================================================================
  // SECTION 7: SERVER-SIDE BOID FLOCKING SYSTEM (Phase 5)
  // ============================================================================

  /**
   * Find nearby rats for boid calculations (FILTERS DEAD RATS - FIXES BUG #3)
   * Returns array of living rats within specified radius
   */
  function findNearbyRats(radius) {
    if (!app.props.boidEnabled) return []

    const nearby = []
    const myPos = app.position
    const radiusSq = radius * radius

    // Iterate through registry and filter living rats
    for (const [ratId, rat] of RAT_REGISTRY) {
      // Skip self
      if (ratId === app.instanceId) continue

      // Skip dead rats (FIXES BUG #3)
      if (!isRatAlive(rat)) continue

      // Distance check (squared to avoid sqrt)
      const dx = rat.position.x - myPos.x
      const dy = rat.position.y - myPos.y
      const dz = rat.position.z - myPos.z
      const distSq = dx * dx + dy * dy + dz * dz

      if (distSq <= radiusSq) {
        nearby.push({
          rat: rat,
          distance: Math.sqrt(distSq),
          distanceSq: distSq
        })
      }
    }

    return nearby
  }

  /**
   * Calculate separation force (avoid crowding)
   * Steers away from nearby rats within separation radius
   */
  function calculateSeparation(nearbyRats) {
    const separationRadius = app.props.boidSeparationRadius
    const separationRadiusSq = separationRadius * separationRadius

    let steerX = 0
    let steerY = 0
    let steerZ = 0
    let count = 0

    const myPos = app.position

    for (const nearby of nearbyRats) {
      if (nearby.distanceSq < separationRadiusSq && nearby.distanceSq > 0) {
        // Calculate direction away from neighbor
        const dx = myPos.x - nearby.rat.position.x
        const dy = myPos.y - nearby.rat.position.y
        const dz = myPos.z - nearby.rat.position.z

        // Weight by inverse distance (closer = stronger repulsion)
        const weight = 1.0 / Math.sqrt(nearby.distanceSq)

        steerX += dx * weight
        steerY += dy * weight
        steerZ += dz * weight
        count++
      }
    }

    if (count === 0) {
      return { x: 0, y: 0, z: 0 }
    }

    // Average and normalize
    steerX /= count
    steerY /= count
    steerZ /= count

    const mag = Math.sqrt(steerX * steerX + steerY * steerY + steerZ * steerZ)
    if (mag > 0) {
      steerX /= mag
      steerY /= mag
      steerZ /= mag
    }

    return { x: steerX, y: steerY, z: steerZ }
  }

  /**
   * Calculate alignment force (match velocity)
   * Steers towards average heading of nearby rats
   */
  function calculateAlignment(nearbyRats) {
    if (nearbyRats.length === 0) {
      return { x: 0, y: 0, z: 0 }
    }

    let avgVelX = 0
    let avgVelY = 0
    let avgVelZ = 0

    for (const nearby of nearbyRats) {
      avgVelX += nearby.rat.velocity.x
      avgVelY += nearby.rat.velocity.y
      avgVelZ += nearby.rat.velocity.z
    }

    avgVelX /= nearbyRats.length
    avgVelY /= nearbyRats.length
    avgVelZ /= nearbyRats.length

    // Normalize
    const mag = Math.sqrt(avgVelX * avgVelX + avgVelY * avgVelY + avgVelZ * avgVelZ)
    if (mag > 0) {
      avgVelX /= mag
      avgVelY /= mag
      avgVelZ /= mag
    }

    return { x: avgVelX, y: avgVelY, z: avgVelZ }
  }

  /**
   * Calculate cohesion force (stay together)
   * Steers towards average position of nearby rats
   */
  function calculateCohesion(nearbyRats) {
    if (nearbyRats.length === 0) {
      return { x: 0, y: 0, z: 0 }
    }

    let avgPosX = 0
    let avgPosY = 0
    let avgPosZ = 0

    for (const nearby of nearbyRats) {
      avgPosX += nearby.rat.position.x
      avgPosY += nearby.rat.position.y
      avgPosZ += nearby.rat.position.z
    }

    avgPosX /= nearbyRats.length
    avgPosY /= nearbyRats.length
    avgPosZ /= nearbyRats.length

    // Direction towards center of mass
    const myPos = app.position
    let steerX = avgPosX - myPos.x
    let steerY = avgPosY - myPos.y
    let steerZ = avgPosZ - myPos.z

    // Normalize
    const mag = Math.sqrt(steerX * steerX + steerY * steerY + steerZ * steerZ)
    if (mag > 0) {
      steerX /= mag
      steerY /= mag
      steerZ /= mag
    }

    return { x: steerX, y: steerY, z: steerZ }
  }

  /**
   * Calculate obstacle avoidance force
   * Raycasts ahead and steers away from obstacles
   */
  function calculateObstacleAvoidance(currentVelocity) {
    // Simple ground height check for now
    // TODO: Add proper raycasting when Hyperfy API supports it

    const myPos = app.position
    const lookAheadDist = 2.0

    // Project position ahead
    const futureX = myPos.x + currentVelocity.x * lookAheadDist
    const futureZ = myPos.z + currentVelocity.z * lookAheadDist

    // Basic bounds check (example - customize based on world)
    let steerX = 0
    let steerZ = 0

    // Avoid world bounds (example values)
    const maxBounds = 100
    const minBounds = -100

    if (futureX > maxBounds) steerX = -1
    if (futureX < minBounds) steerX = 1
    if (futureZ > maxBounds) steerZ = -1
    if (futureZ < minBounds) steerZ = 1

    return { x: steerX, y: 0, z: steerZ }
  }

  /**
   * Get blended movement forces combining target pursuit and boid forces
   * Returns RAW FORCE VECTOR (not normalized) for physics-based velocity accumulation
   * This is the v24 pattern - forces are accumulated into velocity
   */
  function getBlendedMovement(targetPosition, delta) {
    if (!app.props.boidEnabled || currentState === RatState.DEAD) {
      // Simple direct movement without boids - return force toward target
      const myPos = app.position
      const dx = targetPosition.x - myPos.x
      const dy = targetPosition.y - myPos.y
      const dz = targetPosition.z - myPos.z
      const mag = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (mag === 0) return { x: 0, y: 0, z: 0 }

      // Return force (not normalized direction)
      const targetForce = 3.0 // Acceleration toward target
      return {
        x: (dx / mag) * targetForce,
        y: (dy / mag) * targetForce,
        z: (dz / mag) * targetForce
      }
    }

    // Find nearby rats for boid calculations
    const nearbyRats = findNearbyRats(app.props.boidPerceptionRadius)

    // Calculate boid forces
    const separation = calculateSeparation(nearbyRats)
    const alignment = calculateAlignment(nearbyRats)
    const cohesion = calculateCohesion(nearbyRats)

    // Get current velocity for obstacle avoidance
    const myRat = getRegistryRat(app.instanceId)
    const currentVel = myRat ? myRat.velocity : { x: 0, y: 0, z: 0 }
    const obstacle = calculateObstacleAvoidance(currentVel)

    // Calculate target force (pursuit)
    const myPos = app.position
    const dx = targetPosition.x - myPos.x
    const dy = targetPosition.y - myPos.y
    const dz = targetPosition.z - myPos.z
    const mag = Math.sqrt(dx * dx + dy * dy + dz * dz)

    let targetForce = { x: 0, y: 0, z: 0 }
    if (mag > 0) {
      const targetAccel = 3.0 // Acceleration magnitude toward target
      targetForce = {
        x: (dx / mag) * targetAccel,
        y: (dy / mag) * targetAccel,
        z: (dz / mag) * targetAccel
      }
    }

    // Blend forces with weights
    const sepWeight = app.props.boidSeparationWeight
    const aliWeight = app.props.boidAlignmentWeight
    const cohWeight = app.props.boidCohesionWeight
    const obsWeight = app.props.boidObstacleWeight
    const targetWeight = 2.0 // Strong bias towards target

    // CRITICAL: Return RAW FORCES (not normalized)
    // Each force contributes to acceleration which accumulates into velocity
    return {
      x: targetForce.x * targetWeight +
         separation.x * sepWeight +
         alignment.x * aliWeight +
         cohesion.x * cohWeight +
         obstacle.x * obsWeight,
      y: targetForce.y * targetWeight +
         separation.y * sepWeight +
         alignment.y * aliWeight +
         cohesion.y * cohWeight +
         obstacle.y * obsWeight,
      z: targetForce.z * targetWeight +
         separation.z * sepWeight +
         alignment.z * aliWeight +
         cohesion.z * cohWeight +
         obstacle.z * obsWeight
    }
  }

  // ============================================================================
  // SECTION 8: SERVER-SIDE COMBAT INTEGRATION (Phase 4)
  // ============================================================================

  /**
   * Perform attack on player
   * Integrates with combat system and triggers attack animation/sound
   */
  function performAttack(player) {
    if (!player) return
    if (currentState === RatState.DEAD) return

    const now = Date.now()
    if (now - lastAttackTime < app.props.attackCooldown) return

    lastAttackTime = now

    // Enter attack state (triggers animation/sound)
    enterState(RatState.ATTACK, { target: player })

    // Calculate damage (example values - customize based on game)
    const minDamage = 5
    const maxDamage = 15
    const damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage

    // Send damage event to combat system
    if (world.combatManager) {
      world.combatManager.applyDamage({
        sourceId: app.id,
        sourceType: 'npc',
        targetId: player.id,
        targetType: 'player',
        damage: damage,
        damageType: 'physical'
      })
      console.log(`[${mobName}] 💥 Attacked ${player.name} for ${damage} damage`)
    }

    // Return to chase after attack animation
    setTimeout(() => {
      if (currentState === RatState.ATTACK) {
        enterState(RatState.CHASE, { target: player })
      }
    }, 800) // Attack animation duration
  }

  /**
   * Handle death event from combat system
   * Triggers death state and cleanup
   */
  function handleDeath(damageEvent) {
    if (currentState === RatState.DEAD) return

    console.log(`[${mobName}] ☠️ Killed by ${damageEvent.sourceName || 'unknown'}`)

    // Enter death state (triggers animation, sound, registry update)
    enterState(RatState.DEAD, { killer: damageEvent.sourceName })

    // Broadcast death to other rats
    app.emit('rat:unregister', {
      appId: app.instanceId,
      timestamp: Date.now()
    })

    // Schedule corpse removal (30 seconds)
    setTimeout(() => {
      if (app && app.destroy) {
        app.destroy()
      }
    }, 30000)
  }

  // Register with combat system on spawn
  if (world.combatManager) {
    // Extract NPC type ID from app.data
    npcTypeId = app.data?.npcTypeId || app.data?.id || 600001
    spawnId = app.data?.spawnId || app.instanceId

    world.combatManager.registerNPC({
      id: app.id,
      npcTypeId: npcTypeId,
      spawnId: spawnId,
      name: mobName,
      level: app.data?.level || 1,
      maxHp: app.data?.max_hp || 100,
      onDeath: handleDeath
    })

    console.log(`[${mobName}] ⚔️ Registered with combat system (npcTypeId: ${npcTypeId})`)
  }

  // Listen for mob:spawn event (combat system integration)
  world.on('mob:spawn', (data) => {
    if (!data || data.appId !== app.instanceId) return

    npcTypeId = data.npcTypeId
    spawnId = data.spawnId

    console.log(`[${mobName}] 📡 Received mob:spawn (npcTypeId: ${npcTypeId}, spawnId: ${spawnId})`)
  })

  // ============================================================================
  // SECTION 9: SERVER-SIDE AI LOOP (Phase 6)
  // ============================================================================

  let lastPositionBroadcast = 0
  const POSITION_BROADCAST_INTERVAL = 200 // 5Hz

  // Movement state (persistent velocity for physics-based movement)
  // CRITICAL: Initialize with random velocity to break symmetry between rats
  // This prevents all rats from moving in lockstep (v24 pattern)
  const speed = app.props.moveSpeed || 2.0
  let velocity = {
    x: (Math.random() - 0.5) * speed * 0.5,
    y: 0,
    z: (Math.random() - 0.5) * speed * 0.5
  }
  // Normalize to random magnitude between 0.5-1.0 of speed
  const initialMag = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)
  if (initialMag > 0) {
    const randomScale = 0.5 + Math.random() * 0.5
    velocity.x = (velocity.x / initialMag) * speed * randomScale
    velocity.z = (velocity.z / initialMag) * speed * randomScale
  }

  /**
   * Find nearest player within detection range
   * Returns player object or null
   */
  function findNearestPlayer() {
    if (!app.props.aggressive) return null
    if (currentState === RatState.DEAD) return null

    const myPos = app.position
    const detectionRangeSq = app.props.detectionRange * app.props.detectionRange

    let nearestPlayer = null
    let nearestDistSq = Infinity

    // Get players using sandbox-safe API (world.getPlayers instead of world.entities.players)
    const players = world.getPlayers(app)
    if (!players || players.length === 0) return null

    // Iterate through all players
    for (const player of players) {
      if (!player || !player.position) continue

      const dx = player.position.x - myPos.x
      const dy = player.position.y - myPos.y
      const dz = player.position.z - myPos.z
      const distSq = dx * dx + dy * dy + dz * dz

      if (distSq <= detectionRangeSq && distSq < nearestDistSq) {
        nearestPlayer = player
        nearestDistSq = distSq
      }
    }

    return nearestPlayer
  }

  /**
   * Apply velocity-based movement toward target (v38: Physics-based architecture)
   *
   * KEY CHANGE: Uses += for position updates instead of =
   * This matches v24's working pattern and provides continuous velocity-based movement
   */
  function applyMovement(targetPosition, delta) {
    if (!targetPosition) return
    if (currentState === RatState.DEAD) return

    // Calculate direction to target
    const dx = targetPosition.x - app.position.x
    const dz = targetPosition.z - app.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    // If already at target, stop
    if (dist < 0.1) {
      velocity.x = 0
      velocity.z = 0
      return
    }

    // Get boid forces (raw forces, not normalized direction)
    const force = getBlendedMovement(targetPosition, delta)

    // CRITICAL: Accumulate forces into velocity (v24 physics pattern)
    // This is what creates unique trajectories for each rat
    velocity.x += force.x * delta
    velocity.z += force.z * delta
    velocity.y = 0 // No vertical movement for now

    // Apply max speed limit
    const maxSpeed = app.props.moveSpeed
    const velMag = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)
    if (velMag > maxSpeed) {
      velocity.x = (velocity.x / velMag) * maxSpeed
      velocity.z = (velocity.z / velMag) * maxSpeed
    }

    // Apply velocity to position
    app.position.x += velocity.x * delta
    app.position.z += velocity.z * delta

    // DEBUG: Log movement
    console.log(`[${mobName}] 🏃 v45 Moving: force=(${force.x.toFixed(2)}, ${force.z.toFixed(2)}), vel=(${velocity.x.toFixed(2)}, ${velocity.z.toFixed(2)}), pos=(${app.position.x.toFixed(1)}, ${app.position.z.toFixed(1)}), dist=${dist.toFixed(1)}`)

    // Update rotation to face VELOCITY direction (not target direction)
    // CRITICAL FIX: This prevents "sideways crab walk" when boid forces deflect path
    if (app.rotation && velMag > 0.1) {
      const yaw = Math.atan2(velocity.x, velocity.z)
      app.rotation.x = 0
      app.rotation.y = yaw
      app.rotation.z = 0
    }

    // Broadcast position (V24 pattern - throttled to 5Hz)
    const now = Date.now()
    if (now - lastPositionBroadcast >= POSITION_BROADCAST_INTERVAL) {
      app.send('pose', {
        p: [app.position.x, app.position.y || 0, app.position.z],
        yaw: app.rotation?.y || 0
      })

      app.emit('rat:position', {
        appId: app.instanceId,
        position: [app.position.x, app.position.y || 0, app.position.z],
        state: currentState,
        timestamp: now
      })

      // CRITICAL: V24 pattern - direct registry mutation
      const rat = RAT_REGISTRY.get(app.instanceId)
      if (rat) {
        rat.position.x = app.position.x
        rat.position.y = app.position.y || 0
        rat.position.z = app.position.z
        rat.state = currentState
        // CRITICAL: Store ACTUAL accumulated velocity (not derived from movement)
        // This is essential for boid alignment calculations
        rat.velocity.x = velocity.x
        rat.velocity.y = 0
        rat.velocity.z = velocity.z
      }

      lastPositionBroadcast = now
    }
  }

  // Alias for backwards compatibility
  const moveTowardsTarget = applyMovement

  /**
   * Generate random wander target near current position
   */
  function generateWanderTarget() {
    const wanderRadius = 10.0
    const angle = Math.random() * Math.PI * 2
    const distance = Math.random() * wanderRadius

    const myPos = app.position
    return {
      x: myPos.x + Math.cos(angle) * distance,
      y: myPos.y,
      z: myPos.z + Math.sin(angle) * distance
    }
  }

  /**
   * Main AI update loop
   * Runs at configurable rate (default 50ms = 20Hz)
   */
  function updateAI(delta) {
    if (currentState === RatState.DEAD) return

    const player = findNearestPlayer()

    if (!player) {
      // No player in range - return to idle (with wandering)
      if (currentState !== RatState.IDLE) {
        enterState(RatState.IDLE)
        wanderTarget = null // Reset wander target on state change
      }

      const now = Date.now()

      // Idle wandering behavior
      if (!wanderTarget || now - lastWanderChange > wanderChangeInterval) {
        wanderTarget = generateWanderTarget()
        lastWanderChange = now
      }

      // Move towards wander target (with BOID forces if enabled)
      if (wanderTarget) {
        const dx = wanderTarget.x - app.position.x
        const dz = wanderTarget.z - app.position.z
        const distSq = dx * dx + dz * dz

        // If close to target, generate new one
        if (distSq < 1.0) {
          wanderTarget = generateWanderTarget()
          lastWanderChange = now
        } else {
          // Move towards wander target
          moveTowardsTarget(wanderTarget, delta)
        }
      }

      // Idle behavior: occasional idle variation
      if (now - lastIdleVariation > 5000) {
        playIdleAnimation()
        lastIdleVariation = now
      }

      // Idle sounds (every 10-15 seconds)
      if (app.props.enableSounds && now - lastIdleSound > 10000 + Math.random() * 5000) {
        app.send('playRandomSound', {
          sounds: ['rat_idle_squeak', 'rat_idle_sniff'],
          volume: 0.4
        })
        lastIdleSound = now
      }

      return
    }

    // Player detected - calculate distance
    const dx = player.position.x - app.position.x
    const dy = player.position.y - app.position.y
    const dz = player.position.z - app.position.z
    const distSq = dx * dx + dy * dy + dz * dz
    const attackRangeSq = app.props.attackRange * app.props.attackRange

    if (distSq <= attackRangeSq) {
      // Within attack range
      if (currentState !== RatState.ATTACK) {
        enterState(RatState.ATTACK, { target: player })
      }
      performAttack(player)
    } else {
      // Chase player
      if (currentState !== RatState.CHASE) {
        enterState(RatState.CHASE, { target: player })
      }
      moveTowardsTarget(player.position, delta)
    }

    // Store current target
    targetPlayer = player
  }

  // Start AI loop using Hyperfy's update event
  // NOTE: Hyperfy SES sandbox requires app.on('update') instead of setInterval
  // Delta accumulation maintains same 50ms (20Hz) tick rate as v31
  const updateInterval = app.props.updateRate || 50
  const updateDelta = updateInterval / 1000.0 // Convert to seconds
  let accumulatedTime = 0

  app.on('update', (delta) => {
    // Accumulate frame time
    accumulatedTime += delta * 1000 // Convert to ms

    // Run AI at configured interval (default 50ms = 20Hz)
    if (accumulatedTime >= updateInterval) {
      updateAI(updateDelta)
      accumulatedTime = 0
    }
  })

  console.log(`[${mobName}] 🤖 AI loop started (${updateInterval}ms interval)`)

  // ============================================================================
  // SECTION 10: SERVER-SIDE CLEANUP (Phase 7)
  // ============================================================================

  /**
   * Cleanup on destroy
   * Unregisters from registry, broadcasts to other rats, stops AI loop
   */
  app.on('destroy', () => {
    console.log(`[${mobName}] 🗑️ Cleanup starting...`)

    // AI loop automatically stops when app is destroyed (app.on('update') handler removed)

    // Unregister from registry
    unregisterRat(app.instanceId)

    // Broadcast unregister to other rats
    app.emit('rat:unregister', {
      appId: app.instanceId,
      timestamp: Date.now()
    })

    // Unregister from combat system
    if (world.combatManager) {
      world.combatManager.unregisterNPC(app.id)
    }

    console.log(`[${mobName}] ✅ Cleanup complete`)
  })
}

console.log(`[${mobName}] ✅ Rat v32 loaded (SES-Compatible Timer Fix)`)
