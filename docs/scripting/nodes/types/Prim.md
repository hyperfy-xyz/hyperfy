# Prim

Creates primitive 3D shapes with built-in geometry caching for optimal performance.

Primitives origins are the in the middle of their shapes.

## Properties

### `.type`: String

The type of primitive shape to create. 

Available options: `box`, `sphere`, `cylinder`, `cone`, `torus`, `plane`.

Defaults to `box`.

### `.size`: Array

The size of the shape, depending on the `type` (defaults shown):

- **Box**: `[width = 1, height = 1, depth = 1]`
- **Sphere**: `[radius = 0.5]`
- **Cylinder**: `[radiusTop = 0.5, radiusBtm = 0.5, height = 1]`
- **Cone**: `[radius = 0.5, height = 1]`
- **Torus**: `[radius = 0.4, tubeRadius = 0.1]`
- **Plane**: `[width = 1, height = 1]`

Default sizes all roughly fit inside a 1m cubed space for consistency.

**Note**: The origin of all primitives are at the center of the volume. To position a primitive with its bottom at y=0:
- Box: `position.y = height / 2`
- Sphere: `position.y = radius`
- Cylinder: `position.y = height / 2`
- Cone: `position.y = height / 2`
- Torus: `position.y = innerRadius + tubeRadius`

### `.color`: String

The color of the primitive as a hex string (e.g., `#ff0000` for red).

Defaults to `#ffffff` (white).

### `.emissive`: String | null

The emissive (glow) color of the primitive. Defaults to `null` (no glow).

### `.emissiveIntensity`: Number

The intensity of the emissive glow. Defaults to `1`.

### `.metalness`: Number

How metallic the material appears, from 0.0 (non-metallic) to 1.0 (fully metallic). Defaults to `0.2`.

### `.roughness`: Number

How rough the material appears, from 0.0 (smooth/reflective) to 1.0 (rough/diffuse). Defaults to `0.8`.

### `.opacity`: Number

The opacity of the primitive, from 0.0 (fully transparent) to 1.0 (fully opaque). Defaults to `1`.

### `.transparent`: Boolean

Whether the primitive should be rendered with transparency. Must be `true` for opacity values less than 1 to take effect. Defaults to `false`.

### `.texture`: String | null

URL or path to a texture image to apply to the primitive. The texture will be loaded asynchronously and cached for reuse. Supports common image formats (PNG, JPG, etc.). Defaults to `null`.

### `.castShadow`: Boolean

Whether the primitive should cast shadows. Defaults to `true`.

### `.receiveShadow`: Boolean

Whether the primitive should receive shadows from other objects. Defaults to `true`.

### `.doubleside`: Boolean

Whether the primitive should be rendered from both sides. This is particularly useful for plane primitives that need to be visible from both front and back. Defaults to `false`.

### `.physics`: String | null

The physics body type for the primitive. Can be:
- `null` - No physics (default)
- `'static'` - Immovable objects (walls, floors, etc.)
- `'kinematic'` - Movable by code but not physics (platforms, doors)
- `'dynamic'` - Fully simulated physics objects

Defaults to `null`.

### `.mass`: Number

Physics mass for dynamic bodies. Only applies when physics is set to `'dynamic'`. Defaults to `1`.

### `.linearDamping`: Number

Physics linear velocity damping. Higher values make objects slow down faster. Defaults to `0`.

### `.angularDamping`: Number

Physics angular velocity damping. Higher values reduce rotation speed faster. Defaults to `0.05`.

### `.staticFriction`: Number

Physics material static friction. Determines resistance to start moving when at rest. Defaults to `0.6`.

### `.dynamicFriction`: Number

Physics material dynamic friction. Determines resistance while moving. Defaults to `0.6`.

### `.restitution`: Number

Physics material bounciness. 0 = no bounce, 1 = perfect bounce. Defaults to `0`.

### `.layer`: String

Physics collision layer. Defaults to `'environment'`.

### `.trigger`: Boolean

Whether this physics shape is a trigger volume (detects overlaps without causing collisions). Defaults to `false`.

### `.tag`: String | null

Tag for identifying physics bodies when raycasting etc. Defaults to `null`.

### `.onContactStart`: Function | null

