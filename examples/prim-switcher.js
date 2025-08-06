// Primitive Switcher - Switch between different primitive types with adjustable scale
const box = app.get('Block')
box.visible = false

// Configure props UI
app.configure([
  {
    type: 'switch',
    key: 'primType',
    label: 'Primitive Type',
    options: [
      { label: 'Box', value: 'box' },
      { label: 'Sphere', value: 'sphere' },
      { label: 'Cylinder', value: 'cylinder' },
      { label: 'Cone', value: 'cone' },
      { label: 'Torus', value: 'torus' },
      { label: 'Plane', value: 'plane' },
    ],
    initial: 'box',
  },
  {
    type: 'range',
    key: 'scaleX',
    label: 'Scale X',
    min: 0.1,
    max: 5,
    step: 0.1,
    initial: 1,
  },
  {
    type: 'range',
    key: 'scaleY',
    label: 'Scale Y',
    min: 0.1,
    max: 5,
    step: 0.1,
    initial: 1,
  },
  {
    type: 'range',
    key: 'scaleZ',
    label: 'Scale Z',
    min: 0.1,
    max: 5,
    step: 0.1,
    initial: 1,
  },
  {
    type: 'toggle',
    key: 'rotate',
    label: 'Auto Rotate',
    initial: true,
  },
  {
    type: 'range',
    key: 'rotationSpeed',
    label: 'Rotation Speed',
    min: 0,
    max: 5,
    step: 0.1,
    initial: 1,
  },
  {
    type: 'color',
    key: 'color',
    label: 'Color',
    hint: 'Choose a color for the primitive',
    initial: '#4488ff',
  },
  {
    type: 'texture',
    key: 'texture',
    label: 'Texture',
  },
  {
    type: 'range',
    key: 'metalness',
    label: 'Metalness',
    min: 0,
    max: 1,
    step: 0.05,
    initial: 0.5,
  },
  {
    type: 'range',
    key: 'roughness',
    label: 'Roughness',
    min: 0,
    max: 1,
    step: 0.05,
    initial: 0.5,
  },
  {
    type: 'range',
    key: 'emissiveIntensity',
    label: 'Glow Intensity',
    min: 0,
    max: 10,
    step: 0.1,
    initial: 1,
  },
  {
    type: 'button',
    key: 'reset',
    label: 'Reset Position',
    onClick: () => {
      if (currentPrim) {
        currentPrim.position.set(0, 0, 0)
        currentPrim.position.y += props.scaleY / 2
        currentPrim.rotation.set(0, 0, 0)
      }
    },
  },
])

// Get scale from individual axis controls
const scaleArray = [props.scaleX || 1, props.scaleY || 1, props.scaleZ || 1]

// Create new primitive - geometry is already translated so y=0 is the bottom
const currentPrim = app.create('prim', {
  type: props.primType || 'box',
  scale: scaleArray,
  position: [0, 0, 0],
  color: props.color || '#4488ff',
  texture: props.texture?.url,
  metalness: props.metalness ?? 0.5,
  roughness: props.roughness ?? 0.5,
  emissive: props.color || '#4488ff',
  emissiveIntensity: props.emissiveIntensity || 0,
  doubleside: props.primType === 'plane',
  castShadow: true,
  receiveShadow: true,
})
currentPrim.position.y += props.scaleY / 2

app.add(currentPrim)

// for (let i = 0; i < 10000; i++) {
//   const c = currentPrim.clone(true)
//   c.position.set(
//     num(-300, 300, 3),
//     num(0, 10, 3),
//     num(-300, 300, 3),
//   )
//   app.add(c)
// }

app.on('update', dt => {
  // Auto rotate if enabled
  if (props.rotate && currentPrim) {
    currentPrim.rotation.y += dt * (props.rotationSpeed || 1)
  }
})

// Add info display
const info = app.create('ui', {
  width: 300,
  height: 50,
  size: 0.01,
  position: [0, 3, 0],
  billboard: 'y',
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  borderRadius: 10,
  padding: 10,
  flexDirection: 'column',
  gap: 5,
})

const title = app.create('uitext', {
  value: 'Primitive Switcher',
  fontSize: 20,
  color: '#ffffff',
  fontWeight: 'bold',
  textAlign: 'center',
})

const subtitle = app.create('uitext', {
  value: 'Use the props panel to change settings',
  fontSize: 14,
  color: '#aaaaaa',
  textAlign: 'center',
})

info.add(title)
info.add(subtitle)
app.add(info)

// console.log('Primitive Switcher ready!')
// console.log('Use the props panel in your browser to:')
// console.log('- Switch between primitive types')
// console.log('- Adjust scale, color, and materials')
// console.log('- Toggle rotation and glow effects')
// console.log('- Current primitive:', props.primType || 'box')
