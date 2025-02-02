# Stage

The Stage system in Hyperfy manages the scene graph, mesh instancing, material management, and spatial partitioning. It provides efficient rendering through automatic batching and octree-based culling.

### Properties

### `stage.scene`: THREE.Scene

The Three.js scene containing all visual objects.

### `stage.octree`: LooseOctree

Spatial partitioning system for efficient object culling and raycasting.

### Methods

### `stage.insert(options: Object): Handle`

Inserts a mesh into the scene with optional instancing.

Parameters:
```typescript
{
  geometry: THREE.BufferGeometry,    // Mesh geometry
  material: THREE.Material,          // Mesh material
  castShadow: Boolean,              // Whether mesh casts shadows
  receiveShadow: Boolean,           // Whether mesh receives shadows
  node: Node,                       // Associated Hyperfy node
  matrix: Matrix4,                  // Transform matrix
  linked?: Boolean                  // Whether to use instancing
}
```

Returns a handle with:
```typescript
{
  material: MaterialProxy,          // Material control proxy
  move(matrix: Matrix4): void,     // Update transform
  destroy(): void                  // Remove from scene
}
```

### `stage.createMaterial(options: Object): MaterialHandle`

Creates a material with automatic texture management.

Parameters:
```typescript
{
  raw?: THREE.Material,            // Base material to clone
  unlit?: Boolean,                 // Use basic material
  color?: String | Number,         // Material color
  metalness?: Number,              // Metalness value (0-1)
  roughness?: Number              // Roughness value (0-1)
}
```

Returns:
```typescript
{
  raw: THREE.Material,            // Raw Three.js material
  proxy: {                        // Material control proxy
    id: String,                   // Unique ID
    textureX: Number,            // Texture X offset
    textureY: Number             // Texture Y offset
  }
}
```

### `stage.raycastPointer(position: Vector2, layers?: Layers, min?: Number, max?: Number): Array<RaycastHit>`

Performs raycasting from screen coordinates.

Parameters:
- `position`: Screen position in pixels
- `layers`: Layer mask for filtering (optional)
- `min`: Minimum distance (optional)
- `max`: Maximum distance (optional)

Returns array of hits with:
```typescript
{
  point: Vector3,                 // Hit position
  distance: Number,              // Distance to hit
  node: Node                     // Hit node
}
```

### Notes

- Automatically handles mesh instancing for identical geometries
- Uses octree for spatial partitioning and culling
- Manages material cloning and texture updates
- Supports shadow casting and receiving
- Provides efficient raycasting against scene objects

### Usage

The Stage system is used to:

1. Manage visual objects in the scene
2. Handle efficient mesh instancing
3. Control materials and textures
4. Perform raycasting and picking
5. Optimize rendering performance

### Example

```javascript
export default function(world, app, fetch) {
  return {
    async start() {
      // Create instanced objects
      const createInstancedMesh = (position) => {
        const geometry = new THREE.BoxGeometry()
        const material = new THREE.MeshStandardMaterial({
          color: 'blue',
          metalness: 0.5,
          roughness: 0.5
        })
        
        // Create mesh with instancing
        const mesh = app.create('Mesh', {
          geometry,
          material,
          linked: true,  // Enable instancing
          castShadow: true,
          receiveShadow: true
        })
        
        mesh.position.copy(position)
        return mesh
      }
      
      // Create multiple instances
      for(let i = 0; i < 100; i++) {
        const position = new THREE.Vector3(
          Math.random() * 10 - 5,
          Math.random() * 10,
          Math.random() * 10 - 5
        )
        
        const instance = createInstancedMesh(position)
        app.add(instance)
      }
      
      // Create object with custom material
      const customMaterial = world.stage.createMaterial({
        metalness: 0.8,
        roughness: 0.2,
        color: '#ff0000'
      })
      
      const object = app.create('Mesh')
      object.material = customMaterial.proxy
      
      // Animate texture offset
      this.textureAnimation = {
        offset: 0,
        speed: 0.01
      }
      
      // Add raycast handling
      this.setupRaycasting()
      
      app.add(object)
    },
    
    update(dt) {
      // Animate texture
      this.textureAnimation.offset += this.textureAnimation.speed * dt
      
      const material = this.object.material
      material.textureX = this.textureAnimation.offset
    },
    
    setupRaycasting() {
      // Handle pointer events
      world.on('pointerMove', (event) => {
        // Perform raycast from pointer position
        const hits = world.stage.raycastPointer(
          event.position,
          this.interactiveLayer,
          0,  // min distance
          100 // max distance
        )
        
        if (hits.length > 0) {
          const hit = hits[0]
          console.log('Hit object:', hit.node)
          console.log('Hit point:', hit.point)
          console.log('Hit distance:', hit.distance)
          
          // Handle interaction
          this.handleObjectHover(hit.node)
        }
      })
    },
    
    handleObjectHover(node) {
      // Change material on hover
      const hoverMaterial = world.stage.createMaterial({
        color: 'yellow',
        emissive: 'orange',
        emissiveIntensity: 0.5
      })
      
      node.material = hoverMaterial.proxy
      
      // Restore original material on mouse leave
      const restoreMaterial = () => {
        node.material = this.defaultMaterial.proxy
        world.off('pointerLeave', restoreMaterial)
      }
      
      world.on('pointerLeave', restoreMaterial)
    }
  }
}
```

This example demonstrates:
- Creating instanced meshes
- Managing custom materials
- Animating texture offsets
- Performing raycasting
- Handling object interactions
- Material swapping

Remember that the Stage system automatically optimizes rendering through instancing and spatial partitioning, so you can focus on creating your scene without worrying about low-level optimizations.
