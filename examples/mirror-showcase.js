// Mirror Showcase - Demonstrates mirror functionality with first person mode support

// Configure UI props for the mirror
app.configure([
  {
    type: 'number',
    key: 'width',
    label: 'Width',
    min: 0.5,
    max: 10,
    step: 0.5,
    initial: 4,
  },
  {
    type: 'number',
    key: 'height',
    label: 'Height',
    min: 0.5,
    max: 10,
    step: 0.5,
    initial: 3,
  },
  {
    type: 'color',
    key: 'tint',
    label: 'Tint Color',
    hint: 'Adds a color tint to the reflection',
    initial: '#ffffff',
  },
  {
    type: 'switch',
    key: 'textureSize',
    label: 'Texture Quality',
    options: [
      { label: 'Low (256x256)', value: '256' },
      { label: 'Medium (512x512)', value: '512' },
      { label: 'High (1024x1024)', value: '1024' },
      { label: 'Ultra (2048x2048)', value: '2048' },
    ],
    initial: '1024',
  },
])

// Parse texture size
const textureSize = parseInt(props.textureSize)

// Create main mirror in front with user-configured properties
const mainMirror = app.create('mirror', {
  width: props.width,
  height: props.height,
  position: [0, props.height / 2, -5],
  tint: props.tint,
  textureWidth: textureSize,
  textureHeight: textureSize,
})
app.add(mainMirror)
