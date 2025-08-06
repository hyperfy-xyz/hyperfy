// Optimized performance test: 10,000 primitives with smart material distribution
// Tests realistic material usage patterns for better performance

// Configure props for texture upload
app.configure([
  {
    type: 'file',
    key: 'textureFile',
    label: 'Texture Image',
    kind: 'texture',
  },
])

const TOTAL_PRIMITIVES = 50000
const WORLD_SIZE = 200
const SHAPES = ['box', 'sphere', 'cylinder', 'cone', 'torus']

console.log(`Creating ${TOTAL_PRIMITIVES} optimized primitives...`)
if (props.textureFile?.url) {
  console.log('Using custom texture:', props.textureFile.name)
}

// Define a more realistic set of materials
// In real applications, you'd have a few main materials used frequently
const materials = [
  // Common materials (used by 80% of objects)
  { color: '#ffffff', metalness: 0.0, roughness: 0.9 }, // White matte
  { color: '#333333', metalness: 0.0, roughness: 0.8 }, // Dark gray
  { color: '#666666', metalness: 0.2, roughness: 0.7 }, // Medium gray
  { color: '#ff6b6b', metalness: 0.0, roughness: 0.6 }, // Red
  { color: '#4ecdc4', metalness: 0.0, roughness: 0.6 }, // Teal
  { color: '#45b7d1', metalness: 0.0, roughness: 0.6 }, // Blue
  { color: '#96f2d7', metalness: 0.0, roughness: 0.5 }, // Mint
  { color: '#ffd93d', metalness: 0.1, roughness: 0.4 }, // Gold

  // Special materials (used by 20% of objects)
  { color: '#ffffff', metalness: 0.9, roughness: 0.1 }, // Polished metal
  { color: '#ffd700', metalness: 0.8, roughness: 0.2 }, // Gold metal
  { color: '#c0c0c0', metalness: 0.7, roughness: 0.3 }, // Silver
  { color: '#ff0000', emissive: '#ff0000', emissiveIntensity: 1.5 }, // Red glow
  { color: '#00ff00', emissive: '#00ff00', emissiveIntensity: 1.5 }, // Green glow
  { color: '#0000ff', emissive: '#0000ff', emissiveIntensity: 1.5 }, // Blue glow
  { color: '#ffffff', transparent: true, opacity: 0.5, metalness: 0, roughness: 0 }, // Glass
]

// Add textured material if texture is provided
if (props.textureFile?.url) {
  materials.push({
    color: '#ffffff',
    metalness: 0.0,
    roughness: 0.8,
    texture: props.textureFile.url,
  })
}

// Track statistics
const stats = {
  shapes: {},
  materialUsage: new Array(materials.length).fill(0),
  startTime: Date.now(),
  instances: [],
}

SHAPES.forEach(shape => (stats.shapes[shape] = 0))

// Create primitives
for (let i = 0; i < TOTAL_PRIMITIVES; i++) {
  // Select shape type
  const shape = SHAPES[i % SHAPES.length]
  stats.shapes[shape]++

  // Select material with weighted distribution
  let materialIndex
  if (Math.random() < 0.8) {
    // 80% use common materials
    materialIndex = Math.floor(Math.random() * 8)
  } else {
    // 20% use special materials
    const specialCount = props.textureFile?.url ? 8 : 7
    materialIndex = 8 + Math.floor(Math.random() * specialCount)
  }
  const material = materials[materialIndex]
  stats.materialUsage[materialIndex]++

  // Grid-based positioning with variation
  const gridSize = Math.ceil(Math.pow(TOTAL_PRIMITIVES, 1 / 3))
  const spacing = WORLD_SIZE / gridSize

  const gridX = i % gridSize
  const gridY = Math.floor(i / gridSize) % gridSize
  const gridZ = Math.floor(i / (gridSize * gridSize))

  const position = [
    (gridX - gridSize / 2) * spacing + (Math.random() - 0.5) * spacing * 0.5,
    gridY * spacing * 0.5,
    (gridZ - gridSize / 2) * spacing + (Math.random() - 0.5) * spacing * 0.5,
  ]

  // Consistent scale variations per shape type
  let scaleArr
  const scaleFactor = 0.5 + Math.random() * 0.5 // 0.5 to 1.0

  if (shape === 'sphere') {
    const r = 0.4 * scaleFactor
    scaleArr = [r, r, r]
  } else if (shape === 'torus') {
    const r = 0.5 * scaleFactor
    scaleArr = [r, r, r]
  } else if (shape === 'cylinder' || shape === 'cone') {
    const r = 0.3 * scaleFactor
    const h = 0.8 * scaleFactor
    scaleArr = [r, h, r]
  } else if (shape === 'plane') {
    scaleArr = [scaleFactor, scaleFactor, 1]
  } else {
    // box
    const s = 0.6 * scaleFactor
    scaleArr = [s, s, s]
  }

  // Create primitive
  const prim = app.create('prim', {
    type: shape,
    scale: scaleArr,
    position: position,
    ...material,
    castShadow: false,
    receiveShadow: false,
  })

  app.add(prim)
  stats.instances.push(prim)

  // Log progress
  if ((i + 1) % 1000 === 0) {
    console.log(`Created ${i + 1}/${TOTAL_PRIMITIVES} primitives...`)
  }
}

