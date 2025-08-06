// Primitive Physics Test - Tests all physics combinations for each primitive type

const PRIMITIVE_TYPES = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'plane']
const PHYSICS_TYPES = ['static', 'kinematic', 'dynamic']
const GRID_SPACING = 4
const ROW_SPACING = 7
const START_X = -15
const START_Z = -18

// Create arena
const floor = app.create('prim', {
  type: 'box',
  scale: [50, 0.2, 50],
  position: [0, -0.07, 0],
  color: '#2a2a2a',
  physics: 'static',
})
app.add(floor)

// Create walls
const wallConfigs = [
  { pos: [0, 2, -25], scale: [50, 4, 0.5] },
  { pos: [0, 2, 25], scale: [50, 4, 0.5] },
  { pos: [-25, 2, 0], scale: [0.5, 4, 50] },
  { pos: [25, 2, 0], scale: [0.5, 4, 50] },
]
wallConfigs.forEach(cfg => {
  app.add(
    app.create('prim', {
      type: 'box',
      scale: cfg.scale,
      position: cfg.pos,
      color: '#444444',
      physics: 'static',
    })
  )
})

// Helper to create UI labels
const createLabel = (text, pos, opts = {}) => {
  const ui = app.create('ui', {
    width: opts.width || 120,
    height: opts.height || 40,
    size: 0.01,
    position: pos,
    billboard: 'y',
    backgroundColor: opts.bgColor || 'rgba(0, 0, 0, 0.8)',
    borderRadius: opts.borderRadius || 5,
    borderWidth: opts.borderWidth || 0,
    borderColor: opts.borderColor,
    padding: opts.padding || 5,
    ...opts.ui,
  })

  ui.add(
    app.create('uitext', {
      value: text,
      fontSize: opts.fontSize || 20,
      color: opts.color || '#ffffff',
      textAlign: 'center',
      fontWeight: opts.fontWeight || 'bold',
      ...opts.text,
    })
  )

  app.add(ui)
  return ui
}

// Add title
createLabel('PRIMITIVE PHYSICS TEST', [0, 5, -20], {
  width: 400,
  height: 80,
  borderRadius: 10,
  borderWidth: 3,
  borderColor: '#ffffff',
  padding: 10,
  fontSize: 32,
  ui: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
})

// Add subtitle
const titleUI = app.create('ui', {
  width: 400,
  height: 30,
  size: 0.01,
  position: [0, 4, -20],
  billboard: 'y',
})
titleUI.add(
  app.create('uitext', {
    value: 'Testing convex mesh colliders',
    fontSize: 18,
    color: '#aaaaaa',
    textAlign: 'center',
  })
)
app.add(titleUI)

// Add column headers
PHYSICS_TYPES.forEach((type, i) => {
  const colors = { static: '#4444ff', kinematic: '#44ff44', dynamic: '#ff4444' }
  const desc = { static: 'Immovable', kinematic: 'Animated', dynamic: 'Falls & Bounces' }

  const headerUI = createLabel(type.toUpperCase(), [START_X + i * GRID_SPACING * 3, 3, START_Z - 5], {
    width: 140,
    height: 60,
    bgColor: `rgba(${type === 'dynamic' ? '255,68,68' : type === 'kinematic' ? '68,255,68' : '68,68,255'},0.2)`,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors[type],
    padding: 10,
    fontSize: 24,
    ui: { flexDirection: 'column', alignItems: 'center' },
  })

  // Add description
  const descUI = app.create('uitext', {
    value: desc[type],
    fontSize: 14,
    color: '#cccccc',
    textAlign: 'center',
    margin: 2,
  })
  headerUI.children[0].parent.add(descUI)
})

// Store test primitives
const testPrimitives = []

