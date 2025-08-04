// Simple trigger test - debugging trigger zones

// Create floor
const floor = app.create('prim', {
  kind: 'box',
  scale: [20, 0.2, 20],
  position: [0, -0.1, 0],
  color: '#2a2a2a',
  physics: 'static'
})
app.add(floor)

// Create a trigger zone that's tall enough
const trigger = app.create('prim', {
  kind: 'box',
  scale: [4, 4, 4],
  position: [0, 2, 0], // Centered at y=2 so it extends from 0 to 4
  color: '#00ff00',
  transparent: true,
  opacity: 0.3,
  physics: 'static',
  physicsTrigger: true,
  physicsTag: 'test_trigger',
  physicsOnTriggerEnter: (other) => {
    console.log('=== TRIGGER ENTER ===')
    console.log('Full object:', other)
    console.log('Type:', typeof other)
    console.log('Keys:', Object.keys(other))
    console.log('Tag:', other.tag)
    console.log('PlayerId:', other.playerId)
    console.log('Node:', other.node)
    console.log('==================')
  },
  physicsOnTriggerLeave: (other) => {
    console.log('=== TRIGGER LEAVE ===')
    console.log('Tag:', other.tag)
    console.log('==================')
  }
})
app.add(trigger)

// Create a test ball that will fall through the trigger
const ball = app.create('prim', {
  kind: 'sphere',
  scale: [0.5, 0.5, 0.5],
  position: [0, 6, 0],
  color: '#ff0000',
  emissive: '#ff0000',
  emissiveIntensity: 0.5,
  physics: 'dynamic',
  physicsMass: 1,
  physicsRestitution: 0.5,
  physicsTag: 'test_ball'
})
app.add(ball)

// Add a ramp to roll the ball
const ramp = app.create('prim', {
  kind: 'box',
  scale: [2, 0.1, 6],
  position: [-5, 1.5, 0],
  rotation: [0, 0, -0.3],
  color: '#666666',
  physics: 'static'
})
app.add(ramp)

// Create another ball on the ramp
const rollingBall = app.create('prim', {
  kind: 'sphere',
  scale: [0.3, 0.3, 0.3],
  position: [-6, 3, 0],
  color: '#0000ff',
  physics: 'dynamic',
  physicsMass: 0.5,
  physicsRestitution: 0.3,
  physicsLinearDamping: 0.1,
  physicsTag: 'rolling_ball'
})
app.add(rollingBall)

// Add labels
const triggerLabel = app.create('ui', {
  width: 200,
  height: 40,
  size: 0.01,
  position: [0, 5, 0],
  billboard: 'y',
  backgroundColor: 'rgba(0, 255, 0, 0.8)',
  borderRadius: 5,
  padding: 5,
})
triggerLabel.add(app.create('uitext', {
  value: 'TRIGGER ZONE',
  fontSize: 24,
  color: '#ffffff',
  textAlign: 'center',
}))
app.add(triggerLabel)

console.log('Trigger test ready!')
console.log('- Red ball will fall through trigger')
console.log('- Blue ball will roll down ramp through trigger')
console.log('- Check console for trigger events')
console.log('- Trigger extends from y=0 to y=4')