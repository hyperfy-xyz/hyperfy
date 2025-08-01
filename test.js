// Configuration
const TOTAL_COUNT = 100000
const WORLD_SIZE = 500
const SHAPES = ['box', 'sphere', 'cylinder', 'cone', 'torus']

// Add some ambient light to see the emissive glow better
if (app.world?.renderer) {
  app.world.renderer.toneMappingExposure = 1.5
}

console.log('🌟 GPU Color Animation with Emissive Glow')
console.log('Each primitive emits light based on its color brightness!')

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
  
  // Only half the objects will be emissive
  const isEmissive = i % 2 === 0
  
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
  
  // Use various color formats - all supported!
  // Named colors, hex, rgb, rgba - bright colors will emit more light!
  const colors = [
    'red',                    // Named color
    '#ff6600',               // Hex color
    'yellow',                // Named color
    'rgb(0, 255, 128)',      // RGB color
    'cyan',                  // Named color
    '#0088ff',               // Hex color
    'purple',                // Named color
    'rgba(255, 0, 255, 0.8)', // RGBA (alpha ignored for materials)
    'coral',                 // Named color
    '#00ffcc'                // Hex color
  ]
  const color = colors[i % colors.length]
  
  // Make some objects extra bright for emphasis
  const isBright = Math.random() > 0.9 // 10% chance
  if (isBright && (color === 'yellow' || color === 'cyan' || color === 'pink')) {
    size = size.map(s => s * 1.5) // Make bright ones slightly larger
  }
  
  // Create primitive
  const prim = app.create('prim', {
    kind: shape,
    size: size,
    position: position,
    color: color,
    emissive: isEmissive,
    castShadow: false,
    receiveShadow: false
  })
  
  app.add(prim)
  
  // Store primitive reference with emissive flag
  prim.isEmissive = isEmissive
  primitives.push(prim)
  
}

// The GPU color animation is automatically active on all primitives
// Colors will animate with hue shifting, saturation/lightness pulsing, and wave effects
// Each primitive emits light based on its color brightness!

console.log('\n✨ Emissive Features:')
console.log('  • Only HALF the objects are emissive (50,000 glow, 50,000 don\'t)')
console.log('  • Emissive objects: Brighter colors emit more light')
console.log('  • Non-emissive objects: Still have animated colors but no glow')
console.log('  • Creates contrast between glowing and non-glowing objects')
console.log('  • All computed on GPU for zero overhead!')

let animTime = 0

// Don't change colors every frame - let the GPU animation do its work
// The flickering was caused by too-frequent color updates
app.on('update', (dt) => {
  animTime += dt
  
  // Only occasionally change a few colors for variety
  // This prevents flickering while still showing dynamic color changes
  if (Math.floor(animTime) % 5 === 0 && Math.floor(animTime * 10) % 10 === 0) {
    // Change just a few random objects every 5 seconds
    const colors = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink']
    for (let i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * primitives.length)
      const randomColor = colors[Math.floor(Math.random() * colors.length)]
      if (primitives[randomIndex]) {
        primitives[randomIndex].color = randomColor
      }
    }
  }
})
