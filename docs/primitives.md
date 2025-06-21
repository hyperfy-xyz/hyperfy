# Primitives

Hyperfy provides convenient methods to create primitive meshes directly from scripts without needing to load external 3D models. These primitives are lightweight, instanced objects that integrate seamlessly with the physics and rendering systems.

## Available Primitives

### Box

Creates a rectangular box mesh.

```js
const box = world.box({
  width: 1,    // Width along X axis (default: 1)
  height: 1,   // Height along Y axis (default: 1)
  depth: 1     // Depth along Z axis (default: 1)
})
```

### Sphere

Creates a spherical mesh.

```js
const sphere = world.sphere({
  radius: 0.5  // Sphere radius (default: 0.5)
})
```

### Cylinder

Creates a cylindrical mesh.

```js
const cylinder = world.cylinder({
  radiusTop: 0.5,     // Top radius (default: 0.5)
  radiusBottom: 0.5,  // Bottom radius (default: 0.5)
  height: 1,          // Height along Y axis (default: 1)
  radialSegments: 8   // Number of segments around circumference (default: 8)
})
```

### Cone

Creates a conical mesh.

```js
const cone = world.cone({
  radius: 0.5,        // Base radius (default: 0.5)
  height: 1,          // Height along Y axis (default: 1)
  radialSegments: 8   // Number of segments around circumference (default: 8)
})
```

## Generic Method

You can also use the generic `spawnMesh` method to create any primitive type:

```js
const mesh = world.spawnMesh({
  type: 'box',     // Required: 'box', 'sphere', 'cylinder', or 'cone'
  width: 2,        // Type-specific parameters
  height: 1,
  depth: 1
})
```

## Common Properties

All primitives are [Mesh nodes](/docs/ref/Mesh.md) and inherit standard node properties:

### Transform Properties
```js
// Position
primitive.position.set(x, y, z)
primitive.position.x = 5

// Rotation (in radians)
primitive.rotation.set(x, y, z)
primitive.rotation.y = Math.PI / 2

// Scale
primitive.scale.set(x, y, z)
primitive.scale.setScalar(2)  // Uniform scale

// Quaternion (alternative to rotation)
primitive.quaternion.setFromEuler(euler)
```

### Material Properties
```js
// Color (string format: named colors, hex, rgb, hsl)
primitive.material.color = 'red'
primitive.material.color = '#ff0000'
primitive.material.color = 'rgb(255, 0, 0)'

// Emissive (self-illumination)
primitive.material.emissive = '#003300'
primitive.material.emissiveIntensity = 0.5

// Other material properties
primitive.material.metalness = 0.5      // 0-1, default: 0
primitive.material.roughness = 0.7      // 0-1, default: 1
primitive.material.fog = false          // Affected by fog, default: true
```

### Visibility and Shadows
```js
primitive.active = false        // Hide/show the primitive
primitive.castShadow = true     // Cast shadows (default: true)
primitive.receiveShadow = true  // Receive shadows (default: true)
```

## Physics (RigidBody)

You can optionally create primitives with physics enabled by adding a `rigidbody` option. This automatically creates a rigidbody parent with a matching collider:

```js
// Simple physics - creates a dynamic rigidbody
const physicsBox = world.box({
  width: 1,
  height: 1,
  depth: 1,
  rigidbody: true  // Creates dynamic rigidbody with default settings
})

// Advanced physics configuration
const physicsSphere = world.sphere({
  radius: 0.5,
  rigidbody: {
    type: 'dynamic',        // 'static', 'kinematic', or 'dynamic'
    mass: 2,                // Mass in kg (default: 1)
    linearDamping: 0.1,     // Linear velocity damping (default: 0)
    angularDamping: 0.5,    // Angular velocity damping (default: 0.05)
    layer: 'prop',          // Collision layer (default: 'prop')
    trigger: false,         // Is it a trigger? (default: false)
    convex: false,          // Use convex collider? (default: false)
    tag: 'pickup',          // Custom tag for identification
    onContactStart: (other) => {
      console.log('Contact started with:', other.tag)
    },
    onContactEnd: (other) => {
      console.log('Contact ended with:', other.tag)
    }
  }
})

// The returned object is the rigidbody, with the mesh as a child
physicsBox.position.set(0, 5, -3)  // Drop from height
physicsBox.setLinearVelocity(new Vector3(0, -1, 0))
```