// Create test grid
PRIMITIVE_TYPES.forEach((primType, row) => {
  const rowZ = START_Z + row * ROW_SPACING

  // Add row label
  createLabel(primType.toUpperCase(), [START_X - 5, 1, rowZ], {
    width: 150,
    height: 50,
    bgColor: 'rgba(40, 40, 40, 0.9)',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: `hsl(${row * 60}, 70%, 50%)`,
    padding: 8,
    fontSize: 24,
  })

  PHYSICS_TYPES.forEach((physType, col) => {
    const x = START_X + col * GRID_SPACING * 3

    // Add physics type label
    createLabel(physType.toUpperCase(), [x, 0.5, rowZ + 2.5], {
      color: physType === 'dynamic' ? '#ff4444' : physType === 'kinematic' ? '#44ff44' : '#4444ff',
    })

    // Primitive configuration
    const configs = {
      box: { size: [1, 1, 1], height: 0.5 },
      sphere: { size: [0.5], height: 0.5 },
      cylinder: { size: [0.5, 0.5, 1], height: 0.5 },
      cone: { size: [0.5, 1], height: 0.5 },
      torus: { size: [0.4, 0.1], height: 0.5 },
      plane: { size: [1, 1], height: 0.5, rotation: [0, Math.PI / 4, 0] },
    }

    const config = configs[primType] || configs.box
    const yPos = physType === 'dynamic' ? config.height + 3 : config.height

    // Create test primitive
    const prim = app.create('prim', {
      type: primType,
      size: config.size,
      position: [x, yPos, rowZ],
      rotation: config.rotation || [0, 0, 0],
      color: `hsl(${row * 60}, 70%, 50%)`,
      metalness: 0.5,
      roughness: 0.5,
      doubleside: primType === 'plane',
      physics: physType,
      mass: physType === 'dynamic' ? 1 : 1,
      restitution: 0.3,
      linearDamping: 0.1,
      angularDamping: 0.1,
    })

    testPrimitives.push({ prim, type: primType, physicsType: physType, originalY: yPos })
    app.add(prim)

    // Add trigger zone for first column
    if (col === 0) {
      const trigger = app.create('prim', {
        type: primType,
        scale: [2, 2, 2],
        position: [x + GRID_SPACING, 1, rowZ],
        color: '#00ff00',
        doubleside: primType === 'plane',
        transparent: true,
        opacity: 0.2,
        physics: 'static',
        trigger: true,
        tag: `trigger_${primType}`,
        onTriggerEnter: other => {
          trigger.color = 'red'
          console.log('trigger data', other)
          console.log(`${primType} trigger entered by:`, other.playerId || 'unknown')
          updateStatus(`✓ ${primType} trigger entered`)
        },
        onTriggerLeave: other => {
          trigger.color = '#00ff00'
          console.log(`${primType} trigger left by:`, other.playerId || 'unknown')
        },
      })
      app.add(trigger)

      createLabel('TRIGGER', [x + GRID_SPACING, 2.5, rowZ], {
        width: 80,
        height: 30,
        bgColor: 'rgba(0, 255, 0, 0.2)',
        borderWidth: 1,
        borderColor: '#00ff00',
        padding: 3,
        fontSize: 14,
        color: '#00ff00',
      })
    }
  })
})

// Add test ball
const testBall = app.create('prim', {
  type: 'sphere',
  scale: [0.3, 0.3, 0.3],
  position: [0, 5, 0],
  color: '#ff00ff',
  emissive: '#ff00ff',
  emissiveIntensity: 0.5,
  physics: 'dynamic',
  mass: 2,
  restitution: 0.8,
  tag: 'test_ball',
})
app.add(testBall)

// Animation
let time = 0
let forceTimer = 0

app.on('fixedUpdate', dt => {
  time += dt
  forceTimer += dt

  // Animate kinematic objects
  testPrimitives.forEach(item => {
    if (item.physicsType === 'kinematic') {
      // item.prim.position.y = item.originalY + Math.sin(time * 2) * 0.5
      item.prim.position.y = item.originalY + Math.abs(Math.sin(time * 2)) * 0.5
      item.prim.rotation.y = time
      item.prim.clean()
    }
  })

  // Apply impulse to test ball every 5 seconds
  if (forceTimer > 5 && testBall.actor) {
    const force = new PHYSX.PxVec3((Math.random() - 0.5) * 10, 5 + Math.random() * 5, (Math.random() - 0.5) * 10)
    PHYSX.PxRigidBodyExt.prototype.addForceAtPos(
      testBall.actor,
      force,
      testBall.actor.getGlobalPose().p,
      PHYSX.PxForceModeEnum.eIMPULSE
    )
    PHYSX.destroy(force)
    forceTimer = 0
    updateStatus('⚡ Applied impulse to test ball')
  }
})

// Status display
const statusUI = app.create('ui', {
  space: 'screen',
  width: 300,
  height: 150,
  position: [0, 1, 0],
  pivot: 'bottom-left',
  offset: [20, -20, 0],
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  borderRadius: 10,
  borderWidth: 2,
  borderColor: '#666666',
  padding: 10,
  flexDirection: 'column',
  gap: 5,
})

const statusTitle = app.create('uitext', {
  value: 'PHYSICS STATUS',
  fontSize: 18,
  color: '#ffffff',
  textAlign: 'center',
  fontWeight: 'bold',
  margin: 5,
})

const statusText = app.create('uitext', {
  value: 'Waiting for collisions...',
  fontSize: 14,
  color: '#aaaaaa',
  textAlign: 'left',
  lineHeight: 1.4,
})

statusUI.add(statusTitle)
statusUI.add(statusText)
app.add(statusUI)

// Status update function
let eventLog = []
const updateStatus = message => {
  eventLog.unshift(message)
  eventLog = eventLog.slice(0, 5)
  statusText.value = eventLog.join('\\n')
}

// Set camera position
if (typeof world !== 'undefined' && world.getAvatar) {
  try {
    const avatar = world.getAvatar()
    if (avatar) {
      avatar.position = [0, 15, 20]
      avatar.rotation.x = -0.4
    }
  } catch (e) {
    console.log('Could not set avatar position:', e.message)
  }
}

console.log('=== Primitive Physics Test ===')
console.log('All non-box/sphere shapes now use convex mesh colliders!')
