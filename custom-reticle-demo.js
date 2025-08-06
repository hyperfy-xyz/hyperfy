app.configure([
  {
    type: 'file',
    key: 'reticleImage',
    label: 'Reticle Image',
    kind: 'texture',
  },
  {
    type: 'toggle',
    key: 'enabled',
    label: 'Use Custom Reticle',
    initial: true,
  },
])

// Apply or remove custom reticle based on toggle
app.on('update', () => {
  if (world.isClient) {
    if (props.enabled && props.reticleImage?.url) {
      world.setReticleImage(props.reticleImage.url)
    } else {
      world.setReticleImage(null)
    }
  }
})

// Create a simple UI element to show status
const info = app.create('ui', {
  position: [0, 120, 0],
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  borderRadius: 10,
  padding: 20,
  flexDirection: 'column',
  gap: 10,
})

const title = app.create('uitext', {
  value: 'Custom Reticle Demo',
  fontSize: 24,
  color: '#ffffff',
  fontWeight: 'bold',
})

const status = app.create('uitext', {
  value: 'Configure the reticle in the props panel',
  fontSize: 16,
  color: '#cccccc',
})

info.add(title)
info.add(status)
app.add(info)

// Update status text
app.on('update', () => {
  if (props.enabled && props.reticleImage?.url) {
    status.value = '✓ Custom reticle active'
    status.color = '#66ff66'
  } else {
    status.value = 'Using default reticle'
    status.color = '#cccccc'
  }
})

console.log('Custom Reticle Demo')
console.log('====================')
console.log('1. Upload a reticle image in the props panel')
console.log('2. Toggle "Use Custom Reticle" to enable/disable')
console.log('3. The reticle will update in real-time')