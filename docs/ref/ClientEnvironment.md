# ClientEnvironment

The ClientEnvironment system in Hyperfy manages environmental effects including skybox, HDR lighting, sun direction, and cascaded shadow maps (CSM). It runs on the client and provides high-quality environment rendering.

### Properties

### `environment.sky`: THREE.Mesh

The skybox mesh with equirectangular texture mapping.

### `environment.csm`: CSM

Cascaded Shadow Maps system for high-quality shadows.

### Methods

### `environment.addSky(node: SkyNode): Handle`

Adds a sky configuration to the environment stack.

Parameters:
```typescript
interface SkyNode {
  bg?: String,                    // Background texture URL
  hdr?: String,                   // HDR environment map URL
  sunDirection?: Vector3,         // Sun direction vector
  sunIntensity?: Number          // Sun light intensity
}
```

Returns:
```typescript
{
  node: SkyNode,                 // Sky configuration
  destroy(): void               // Remove sky from stack
}
```

### Shadow Quality Levels

The system supports different shadow quality presets:

### None
```typescript
{
  cascades: 1,
  shadowMapSize: 1024,
  castShadow: false,
  lightIntensity: 3
}
```

### Low
```typescript
{
  cascades: 1,
  shadowMapSize: 2048,
  castShadow: true,
  lightIntensity: 1,
  shadowBias: 0.0000009,
  shadowNormalBias: 0.001
}
```

### Medium
```typescript
{
  cascades: 3,
  shadowMapSize: 1024,
  castShadow: true,
  lightIntensity: 1,
  shadowBias: 0.000002,
  shadowNormalBias: 0.002
}
```

### High
```typescript
{
  cascades: 3,
  shadowMapSize: 2048,
  castShadow: true,
  lightIntensity: 1,
  shadowBias: 0.000003,
  shadowNormalBias: 0.002
}
```

### Notes

- Supports stacked sky configurations
- Uses Cascaded Shadow Maps for efficient shadows
- Handles HDR environment mapping
- Automatically updates with viewport changes
- Responds to graphics quality settings
- Follows camera position for infinite skybox

### Usage

The ClientEnvironment system is used to:

1. Configure scene lighting
2. Manage shadow quality
3. Set up environment maps
4. Control sun direction
5. Handle skybox rendering

### Example

```javascript
export default function(world, app, fetch) {
  return {
    async start() {
      // Create custom environment
      const environment = {
        // Custom sky configuration
        bg: 'asset://textures/sky.jpg',
        hdr: 'asset://env/scene.hdr',
        sunDirection: new THREE.Vector3(-1, -2, -2).normalize(),
        sunIntensity: 1.5
      }
      
      // Add to environment stack
      const handle = world.environment.addSky(environment)
      
      // Store reference
      this.skyHandle = handle
      
      // Create environment objects
      await this.createEnvironmentObjects()
      
      // Listen for time changes
      world.on('timeUpdate', this.updateEnvironment)
    },
    
    async createEnvironmentObjects() {
      // Load environment model
      const envModel = await world.loader.load(
        'model',
        'asset://models/environment.glb'
      )
      
      // Create environment nodes
      const envNodes = envModel.toNodes()
      
      // Enable shadows
      envNodes.traverse(node => {
        if (node.isMesh) {
          node.castShadow = true
          node.receiveShadow = true
        }
      })
      
      // Add to scene
      app.add(envNodes)
    },
    
    updateEnvironment(time) {
      // Calculate sun position based on time
      const angle = (time.hour / 24) * Math.PI * 2
      const sunDirection = new THREE.Vector3(
        Math.cos(angle),
        Math.sin(angle) * 0.5 - 0.5,
        Math.sin(angle)
      ).normalize()
      
      // Update environment
      const environment = {
        ...this.skyHandle.node,
        sunDirection
      }
      
      // Create new sky configuration
      const handle = world.environment.addSky(environment)
      
      // Clean up old configuration
      this.skyHandle.destroy()
      
      // Store new reference
      this.skyHandle = handle
    },
    
    // Example of creating dynamic weather effects
    createWeatherEffects() {
      // Create particle system for rain
      const rain = app.create('Mesh')
      rain.geometry = new THREE.BufferGeometry()
      rain.material = new THREE.PointsMaterial({
        size: 0.1,
        transparent: true,
        opacity: 0.6
      })
      
      // Create rain particles
      const particles = []
      for(let i = 0; i < 1000; i++) {
        particles.push(
          Math.random() * 100 - 50,  // x
          Math.random() * 50,        // y
          Math.random() * 100 - 50   // z
        )
      }
      
      rain.geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(particles, 3)
      )
      
      // Add to scene
      app.add(rain)
      
      // Animate rain
      this.rainAnimation = {
        update: (dt) => {
          const positions = rain.geometry.attributes.position.array
          
          for(let i = 0; i < positions.length; i += 3) {
            positions[i + 1] -= dt * 10  // Fall speed
            
            if(positions[i + 1] < 0) {
              positions[i + 1] = 50  // Reset to top
            }
          }
          
          rain.geometry.attributes.position.needsUpdate = true
        }
      }
    },
    
    update(dt) {
      // Update weather effects
      if (this.rainAnimation) {
        this.rainAnimation.update(dt)
      }
    },
    
    destroy() {
      // Clean up environment
      if (this.skyHandle) {
        this.skyHandle.destroy()
      }
      
      // Remove event listeners
      world.off('timeUpdate', this.updateEnvironment)
    }
  }
}
```

This example demonstrates:
- Creating custom environments
- Managing sky configurations
- Handling time-based lighting
- Creating weather effects
- Managing shadow settings
- Working with HDR lighting

Remember that environment changes can significantly impact performance, so use appropriate quality settings based on the target platform.
