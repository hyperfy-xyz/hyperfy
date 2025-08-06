app.configure([
  {
    type: 'colorwheel',
    key: 'testColor',
    label: 'Test Color',
    hint: 'This is a test color wheel',
    initial: '#ff0000',
  },
])

console.log('Color wheel test loaded')
console.log('Props:', props)

// Create a simple box to show the color
const box = app.create('prim', {
  kind: 'box',
  scale: [2, 2, 2],
  position: [0, 1, 0],
  color: props.testColor || '#ff0000',
})

app.add(box)

// Update color when props change
app.on('update', () => {
  if (box.color !== props.testColor) {
    box.color = props.testColor || '#ff0000'
  }
})
