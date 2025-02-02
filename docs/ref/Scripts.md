# Scripts

The Scripts system in Hyperfy provides secure script execution using compartments. It runs on both client and server, allowing for safe evaluation of user scripts with access to essential utilities and Three.js functionality.

### Properties

### `scripts.compartment`: Compartment

A secure execution environment with access to the following globals:

```typescript
{
  // Console utilities
  console: {
    log(...args: any[]): void,
    error(...args: any[]): void,
    time(label: string): void,
    timeEnd(label: string): void
  },
  
  // Math utilities
  num: Function,           // Number parsing utility
  clamp: Function,         // Value clamping utility
  DEG2RAD: Number,        // Degrees to radians conversion
  RAD2DEG: Number,        // Radians to degrees conversion
  
  // Three.js classes
  Object3D: THREE.Object3D,
  Quaternion: THREE.Quaternion,
  Vector3: THREE.Vector3,
  Euler: THREE.Euler,
  Matrix4: THREE.Matrix4,
  
  // Interpolation utilities
  LerpVector3: Class,      // Vector3 interpolation
  LerpQuaternion: Class,   // Quaternion interpolation
  
  // Utility functions
  uuid(): string          // UUID generation
}
```

### Methods

### `scripts.evaluate(code: String): ScriptResult`

Evaluates script code in a secure compartment.

Parameters:
- `code`: The script code to evaluate

Returns:
```typescript
{
  exec(world: World, app: App, fetch: Function): any,  // Execute the script
  code: String                                         // Original script code
}
```

### Notes

- Scripts run in a secure compartment with limited global access
- Each script has its own shared state object
- Scripts receive world, app, and fetch parameters
- Unsafe operations like eval are disabled
- Scripts can access essential Three.js functionality

### Usage

The Scripts system is used to:

1. Execute user-provided scripts safely
2. Provide access to essential utilities
3. Enable Three.js operations
4. Maintain script isolation
5. Share state between script executions

### Example

```javascript
// Example of creating and evaluating a script
const scriptCode = `
  // Shared state persists between executions
  if (!shared.counter) shared.counter = 0
  
  return {
    start() {
      // Create a rotating cube
      const cube = app.create('Mesh')
      
      // Use Vector3 from compartment
      cube.position = new Vector3(0, 1, 0)
      
      // Store reference
      this.cube = cube
      
      // Add to scene
      app.add(cube)
      
      // Track executions in shared state
      shared.counter++
      console.log('Script executed:', shared.counter, 'times')
    },
    
    update(dt) {
      // Use DEG2RAD from compartment
      this.cube.rotation.y += 45 * DEG2RAD * dt
      
      // Use clamp utility
      const scale = clamp(Math.sin(world.time), 0.5, 2)
      this.cube.scale.setScalar(scale)
    }
  }
`

// Evaluate the script
const script = world.scripts.evaluate(scriptCode)

// Execute the script
const instance = script.exec(world, app, fetch)

// Call lifecycle methods
instance.start()

// Example of using interpolation utilities
const scriptWithLerp = `
  return {
    start() {
      // Create interpolators
      this.positionLerp = new LerpVector3()
      this.rotationLerp = new LerpQuaternion()
      
      // Create object to animate
      const object = app.create('Mesh')
      this.object = object
      app.add(object)
      
      // Set target positions
      this.positionLerp.setTarget(new Vector3(0, 2, 0))
      
      // Set target rotation (90 degrees around Y)
      const targetRotation = new Quaternion()
      targetRotation.setFromAxisAngle(new Vector3(0, 1, 0), 90 * DEG2RAD)
      this.rotationLerp.setTarget(targetRotation)
    },
    
    update(dt) {
      // Update interpolators
      this.positionLerp.update(dt)
      this.rotationLerp.update(dt)
      
      // Apply to object
      this.object.position.copy(this.positionLerp.current)
      this.object.quaternion.copy(this.rotationLerp.current)
    }
  }
`

// Example of using math utilities
const mathScript = `
  return {
    start() {
      // Parse numbers safely
      const value = num('123.45')
      console.log('Parsed:', value)
      
      // Clamp values
      const clamped = clamp(value, 0, 100)
      console.log('Clamped:', clamped)
      
      // Generate unique IDs
      const id = uuid()
      console.log('Generated ID:', id)
    }
  }
`
```

This example demonstrates:
- Creating and evaluating scripts
- Using compartment utilities
- Working with Three.js objects
- Using interpolation helpers
- Maintaining shared state
- Accessing math utilities

Remember that scripts run in a secure environment with limited access to globals. Only explicitly provided functionality is available to scripts.
