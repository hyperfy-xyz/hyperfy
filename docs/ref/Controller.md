# Controller

The Controller component in Hyperfy provides character movement and collision handling using a capsule-shaped character controller. It's designed for precise character movement with features like slope climbing, step handling, and collision detection.

### Inheritance

Controller inherits all properties and methods from [Node](/docs/ref/Node.md).

### Properties

### `controller.radius`: Number

The radius of the capsule controller in meters. Default is 0.4.

### `controller.height`: Number

The height of the capsule controller in meters (excluding the rounded ends). Default is 1.0.

### `controller.visible`: Boolean

Whether to display a visual representation of the controller capsule. Default is false.

### Methods

### `controller.move(vec3: Vector3): void`

Moves the controller by the specified displacement vector, handling collisions and slopes.

Parameters:
- `vec3`: The movement vector in world space

### `controller.teleport(vec3: Vector3): void`

Instantly moves the controller to the specified position, ignoring collisions.

Parameters:
- `vec3`: The target position in world space

### `controller.isGrounded(): Boolean`

Returns whether the controller is currently touching the ground.

### `controller.isCeiling(): Boolean`

Returns whether the controller is currently touching a ceiling.

### Notes

- The controller uses PhysX for accurate character movement and collision detection
- Automatically handles stepping over small obstacles (configurable step height)
- Can climb slopes up to 60 degrees by default
- Maintains a small contact offset for stable collision detection
- The visual representation (when visible) includes shadows and can help with debugging

### Usage

Controllers are used to:

1. Implement character movement with proper collision handling
2. Create NPCs that need to navigate the environment
3. Handle player movement in first or third person games
4. Create physics-based character interactions

### Example

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Create a character with controller
      const character = app.create('Group')
      
      // Add visual representation
      const characterMesh = app.create('Mesh')
      character.add(characterMesh)
      
      // Add controller for movement
      const controller = app.create('Controller')
      controller.radius = 0.3  // Adjust for character size
      controller.height = 1.7  // Typical human height
      
      // For debugging, make the controller visible
      controller.visible = true
      
      // Add to scene
      character.add(controller)
      app.add(character)
      
      // Store references
      this.character = character
      this.controller = controller
      
      // Set up movement controls
      this.moveDirection = new THREE.Vector3()
      this.moveSpeed = 5  // meters per second
      
      // Set up input handling
      this.setupControls()
    },
    
    setupControls() {
      // Handle keyboard input
      world.on('keydown', (event) => {
        switch(event.code) {
          case 'KeyW':
            this.moveDirection.z = -1
            break
          case 'KeyS':
            this.moveDirection.z = 1
            break
          case 'KeyA':
            this.moveDirection.x = -1
            break
          case 'KeyD':
            this.moveDirection.x = 1
            break
          case 'Space':
            this.jump()
            break
        }
      })
      
      world.on('keyup', (event) => {
        switch(event.code) {
          case 'KeyW':
          case 'KeyS':
            this.moveDirection.z = 0
            break
          case 'KeyA':
          case 'KeyD':
            this.moveDirection.x = 0
            break
        }
      })
    },
    
    update(dt) {
      // Skip if no movement
      if (this.moveDirection.lengthSq() === 0) return
      
      // Calculate movement vector
      const movement = this.moveDirection.clone()
        .normalize()
        .multiplyScalar(this.moveSpeed * dt)
      
      // Apply movement
      this.controller.move(movement)
      
      // Update character rotation to face movement direction
      if (movement.lengthSq() > 0) {
        const angle = Math.atan2(movement.x, movement.z)
        this.character.rotation.y = angle
      }
      
      // Check ground contact
      if (this.controller.isGrounded()) {
        // Handle ground movement
        this.handleGroundMovement()
      } else {
        // Handle air movement
        this.handleAirMovement()
      }
    },
    
    handleGroundMovement() {
      // Add ground-specific movement logic
      // For example, increased control or friction
    },
    
    handleAirMovement() {
      // Add air-specific movement logic
      // For example, reduced control or gravity
    },
    
    jump() {
      // Only jump if grounded
      if (this.controller.isGrounded()) {
        const jumpVelocity = new THREE.Vector3(0, 5, 0)
        this.controller.move(jumpVelocity)
      }
    },
    
    // Example of teleporting the character
    teleportToSpawn() {
      const spawnPoint = new THREE.Vector3(0, 2, 0)
      this.controller.teleport(spawnPoint)
    }
  }
}
```

This example demonstrates:
- Setting up a character controller with custom dimensions
- Handling keyboard input for movement
- Implementing basic character movement and rotation
- Using ground detection for movement states
- Implementing jumping mechanics
- Teleporting the character when needed

Remember that the Controller component is optimized for character movement and should be used in conjunction with other components like [RigidBody](/docs/ref/RigidBody.md) and [Collider](/docs/ref/Collider.md) when building more complex physics interactions.
