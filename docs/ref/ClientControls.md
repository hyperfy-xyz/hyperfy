# ClientControls

The ClientControls system in Hyperfy manages user input and camera controls with a priority-based control system. It handles keyboard, mouse, touch, and pointer lock interactions, providing a unified interface for input handling across different control schemes.

### Properties

### `controls.pointer`: Object

Information about the pointer (mouse/touch) state:
```typescript
{
  locked: Boolean,      // Whether pointer is locked (for FPS-style controls)
  coords: Vector3,      // Normalized coordinates [0,0] to [1,1]
  position: Vector3,    // Screen coordinates in pixels
  delta: Vector3        // Movement delta since last frame
}
```

### `controls.screen`: Object

Information about the viewport dimensions:
```typescript
{
  width: Number,    // Viewport width in pixels
  height: Number    // Viewport height in pixels
}
```

### `controls.scroll`: Object

Information about scroll wheel input:
```typescript
{
  delta: Number     // Scroll delta since last frame
}
```

### Methods

### `controls.bind(options: Object): ControlAPI`

Creates a new control binding with the specified options and priority.

Parameters:
```typescript
{
  priority: Number,           // Control priority (higher = more priority)
  onPress?: Function,        // Called when button/key is pressed
  onRelease?: Function,      // Called when button/key is released
  onPointer?: Function,      // Called when pointer moves
  onScroll?: Function,       // Called when scroll wheel moves
  onTouch?: Function,        // Called when touch starts
  onTouchEnd?: Function      // Called when touch ends
}
```

Returns a control API object with:
```typescript
{
  buttons: Object,           // Current button states
  pressed: Object,          // Buttons pressed this frame
  released: Object,         // Buttons released this frame
  pointer: {
    coords: Vector3,        // Normalized coordinates
    position: Vector3,      // Screen coordinates
    delta: Vector3,         // Movement delta
    locked: Boolean,        // Pointer lock state
    lock(): void,          // Request pointer lock
    unlock(): void         // Release pointer lock
  },
  scroll: {
    delta: Number          // Scroll delta
  },
  camera: {
    position: Vector3,     // Camera position
    quaternion: Quaternion,// Camera rotation
    rotation: Euler,       // Camera euler angles
    zoom: Number,          // Camera zoom
    claimed: Boolean,      // Whether this control owns the camera
    claim(): void,        // Claim camera control
    unclaim(): void       // Release camera control
  },
  screen: {
    width: Number,        // Viewport width
    height: Number        // Viewport height
  },
  release(): void         // Release this control binding
}
```

### Notes

- Control bindings are processed in priority order (higher priority = processed first)
- Only one control can claim the camera at a time
- Input is ignored when focused on input elements (textboxes, etc.)
- Touch input provides multi-touch support with individual touch tracking
- Pointer lock is used for FPS-style mouse look controls

### Usage

The ClientControls system is used to:

1. Handle user input for character movement
2. Implement camera controls
3. Create UI interactions
4. Support both desktop and mobile input

### Example

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Create a basic character controller
      const control = world.controls.bind({
        priority: 0,  // Low priority for basic controls
        
        // Handle key/button presses
        onPress(code) {
          switch(code) {
            case 'KeyW':
              this.moveForward = true
              break
            case 'KeyS':
              this.moveBackward = true
              break
            case 'Space':
              this.jump()
              break
            case 'MouseRight':
              // Start camera look
              control.pointer.lock()
              break
          }
        },
        
        // Handle key/button releases
        onRelease(code) {
          switch(code) {
            case 'KeyW':
              this.moveForward = false
              break
            case 'KeyS':
              this.moveBackward = false
              break
            case 'MouseRight':
              // Stop camera look
              control.pointer.unlock()
              break
          }
        },
        
        // Handle pointer movement
        onPointer() {
          if (control.pointer.locked) {
            // Update camera rotation
            control.camera.rotation.y -= control.pointer.delta.x * 0.002
            control.camera.rotation.x -= control.pointer.delta.y * 0.002
            
            // Clamp vertical rotation
            control.camera.rotation.x = Math.max(
              -Math.PI/2,
              Math.min(Math.PI/2, control.camera.rotation.x)
            )
            return true  // Consume event
          }
        },
        
        // Handle touch input
        onTouch(touch) {
          if (touch.position.x < control.screen.width / 2) {
            // Left side - movement stick
            this.moveStick = touch
          } else {
            // Right side - look stick
            this.lookStick = touch
          }
        },
        
        onTouchEnd(touch) {
          if (touch === this.moveStick) {
            this.moveStick = null
          }
          if (touch === this.lookStick) {
            this.lookStick = null
          }
        }
      })
      
      // Claim camera control
      control.camera.claim()
      
      // Store control reference
      this.control = control
    },
    
    update(dt) {
      // Handle movement from keyboard
      if (this.moveForward) {
        this.moveCharacter('forward', dt)
      }
      if (this.moveBackward) {
        this.moveCharacter('backward', dt)
      }
      
      // Handle movement from touch stick
      if (this.moveStick) {
        const delta = this.moveStick.delta
        if (delta.lengthSq() > 0) {
          this.moveCharacter(delta.normalize(), dt)
        }
      }
      
      // Handle camera from touch look stick
      if (this.lookStick) {
        const delta = this.lookStick.delta
        if (delta.lengthSq() > 0) {
          this.control.camera.rotation.y -= delta.x * 0.01
          this.control.camera.rotation.x -= delta.y * 0.01
          
          // Clamp vertical rotation
          this.control.camera.rotation.x = Math.max(
            -Math.PI/2,
            Math.min(Math.PI/2, this.control.camera.rotation.x)
          )
        }
      }
    },
    
    destroy() {
      // Release control binding
      this.control.release()
    }
  }
}
```

This example demonstrates:
- Creating a control binding with custom priority
- Handling keyboard and mouse input
- Implementing pointer lock for mouse look
- Supporting touch controls with virtual sticks
- Managing camera control
- Proper cleanup when destroyed

Remember that the ClientControls system uses a priority system, so higher priority controls can override lower priority ones. This is useful for implementing UI interactions that should temporarily disable player controls.
