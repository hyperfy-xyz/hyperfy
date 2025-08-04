// Spinning Box Demo - A simple box rotating clockwise

// Create a red box
const box = app.create('prim', {
  kind: 'box',
  scale: [2, 2, 2],
  position: [0, 2, 0],
  color: '#ff0000',
  metalness: 0.3,
  roughness: 0.7,
})

app.add(box)

// Rotate the box clockwise (around Y axis)
app.on('update', (dt) => {
  box.rotation.y -= dt * 2 // Negative for clockwise when looking down
})

console.log('Spinning box created!')
console.log('The box rotates clockwise at 2 radians per second')