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

### `.doubleSided`: Boolean

Whether the primitive should be rendered from both sides. This is particularly useful for plane primitives that need to be visible from both front and back. Defaults to `false`.

### `.physics`: Boolean | Object | null

Enables physics for the primitive. Can be:
- `true` - Enables static physics with default settings
- `Object` - Detailed physics configuration (see below)
- `null` - No physics (default)

When passing an object, the following properties are available:

```javascript
{
  type: 'static' | 'kinematic' | 'dynamic',  // Physics body type (default: 'static')
  mass: Number,                               // Mass in kg for dynamic bodies (default: 1)
  linearDamping: Number,                      // Linear velocity damping 0-1 (default: 0)
  angularDamping: Number,                     // Angular velocity damping 0-1 (default: 0.05)
  staticFriction: Number,                     // Static friction coefficient 0-1 (default: 0.6)
  dynamicFriction: Number,                    // Dynamic friction coefficient 0-1 (default: 0.6)
  restitution: Number,                        // Bounciness 0-1 (default: 0)
  layer: String,                              // Collision layer (default: 'environment')
  trigger: Boolean,                           // Is trigger volume? (default: false)
  tag: String,                                // Custom tag for identification
  onContactStart: Function,                   // Called when contact begins
  onContactEnd: Function,                     // Called when contact ends
  onTriggerEnter: Function,                   // Called when entering trigger (trigger only)
  onTriggerLeave: Function,                   // Called when leaving trigger (trigger only)
}
```

Physics types:
- `static` - Immovable objects (walls, floors, etc.)
- `kinematic` - Movable by code but not physics (platforms, doors)
- `dynamic` - Fully simulated physics objects

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
  doubleSided: true // Visible from both sides
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
  physics: true // Static by default
})

// Dynamic bouncing ball
const ball = app.create('prim', {
  kind: 'sphere',
  scale: [0.5, 0.5, 0.5],
  position: [0, 5, 0],
  color: '#ff0000',
  physics: {
    type: 'dynamic',
    mass: 1,
    restitution: 0.8, // Bouncy!
    linearDamping: 0.1
  }
})

// Trigger zone
const triggerZone = app.create('prim', {
  kind: 'box',
  scale: [2, 2, 2],
  position: [5, 1, 0],
  color: '#00ff00',
  transparent: true,
  opacity: 0.3,
  physics: {
    type: 'static',
    trigger: true,
    onTriggerEnter: (other) => {
      console.log('Something entered the zone!', other)
    },
    onTriggerLeave: (other) => {
      console.log('Something left the zone!', other)
    }
  }
})

app.add(floor)
app.add(ball)
app.add(triggerZone)
```

## Notes

- Use the `scale` property (inherited from Node) to control the size of primitives
- For spheres, use uniform scale (e.g., `scale: [0.5, 0.5, 0.5]` for a radius of 0.5)
- For cylinders/cones, X and Z control radius, Y controls height
- For torus, use uniform scale to control the major radius
- Primitives with identical material properties are automatically instanced for optimal performance
- Material properties (color, emissive, metalness, etc.) determine which primitives can be instanced together
- Changing material properties requires rebuilding the primitive instance
- Textures are loaded asynchronously and cached - multiple primitives using the same texture URL will share the loaded texture

### Physics Notes

- Physics shapes are automatically generated based on the primitive type
- `box` and `sphere` primitives have exact physics collision shapes
- `cylinder`, `cone`, and `torus` use box approximations for physics
- `plane` uses a thin box for collision
- Physics bodies are positioned with their bottom at y=0 to match the visual geometry
- Dynamic bodies require the `mass` property to be set
- Trigger volumes don't cause physical collisions but can detect overlaps
- Physics callbacks (onContactStart, etc.) receive the other colliding object as a parameter