const creationTime = Date.now() - stats.startTime
console.log(
  `\nCreation complete in ${creationTime}ms (${(creationTime / TOTAL_PRIMITIVES).toFixed(2)}ms per primitive)`
)

// Log statistics
console.log('\nShape distribution:')
Object.entries(stats.shapes).forEach(([shape, count]) => {
  console.log(`  ${shape}: ${count}`)
})

console.log('\nMaterial usage:')
stats.materialUsage.forEach((count, idx) => {
  if (count > 0) {
    const percentage = ((count / TOTAL_PRIMITIVES) * 100).toFixed(1)
    console.log(`  Material ${idx}: ${count} uses (${percentage}%)`)
  }
})

// Create a special textured showcase primitive if texture is provided
if (props.textureFile?.url) {
  const texturedBox = app.create('prim', {
    type: 'box',
    scale: [4, 4, 4],
    position: [0, 2, -10],
    color: '#ffffff',
    texture: props.textureFile.url,
    metalness: 0.0,
    roughness: 0.8,
  })
  app.add(texturedBox)
  stats.instances.push(texturedBox)

  // Make it rotate slowly
  app.on('update', dt => {
    texturedBox.rotation.y += 0.3 * dt
  })

  console.log('\nCreated textured showcase box at [0, 2, -10]')
}

// Calculate expected instance groups
const expectedGroups = materials.length * SHAPES.length
console.log(`\nExpected instance groups: ${expectedGroups} (${materials.length} materials × ${SHAPES.length} shapes)`)
console.log(`Average instances per group: ${Math.floor(TOTAL_PRIMITIVES / expectedGroups)}`)

// Animate a subset of primitives
const animatedCount = Math.min(200, stats.instances.length)
const animatedPrims = []

for (let i = 0; i < animatedCount; i++) {
  const idx = Math.floor((i / animatedCount) * stats.instances.length)
  animatedPrims.push({
    prim: stats.instances[idx],
    speed: 0.5 + Math.random() * 1.5,
    axis: ['x', 'y', 'z'][Math.floor(Math.random() * 3)],
  })
}

app.on('update', dt => {
  animatedPrims.forEach(({ prim, speed, axis }) => {
    prim.rotation[axis] += speed * dt
  })
})

// Position camera
if (typeof world !== 'undefined' && world.getAvatar) {
  try {
    const avatar = world.getAvatar()
    if (avatar) {
      avatar.position = [0, 40, 80]
      console.log('\nCamera positioned to view the scene')
    }
  } catch (e) {
    console.log('Could not set avatar position:', e.message)
  }
}

console.log('\nOptimized test complete!')
console.log('This test uses realistic material distribution:')
console.log('- 80% of objects use common materials (8 types)')
console.log('- 20% use special materials (metallic, emissive, transparent)')
if (props.textureFile?.url) {
  console.log('- Custom texture applied to showcase box and some random primitives')
}
console.log('- Total unique instance groups: ~75 (much better than 10,000!)')