Physics callback function, called when contact with another physics body begins. Receives the other body as parameter. Defaults to `null`.

### `.onContactEnd`: Function | null

Physics callback function, called when contact with another physics body ends. Receives the other body as parameter. Defaults to `null`.

### `.onTriggerEnter`: Function | null

Physics callback function, called when another body enters this trigger volume. Only works when `trigger` is `true`. Defaults to `null`.

### `.onTriggerLeave`: Function | null

Physics callback function, called when another body leaves this trigger volume. Only works when `trigger` is `true`. Defaults to `null`.

### `.{...Node}`

Inherits all [Node](/docs/scripting/nodes/Node.md) properties

## Examples

```javascript
// Create various primitives with different materials
const box = app.create('prim', {
  type: 'box',
  scale: [2, 1, 3],
  position: [0, 1, 0],
  color: '#ff0000',
  metalness: 0.8,
  roughness: 0.2
})

const sphere = app.create('prim', {
  type: 'sphere',
  scale: [0.5, 0.5, 0.5],
  position: [3, 1, 0],
  color: '#0000ff',
  emissive: '#00ff00', // Green glow
  emissiveIntensity: 2.0
})

// Transparent glass-like cylinder
const cylinder = app.create('prim', {
  type: 'cylinder',
  scale: [0.3, 2, 0.3],
  position: [-3, 1, 0],
  color: '#ffffff',
  transparent: true,
  opacity: 0.5,
  metalness: 0,
  roughness: 0
})

// Animated torus
const torus = app.create('prim', {
  type: 'torus',
  scale: [1, 1, 1],
  position: [0, 3, 0],
  color: '#ffff00'
})

// Textured plane (double-sided)
const texturedPlane = app.create('prim', {
  type: 'plane',
  scale: [2, 2, 1],
  position: [0, 1, -3],
  rotation: [-Math.PI/2, 0, 0],
  texture: 'https://example.com/texture.jpg',
  doubleside: true // Visible from both sides
})

app.add(box)
app.add(sphere)
app.add(cylinder)
app.add(torus)
app.add(texturedPlane)

// Animate emissive intensity
app.on('update', (dt) => {
  torus.rotation.y += 0.01
  torus.emissiveIntensity = Math.sin(Date.now() * 0.002) + 1.5
})

// Physics examples
// Static floor
const floor = app.create('prim', {
  type: 'box',
  scale: [10, 0.1, 10],
  position: [0, 0, 0],
  color: '#333333',
  physics: 'static'
})

// Dynamic bouncing ball
const ball = app.create('prim', {
  type: 'sphere',
  scale: [0.5, 0.5, 0.5],
  position: [0, 5, 0],
  color: '#ff0000',
  physics: 'dynamic',
  mass: 1,
  restitution: 0.8, // Bouncy!
  linearDamping: 0.1
})

// Trigger zone
const triggerZone = app.create('prim', {
  type: 'box',
  scale: [2, 2, 2],
  position: [5, 1, 0],
  color: '#00ff00',
  transparent: true,
  opacity: 0.3,
  physics: 'static',
  trigger: true,
  onTriggerEnter: (other) => {
    console.log('Something entered the zone!', other)
  },
  onTriggerLeave: (other) => {
    console.log('Something left the zone!', other)
  }
})

// Reactive physics properties
ball.tag = 'player_ball' // Can be changed at runtime
ball.restitution = 0.5   // Updates bounciness

app.add(floor)
app.add(ball)
app.add(triggerZone)
```

## Notes

- Primitives with identical material properties are automatically instanced for optimal performance
- Material properties (color, emissive, metalness, etc.) determine which primitives can be instanced together
- Changing material properties requires rebuilding the primitive instance
- Textures are loaded asynchronously and cached - multiple primitives using the same texture URL will share the loaded texture

### Physics Notes

- Physics shapes are automatically generated based on the primitive type
- `box` and `sphere` primitives have exact physics collision shapes
- `cylinder`, `cone`, and `torus` use box approximations for physics
- `plane` uses a thin box for collision
- Physics bodies are centered to match the visual geometry
- Dynamic bodies require the `mass` property to be set
- Trigger volumes don't cause physical collisions but can detect overlaps
- Physics callbacks (onContactStart, etc.) receive the other colliding object as a parameter
