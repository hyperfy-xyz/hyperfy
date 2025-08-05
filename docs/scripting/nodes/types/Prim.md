# Prim

Creates primitive 3D shapes with built-in geometry caching for optimal performance.

## Properties

### `.kind`: String

The type of primitive shape to create. 

Available options: `box`, `sphere`, `cylinder`, `cone`, `torus`, `plane`.

Defaults to `box`.


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

### `.scale`: Array (inherited from Node)

Controls the size of the primitive using a 3-component array `[x, y, z]`. Since primitives use unit-sized geometry, the scale directly determines the final dimensions.

**Scale behavior by primitive type:**
- **Box**: `[width, height, depth]` - Direct mapping to box dimensions
- **Sphere**: `[radius, radius, radius]` - Use uniform scale for proper spheres
- **Cylinder**: `[radius, height, radius]` - X/Z control radius, Y controls height
- **Cone**: `[radius, height, radius]` - X/Z control base radius, Y controls height  
- **Torus**: `[radius, radius, radius]` - Use uniform scale for major radius (tube radius is 0.3× major)
- **Plane**: `[width, height, 1]` - X/Y control dimensions, Z typically kept at 1

Defaults to `[1, 1, 1]`.

**Note**: Primitives are centered at their origin. To position a primitive with its bottom at y=0:
- Box/Cylinder/Cone: `position.y = scale.y / 2`
- Sphere: `position.y = scale.x` (assuming uniform scale)
- Torus: `position.y = scale.x * 1.3` (major radius + tube radius)

### `.physics`: String | null

The physics body type for the primitive. Can be:
- `null` - No physics (default)
- `'static'` - Immovable objects (walls, floors, etc.)
- `'kinematic'` - Movable by code but not physics (platforms, doors)
- `'dynamic'` - Fully simulated physics objects

Defaults to `null`.

### `.physicsMass`: Number

The mass in kg for dynamic bodies. Only applies when physics is set to `'dynamic'`. Defaults to `1`.

### `.physicsLinearDamping`: Number

Linear velocity damping factor from 0 to 1. Higher values make objects slow down faster. Defaults to `0`.

### `.physicsAngularDamping`: Number

Angular velocity damping factor from 0 to 1. Higher values reduce rotation speed faster. Defaults to `0.05`.

### `.physicsStaticFriction`: Number

Static friction coefficient from 0 to 1. Determines resistance to start moving when at rest. Defaults to `0.6`.

### `.physicsDynamicFriction`: Number

Dynamic friction coefficient from 0 to 1. Determines resistance while moving. Defaults to `0.6`.

### `.physicsRestitution`: Number

Bounciness factor from 0 to 1. 0 = no bounce, 1 = perfect bounce. Defaults to `0`.

### `.physicsLayer`: String

The collision layer for physics filtering. Defaults to `'environment'`.

### `.physicsTrigger`: Boolean

Whether this is a trigger volume (detects overlaps without causing collisions). Defaults to `false`.

### `.physicsTag`: String | null

Custom tag for identifying physics bodies. Defaults to `null`.

### `.physicsOnContactStart`: Function | null

Callback function called when contact with another physics body begins. Receives the other body as parameter. Defaults to `null`.

### `.physicsOnContactEnd`: Function | null

Callback function called when contact with another physics body ends. Receives the other body as parameter. Defaults to `null`.

### `.physicsOnTriggerEnter`: Function | null

Callback function called when another body enters this trigger volume. Only works when `physicsTrigger` is `true`. Defaults to `null`.

### `.physicsOnTriggerLeave`: Function | null

Callback function called when another body leaves this trigger volume. Only works when `physicsTrigger` is `true`. Defaults to `null`.

### `.{...Node}`

Inherits all [Node](/docs/scripting/nodes/Node.md) properties

## Examples

```javascript
// Create various primitives with different materials
const box = app.create('prim', {
  kind: 'box',
  scale: [2, 1, 3],
  position: [0, 1, 0],
  color: '#ff0000',
  metalness: 0.8,
  roughness: 0.2
})

const sphere = app.create('prim', {
  kind: 'sphere',
  scale: [0.5, 0.5, 0.5],
  position: [3, 1, 0],
  color: '#0000ff',
  emissive: '#00ff00', // Green glow
  emissiveIntensity: 2.0
})

// Transparent glass-like cylinder
const cylinder = app.create('prim', {
  kind: 'cylinder',
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
  kind: 'torus',
  scale: [1, 1, 1],
  position: [0, 3, 0],
  color: '#ffff00'
})

// Textured plane (double-sided)
const texturedPlane = app.create('prim', {
  kind: 'plane',
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
  kind: 'box',
  scale: [10, 0.1, 10],
  position: [0, 0, 0],
  color: '#333333',
  physics: 'static'
})

// Dynamic bouncing ball
const ball = app.create('prim', {
  kind: 'sphere',
  scale: [0.5, 0.5, 0.5],
  position: [0, 5, 0],
  color: '#ff0000',
  physics: 'dynamic',
  physicsMass: 1,
  physicsRestitution: 0.8, // Bouncy!
  physicsLinearDamping: 0.1
})

// Trigger zone
const triggerZone = app.create('prim', {
  kind: 'box',
  scale: [2, 2, 2],
  position: [5, 1, 0],
  color: '#00ff00',
  transparent: true,
  opacity: 0.3,
  physics: 'static',
  physicsTrigger: true,
  physicsOnTriggerEnter: (other) => {
    console.log('Something entered the zone!', other)
  },
  physicsOnTriggerLeave: (other) => {
    console.log('Something left the zone!', other)
  }
})

// Reactive physics properties
ball.physicsTag = 'player_ball' // Can be changed at runtime
ball.physicsRestitution = 0.5   // Updates bounciness

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