### Physics Properties

When `rigidbody` is enabled, the returned object is the rigidbody node (not the mesh). The mesh becomes a child of the rigidbody. This gives you access to physics methods:

```js
// Physics methods
primitive.addForce(force, mode)
primitive.addTorque(torque, mode)
primitive.setLinearVelocity(velocity)
primitive.setAngularVelocity(velocity)
primitive.getLinearVelocity()
primitive.getAngularVelocity()

// Access the mesh child for visual properties
primitive.children[0].material.color = 'red'  // First child is the mesh
```

### Collider Shapes

- **Box**: Exact box collider matching dimensions
- **Sphere**: Exact sphere collider matching radius
- **Cylinder/Cone**: Currently use box approximation (cylinder/cone colliders coming soon)

## Cloning Primitives

Yes, you can clone primitives! Use the standard node cloning method:

```js
// Create original
const originalBox = world.box({ width: 1, height: 2, depth: 1 })
originalBox.position.set(0, 1, -5)
originalBox.material.color = 'blue'

// Clone it
const clonedBox = originalBox.clone()
clonedBox.position.set(2, 1, -5)  // Position the clone elsewhere
clonedBox.material.color = 'red'   // Give it a different color

// Add the clone to the world
world.add(clonedBox)
```

### Deep Cloning

By default, `clone()` creates a shallow copy. For a deep clone (including all children):

```js
const deepClone = originalNode.clone(true)  // true = recursive
```

## Complete Example

```js
export default {
  init() {
    // Create a variety of primitives
    this.primitives = []
    
    // Rotating box
    const box = world.box({ width: 1, height: 1, depth: 1 })
    box.position.set(-3, 1, -5)
    box.material.color = '#ff0000'
    box.material.emissiveIntensity = 0.2
    this.primitives.push(box)
    
    // Metallic sphere
    const sphere = world.sphere({ radius: 0.5 })
    sphere.position.set(-1, 1, -5)
    sphere.material.color = '#0080ff'
    sphere.material.metalness = 1
    sphere.material.roughness = 0.2
    this.primitives.push(sphere)
    
    // Tapered cylinder (different top/bottom radii)
    const cylinder = world.cylinder({
      radiusTop: 0.2,
      radiusBottom: 0.5,
      height: 1.5,
      radialSegments: 16  // Smoother cylinder
    })
    cylinder.position.set(1, 0.75, -5)
    cylinder.material.color = '#00ff00'
    this.primitives.push(cylinder)
    
    // Clone the sphere
    const clonedSphere = sphere.clone()
    clonedSphere.position.set(3, 1, -5)
    clonedSphere.material.color = '#ff00ff'
    world.add(clonedSphere)
    this.primitives.push(clonedSphere)
  },
  
  update() {
    // Animate primitives
    const time = world.getTime() * 0.001
    this.primitives.forEach((prim, i) => {
      prim.rotation.y = time + (i * Math.PI / 2)
    })
  },
  
  destroy() {
    // Clean up all primitives
    this.primitives.forEach(prim => {
      world.remove(prim)
    })
  }
}
```

## Performance Considerations

1. **Instancing**: Primitives with identical geometry and material properties are automatically instanced for better performance
2. **Geometry Caching**: Primitive geometries are cached and reused to minimize memory usage
3. **Material Sharing**: Use the same material properties when possible to benefit from instancing
4. **Cleanup**: Always remove primitives in the `destroy()` method to prevent memory leaks

## Limitations

1. **Material Changes**: You cannot replace the entire material object, only modify its properties
2. **Geometry Modifications**: Primitive geometry cannot be modified after creation (create a new primitive instead)
3. **Custom Shaders**: Primitives use the standard material system and don't support custom shaders directly

## Tips

- Primitives spawn at origin (0,0,0) by default - always set their position
- Use hex strings for consistent color representation
- For invisible colliders, create a primitive and set `primitive.active = false`
- Combine multiple primitives using parent-child relationships for complex shapes