# BuildMode System Documentation

## Overview
BuildMode is a specialized camera control system for Hyperfy that enables free-flying camera movement for building and world editing. When activated, it temporarily disables player controls and provides smooth, unrestricted camera movement throughout the world.

## Features

### Camera Controls
- **Activation**: Press `B` to toggle BuildMode
- **Movement**:
  - `W/A/S/D`: Move camera forward/left/backward/right
  - `Space`: Move camera up
  - `C`: Move camera down
  - `Mouse`: Look around (smooth camera rotation)
  - `Mouse Wheel`: Adjust movement speed

### Speed Control
- Default movement speed: 10 units/second
- Speed range: 1 to 50 units/second
- Scroll up: Decrease speed
- Scroll down: Increase speed
- Speed adjustment factor: 1.2x per scroll tick

### Player State Management
When BuildMode is activated:
- Player model is hidden
- Player animations are frozen
- Player physics are locked
- Player position is preserved
- Player controls are disabled

## Technical Implementation

### Core Components

#### Camera System
```javascript
// Camera initialization
this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

// Smooth rotation handling
this.targetRotation = new THREE.Euler(0, 0, 0, 'YXZ')
this.currentRotation = new THREE.Euler(0, 0, 0, 'YXZ')
```

#### Movement System
The movement system uses quaternion-based directional movement for smooth camera control:
```javascript
moveForward(distance) {
    const direction = new THREE.Vector3(0, 0, -1)
    direction.applyQuaternion(this.camera.quaternion)
    this.camera.position.addScaledVector(direction, distance)
}
```

### State Management

#### Activation Process
1. Store original camera and player states
2. Disable player controls and visibility
3. Enable free camera movement
4. Lock player physics
5. Enable pointer lock for smooth mouse control

```javascript
toggleBuildMode() {
    if (this.active) {
        // Store states
        this.originalCameraPosition.copy(this.world.camera.position)
        this.originalCameraQuaternion.copy(this.world.camera.quaternion)
        
        // Disable player
        player.control.camera.unclaim()
        player.control.priority = -1
        player.visible = false
        
        // Enable build mode camera
        this.control.camera.claim()
    }
    // ...
}
```

## Integration Guide

### Adding BuildMode to Your World

1. Register the BuildMode system with your world:
```javascript
import { BuildMode } from './systems/BuildMode'

// In your world creation:
world.addSystem(BuildMode)
```

2. Ensure proper control priorities are set:
```javascript
// In ControlPriorities.js
export const ControlPriorities = {
    EDITOR: 100,    // BuildMode priority
    PLAYER: 0       // Normal player priority
}
```

### Event Handling

BuildMode integrates with Hyperfy's event system:
- Listens for key press events (B key for toggle)
- Handles mouse movement for camera rotation
- Processes scroll events for speed adjustment

## Best Practices

1. **State Preservation**
   - Always store original states before modification
   - Restore all states when deactivating
   - Handle edge cases (e.g., disconnection while in BuildMode)

2. **Performance**
   - Use smooth interpolation for camera movement
   - Implement proper cleanup in the destroy method
   - Manage event listeners carefully

3. **User Experience**
   - Provide smooth camera movement
   - Implement intuitive controls
   - Maintain consistent behavior across different scenarios

## Common Issues and Solutions

1. **Player Visibility**
   ```javascript
   // Problem: Player still visible in BuildMode
   // Solution: Properly hide both avatar and base
   if (player.avatar) {
       player.avatar.visible = false
       player.avatar.mixer.stopAllAction()
   }
   if (player.base) {
       player.base.visible = false
   }
   ```

2. **Camera Rotation**
   ```javascript
   // Problem: Camera flipping at extreme angles
   // Solution: Clamp rotation values
   this.targetRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.targetRotation.x))
   ```

## Future Enhancements

Potential improvements to consider:
1. Grid system for precise placement
2. Snap-to-surface functionality
3. Object selection and manipulation
4. Multiple camera modes (orbit, first-person, etc.)
5. Customizable key bindings
6. Save/restore camera positions

## Contributing

When contributing to BuildMode:
1. Maintain the existing control scheme
2. Test edge cases thoroughly
3. Document any changes or additions
4. Ensure smooth state transitions
5. Consider performance implications

## Related Systems

- Player Control System
- Camera Control System
- Physics System
- Input Management System 