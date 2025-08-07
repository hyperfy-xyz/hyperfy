// Mirror Showcase - Demonstrates mirror functionality with first person mode support

// Create main mirror in front
const mainMirror = app.create('mirror', {
  width: 4,
  height: 3,
  position: [0, 1.5, -5],
  color: '#9999ff', // Slight blue tint
  textureWidth: 1024,
  textureHeight: 1024,
  multisample: 4,
})
app.add(mainMirror)
