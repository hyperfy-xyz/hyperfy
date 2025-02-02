# Physics

The Physics system in Hyperfy provides physics simulation, collision detection, and character movement using NVIDIA PhysX. It runs on both client and server, handling rigid bodies, triggers, character controllers, and raycasting.

### Properties

### `physics.scene`: PhysX.PxScene

The PhysX physics scene instance with the following configuration:
- Gravity: -9.81 m/s2 in Y direction
- TGS solver type for better stability
- Continuous Collision Detection (CCD) enabled
- GPU-accelerated broad phase
- Multi-threaded CPU dispatcher

### `physics.defaultMaterial`: PhysX.PxMaterial

Default physics material with:
- Friction: 0.2
- Restitution: 0.2
- Dynamic friction: 0.2

### Methods

### `physics.addActor(actor: PhysX.PxActor, handle: Object): ActorHandle`

Adds a physics actor to the scene with the specified handle.

Parameters:
- `actor`: The PhysX actor to add
- `handle`: Object containing callbacks and properties

Returns an actor handle with:
```typescript
{
  move(matrix: Matrix4): void,     // Move actor to matrix transform
  snap(pose: PxTransform): void,   // Instantly move actor without interpolation
  destroy(): void                  // Remove actor and clean up
}
```

### `physics.raycast(origin: Vector3, direction: Vector3, maxDistance: Number, layerMask: Number): RaycastHit | null`

Performs a raycast query in the physics scene.

Parameters:
- `origin`: Starting point of the ray
- `direction`: Direction of the ray
- `maxDistance`: Maximum distance to check
- `layerMask`: Collision layer mask for filtering

Returns hit information:
```typescript
{
  actor: PhysX.PxActor,     // Hit actor
  point: Vector3,           // Hit point
  normal: Vector3,          // Surface normal at hit point
  distance: Number          // Distance to hit point
}
```

### `physics.sweep(geometry: PhysX.PxGeometry, origin: Vector3, direction: Vector3, maxDistance: Number, layerMask: Number): SweepHit | null`

Performs a sweep query with the given geometry.

Parameters:
- `geometry`: Shape to sweep with
- `origin`: Starting position
- `direction`: Sweep direction
- `maxDistance`: Maximum distance
- `layerMask`: Collision layer mask

Returns hit information (same structure as raycast).

### `physics.overlap(geometry: PhysX.PxGeometry, origin: Vector3, layerMask: Number): OverlapHit | null`

Tests for overlaps with the given geometry.

Parameters:
- `geometry`: Shape to test
- `origin`: Position to test at
- `layerMask`: Collision layer mask

Returns:
```typescript
{
  actor: PhysX.PxActor      // Overlapping actor
}
```

### Contact Events

The system provides contact and trigger event callbacks:

### `onContactStart(event: ContactEvent)`

Called when two non-trigger colliders start touching:
```typescript
{
  tag: String,              // Tag of other object
  player: Object,           // Player reference if applicable
  contacts: [{              // Array of contact points
    position: Vector3,      // Contact position
    normal: Vector3,        // Contact normal
    impulse: Vector3        // Contact impulse
  }]
}
```

### `onContactEnd(event: ContactEvent)`

Called when two non-trigger colliders stop touching.

### `onTriggerEnter(result: TriggerResult)`

Called when an object enters a trigger volume:
```typescript
{
  tag: String,              // Tag of entering object
  player: Object           // Player reference if applicable
}
```

### `onTriggerLeave(result: TriggerResult)`

Called when an object leaves a trigger volume.

### Notes

- Uses fixed timestep simulation with interpolation
- Supports continuous collision detection
- Provides character controller system
- Handles contact and trigger events
- Supports collision filtering via layers
- Automatically manages actor lifecycle

### Usage

The Physics system is used to:

1. Create physical objects and constraints
2. Handle character movement
3. Perform collision queries
4. Detect object interactions
5. Simulate physics-based gameplay

### Example

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Create a physical box
      const boxRigidBody = app.create('RigidBody')
      boxRigidBody.type = 'dynamic'
      
      const boxCollider = app.create('Collider')
      boxCollider.type = 'box'
      boxCollider.setSize(1, 1, 1)
      
      // Add contact handlers
      boxCollider.onContactStart = (event) => {
        console.log('Box collided with:', event.tag)
        console.log('Contact points:', event.contacts)
        
        // Apply force at contact point
        const contact = event.contacts[0]
        const force = contact.normal.multiplyScalar(10)
        boxRigidBody.applyForce(force)
      }
      
      boxRigidBody.add(boxCollider)
      app.add(boxRigidBody)
      
      // Create a trigger volume
      const triggerBody = app.create('RigidBody')
      triggerBody.type = 'static'
      
      const triggerCollider = app.create('Collider')
      triggerCollider.type = 'box'
      triggerCollider.setSize(2, 2, 2)
      triggerCollider.trigger = true
      
      // Add trigger handlers
      triggerCollider.onTriggerEnter = (result) => {
        console.log('Object entered trigger:', result.tag)
        if (result.player) {
          this.handlePlayerEntered(result.player)
        }
      }
      
      triggerCollider.onTriggerLeave = (result) => {
        console.log('Object left trigger:', result.tag)
        if (result.player) {
          this.handlePlayerLeft(result.player)
        }
      }
      
      triggerBody.add(triggerCollider)
      app.add(triggerBody)
      
      // Store references
      this.boxRigidBody = boxRigidBody
      this.triggerBody = triggerBody
    },
    
    update() {
      // Perform raycast
      const origin = this.boxRigidBody.position
      const direction = new THREE.Vector3(0, -1, 0)
      const hit = world.physics.raycast(
        origin,
        direction,
        10,
        Layers.environment.group
      )
      
      if (hit) {
        console.log('Ground distance:', hit.distance)
      }
      
      // Perform sweep test
      const boxGeometry = new PHYSX.PxBoxGeometry(0.5, 0.5, 0.5)
      const sweepHit = world.physics.sweep(
        boxGeometry,
        origin,
        direction,
        10,
        Layers.environment.group
      )
      
      if (sweepHit) {
        console.log('Collision ahead at:', sweepHit.point)
      }
    },
    
    handlePlayerEntered(player) {
      // Handle player entering trigger
    },
    
    handlePlayerLeft(player) {
      // Handle player leaving trigger
    }
  }
}
```

This example demonstrates:
- Creating physical objects with colliders
- Handling contacts and triggers
- Using raycasts and sweeps
- Working with collision layers
- Responding to physics events

Remember that physics simulation can be performance-intensive, so use appropriate collision shapes and avoid creating too many dynamic bodies.
