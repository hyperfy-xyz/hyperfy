// Primitive Showcase - Displays all available primitive types side by side

// Spacing between primitives
const SPACING = 3

// Create floor
const floor = app.create('prim', {
  type: 'box',
  scale: [20, 0.1, 10],
  position: [0, -0.05, 0],
  color: '#2a2a2a',
  physics: 'static',
})
app.add(floor)

// Box primitive
const box = app.create('prim', {
  type: 'box',
  scale: [1, 1, 1],
  position: [-7.5, 0.5, 0],
  color: '#ff4444',
  metalness: 0.3,
  roughness: 0.7,
})
app.add(box)

// Sphere primitive
const sphere = app.create('prim', {
  type: 'sphere',
  scale: [0.5, 0.5, 0.5],
  position: [-4.5, 0.5, 0],
  color: '#4444ff',
  metalness: 0.8,
  roughness: 0.2,
})
app.add(sphere)

// Cylinder primitive
const cylinder = app.create('prim', {
  type: 'cylinder',
  scale: [0.5, 1.5, 0.5],
  position: [-1.5, 0.75, 0],
  color: '#44ff44',
  metalness: 0.4,
  roughness: 0.6,
})
app.add(cylinder)

// Cone primitive
const cone = app.create('prim', {
  type: 'cone',
  scale: [0.5, 1.5, 0.5],
  position: [1.5, 0.75, 0],
  color: '#ff44ff',
  metalness: 0.5,
  roughness: 0.5,
})
app.add(cone)

// Torus primitive
const torus = app.create('prim', {
  type: 'torus',
  scale: [0.6, 0.6, 0.6],
  position: [4.5, 0.7, 0],
  color: '#ffff44',
  metalness: 0.7,
  roughness: 0.3,
})
app.add(torus)

// Plane primitive (vertical to be visible)
const plane = app.create('prim', {
  type: 'plane',
  scale: [1.5, 1.5, 1],
  position: [7.5, 0.75, 0],
  rotation: [0, Math.PI / 4, 0], // Rotate to face viewer
  color: '#44ffff',
  metalness: 0.2,
  roughness: 0.8,
  doubleside: true,
})
app.add(plane)

// Add labels under each primitive
const labels = [
  { text: 'BOX', x: -7.5 },
  { text: 'SPHERE', x: -4.5 },
  { text: 'CYLINDER', x: -1.5 },
  { text: 'CONE', x: 1.5 },
  { text: 'TORUS', x: 4.5 },
  { text: 'PLANE', x: 7.5 },
]

// Create text labels (using small boxes as placeholders for demonstration)
labels.forEach(label => {
  const labelBox = app.create('prim', {
    type: 'box',
    scale: [1.2, 0.1, 0.3],
    position: [label.x, 0.05, 2],
    color: '#666666',
    emissive: '#ffffff',
    emissiveIntensity: 0.3,
  })
  app.add(labelBox)
})

// Add some animation to make it more interesting
app.on('update', dt => {
  // Rotate box
  box.rotation.y += 0.5 * dt

  // Bounce sphere
  sphere.position.y = 0.5 + Math.sin(Date.now() * 0.002) * 0.2

  // Spin cylinder
  cylinder.rotation.y += 0.8 * dt

  // Wobble cone
  cone.rotation.z = Math.sin(Date.now() * 0.001) * 0.1

  // Spin torus on multiple axes
  torus.rotation.x += 0.6 * dt
  torus.rotation.y += 0.4 * dt

  // Wave plane
  plane.rotation.y = Math.PI / 4 + Math.sin(Date.now() * 0.0015) * 0.3
})

// Position camera for good view
if (typeof world !== 'undefined' && world.getAvatar) {
  try {
    const avatar = world.getAvatar()
    if (avatar) {
      avatar.position = [0, 3, 8]
      avatar.rotation.x = -0.2
    }
  } catch (e) {
    console.log('Could not set avatar position:', e.message)
  }
}

console.log('Primitive showcase ready!')
console.log('Showing all 6 primitive types: box, sphere, cylinder, cone, torus, plane')
