// Configuration
const TOTAL_COUNT = 100000
const WORLD_SIZE = 500
const SHAPES = ['box', 'sphere', 'cylinder', 'cone', 'torus']

// Statistics
const stats = {
  shapes: {},
  startTime: 0,
  frameCount: 0,
  lastFpsTime: 0
}

// Initialize shape counters
SHAPES.forEach(shape => stats.shapes[shape] = 0)

// Store all primitives for animation
const primitives = []

console.log(`Creating ${TOTAL_COUNT} primitives...`)
stats.startTime = Date.now ? Date.now() : 0

// Create primitives with even distribution
for (let i = 0; i < TOTAL_COUNT; i++) {
  // Choose shape type
  const shape = SHAPES[i % SHAPES.length]
  stats.shapes[shape]++
  
  // Random position in 3D space
  const position = [
    (Math.random() - 0.5) * WORLD_SIZE,
    (Math.random() - 0.5) * WORLD_SIZE * 0.5, // Flatter Y distribution
    (Math.random() - 0.5) * WORLD_SIZE
  ]
  
  // Size based on shape type
  let size
  if (shape === 'sphere') {
    // Wider range of radii
    size = [0.2 + Math.random() * 4]
  } else if (shape === 'torus') {
    // Wider range for main radius and tube radius proportion
    const radius = 0.5 + Math.random() * 3
    size = [radius, radius * (0.1 + Math.random() * 0.8)]
  } else if (shape === 'cylinder' || shape === 'cone') {
    // Wider range for radius and much wider for height
    size = [0.2 + Math.random() * 2, 0.5 + Math.random() * 5]
  } else { // box
    // Wider range for each dimension, allowing for more variation
    size = [
      0.2 + Math.random() * 4,
      0.2 + Math.random() * 4,
      0.2 + Math.random() * 4
    ]
  }
  
  // Initial color using HSL
  const hue = (i / TOTAL_COUNT) * 360
  const saturation = 50 + Math.random() * 50
  const lightness = 40 + Math.random() * 30
  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`
  
  // Create primitive
  const prim = app.create('prim', {
    kind: shape,
    size: size,
    position: position,
    color: color,
    castShadow: false,
    receiveShadow: false
  })
  
  app.add(prim)
  
  // Store primitive reference
  primitives.push(prim)
  
}

// The GPU color animation is automatically active on all primitives
// Colors will animate with hue shifting, saturation/lightness pulsing, and wave effects
// All animation happens in the shader with zero JavaScript overhead

let animTime = 0
app.on('update', (dt) => {
  animTime += dt
  
  // Optional: Change some base colors periodically
  // The GPU animation will continue on top of these color changes
  for (let i = 0; i < Math.min(100, primitives.length); i++) {
    const hue = (i * 3.6 + animTime * 20) % 360
    primitives[i].color = `hsl(${hue}, 70%, 50%)`
  }
})
