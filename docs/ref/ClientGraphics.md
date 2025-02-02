# ClientGraphics

The ClientGraphics system in Hyperfy manages rendering, post-processing effects, and visual quality settings. It provides high-quality rendering with features like shadows, bloom, tone mapping, and anti-aliasing.

### Properties

### `graphics.renderer`: THREE.WebGLRenderer

The Three.js WebGL renderer instance with the following configuration:
- High-performance power preference
- Hardware anti-aliasing (when available)
- PCF soft shadows
- SRGB color space
- VR/XR support enabled

### `graphics.width`: Number

Current viewport width in pixels.

### `graphics.height`: Number

Current viewport height in pixels.

### `graphics.aspect`: Number

Current viewport aspect ratio (width/height).

### `graphics.usePostprocessing`: Boolean

Whether post-processing effects are enabled.

### Methods

### `graphics.resize(width: Number, height: Number): void`

Updates the renderer and viewport size.

Parameters:
- `width`: New viewport width in pixels
- `height`: New viewport height in pixels

### `graphics.render(): void`

Renders the current frame, using either standard rendering or post-processing based on settings and VR state.

### `graphics.scaleUI(object3d: Object3D, heightPx: Number, pxToMeters: Number): void`

Scales a UI object to maintain consistent size in pixels at any distance.

Parameters:
- `object3d`: The UI object to scale
- `heightPx`: Desired height in pixels
- `pxToMeters`: Pixels to meters conversion ratio

### Post-Processing Effects

The system includes several post-processing effects:

1. **SMAA (Subpixel Morphological Anti-Aliasing)**
   - Ultra-quality preset
   - Provides smooth edges without performance impact

2. **Tone Mapping**
   - ACES Filmic tone mapping
   - Provides cinematic color grading

3. **Selective Bloom**
   - Configurable intensity and threshold
   - Layer-based selection for bloom effects
   - Supports mipmap blur for better quality

### Settings

Graphics settings can be configured through the client settings system:

```typescript
{
  pixelRatio: Number,      // Display pixel ratio (default: device ratio)
  postprocessing: Boolean, // Enable post-processing effects
  bloom: Boolean          // Enable bloom effect
}
```

### Notes

- Automatically handles viewport resizing
- Supports VR/XR rendering
- Uses half-float render targets for HDR effects
- Provides high-quality shadows with PCF filtering
- Automatically scales UI elements for consistent size

### Usage

The ClientGraphics system is used to:

1. Render the 3D scene with high quality
2. Apply post-processing effects
3. Handle VR/XR rendering
4. Scale UI elements consistently
5. Manage graphics quality settings

### Example

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Create a glowing object
      const glowingMesh = app.create('Mesh')
      
      // Enable bloom for this object
      glowingMesh.layers.enable(14)  // NO_BLOOM layer for selective bloom
      
      // Create UI element with consistent size
      const uiElement = app.create('UI')
      uiElement.width = 200
      uiElement.height = 100
      
      // Scale UI to maintain 100px height at any distance
      world.graphics.scaleUI(uiElement, 100, 0.01)  // 0.01 meters per pixel
      
      // Add objects to scene
      app.add(glowingMesh)
      app.add(uiElement)
      
      // Store references
      this.uiElement = uiElement
    },
    
    // Example of handling resize events
    onResize() {
      // Update UI layout based on new viewport size
      const width = world.graphics.width
      const height = world.graphics.height
      
      if (width < 800) {
        // Mobile layout
        this.uiElement.position.set(0, height * 0.8, 0)
      } else {
        // Desktop layout
        this.uiElement.position.set(width * 0.8, 0, 0)
      }
    }
  }
}

// Example of configuring graphics settings
export default function(world, app, fetch) {
  return {
    start() {
      // Configure high quality settings
      world.client.settings.update({
        pixelRatio: window.devicePixelRatio,
        postprocessing: true,
        bloom: true
      })
      
      // Create scene with bloom effects
      const scene = app.create('Group')
      
      // Create glowing objects
      const createGlowingObject = (position, color) => {
        const mesh = app.create('Mesh')
        mesh.position.copy(position)
        
        // Set material properties for bloom
        const material = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 2
        })
        mesh.material = material
        
        // Enable bloom for this object
        mesh.layers.enable(14)  // NO_BLOOM layer
        
        return mesh
      }
      
      // Add some glowing objects
      scene.add(createGlowingObject(
        new THREE.Vector3(0, 1, 0),
        new THREE.Color(1, 0.5, 0)  // Orange glow
      ))
      
      scene.add(createGlowingObject(
        new THREE.Vector3(-2, 1, 0),
        new THREE.Color(0, 1, 0.5)  // Cyan glow
      ))
      
      scene.add(createGlowingObject(
        new THREE.Vector3(2, 1, 0),
        new THREE.Color(0.5, 0, 1)  // Purple glow
      ))
      
      // Add scene to app
      app.add(scene)
    }
  }
}
```

This example demonstrates:
- Configuring graphics settings
- Creating objects with bloom effects
- Handling UI scaling
- Responding to viewport resizing
- Setting up materials for visual effects

Remember that post-processing effects can impact performance, so use them judiciously and provide options for users to adjust graphics quality based on their hardware capabilities.
