# ClientLoader

The ClientLoader system in Hyperfy manages asset loading and caching for various file types including models, textures, HDR maps, avatars, emotes, and scripts.

### Properties

### `loader.promises`: Map<String, Promise>

Map of loading promises by asset key.

### `loader.results`: Map<String, any>

Map of loaded assets by asset key.

### Methods

### `loader.load(type: String, url: String): Promise<any>`

Loads an asset of the specified type.

Parameters:
- `type`: Asset type ('model', 'texture', 'hdr', 'avatar', 'emote', 'script')
- `url`: Asset URL

Returns:
- Promise resolving to the loaded asset

### `loader.preload(items: Array<PreloadItem>): void`

Preloads multiple assets and emits 'ready' event when complete.

Parameters:
```typescript
interface PreloadItem {
  type: String,           // Asset type
  url: String            // Asset URL
}
```

### `loader.has(type: String, url: String): Boolean`

Checks if an asset is loaded or loading.

Parameters:
- `type`: Asset type
- `url`: Asset URL

Returns:
- Whether the asset exists

### `loader.get(type: String, url: String): any`

Gets a loaded asset.

Parameters:
- `type`: Asset type
- `url`: Asset URL

Returns:
- The loaded asset if available

### `loader.insert(type: String, url: String, file: File): void`

Inserts a local file as an asset.

Parameters:
- `type`: Asset type
- `url`: Asset URL for reference
- `file`: File object to load

### Supported Asset Types

### Models ('model')
- Loads GLB/GLTF files
- Returns:
```typescript
{
  toNodes(): Node        // Creates node hierarchy from model
}
```

### Textures ('texture')
- Loads image files
- Returns: `THREE.Texture`

### HDR Maps ('hdr')
- Loads HDR environment maps
- Returns: `THREE.Texture`

### Avatars ('avatar')
- Loads VRM files
- Returns:
```typescript
{
  toNodes(hooks?: Object): Node  // Creates avatar with optional hooks
}
```

### Emotes ('emote')
- Loads animation files
- Returns:
```typescript
{
  toClip(options?: Object): AnimationClip  // Creates animation clip
}
```

### Scripts ('script')
- Loads JavaScript files
- Returns: Evaluated script object

### Notes

- Automatically caches loaded assets
- Supports asset preloading
- Handles local file insertion
- Resolves asset:// URLs
- Emits 'ready' event after preloading
- Supports VRM avatars and animations

### Usage

The ClientLoader system is used to:

1. Load various asset types
2. Preload required assets
3. Cache loaded resources
4. Create nodes from models
5. Handle local file uploads

### Example

```javascript
export default function(world, app, fetch) {
  return {
    async start() {
      // Preload multiple assets
      const preloads = [
        {
          type: 'model',
          url: 'asset://models/environment.glb'
        },
        {
          type: 'texture',
          url: 'asset://textures/ground.jpg'
        },
        {
          type: 'hdr',
          url: 'asset://env/sky.hdr'
        }
      ]
      
      // Wait for preload
      world.loader.preload(preloads)
      
      // Listen for ready event
      world.once('ready', () => {
        this.createScene()
      })
    },
    
    async createScene() {
      // Load environment model
      const envModel = await world.loader.load(
        'model',
        'asset://models/environment.glb'
      )
      
      // Create nodes from model
      const envNodes = envModel.toNodes()
      app.add(envNodes)
      
      // Load and apply texture
      const groundTexture = await world.loader.load(
        'texture',
        'asset://textures/ground.jpg'
      )
      
      const ground = app.create('Mesh')
      ground.material.map = groundTexture
      app.add(ground)
      
      // Load avatar
      const avatarModel = await world.loader.load(
        'avatar',
        'asset://avatars/character.vrm'
      )
      
      // Create avatar with custom hooks
      const avatar = avatarModel.toNodes({
        onLoad: () => {
          console.log('Avatar loaded')
        },
        onAnimationStart: (name) => {
          console.log('Playing animation:', name)
        }
      })
      
      app.add(avatar)
      
      // Load emote animation
      const emote = await world.loader.load(
        'emote',
        'asset://animations/wave.glb'
      )
      
      // Create animation clip
      const waveClip = emote.toClip({
        loop: true,
        duration: 2
      })
      
      // Apply to avatar
      avatar.setEmote(waveClip)
    },
    
    // Example of handling file uploads
    async handleFileUpload(file) {
      // Insert file as asset
      world.loader.insert('model', 'custom://model.glb', file)
      
      // Wait for load
      const model = await world.loader.load('model', 'custom://model.glb')
      
      // Create nodes
      const nodes = model.toNodes()
      app.add(nodes)
    }
  }
}
```

This example demonstrates:
- Asset preloading
- Loading different asset types
- Creating nodes from models
- Handling avatars and animations
- Managing textures
- Working with local files

Remember that assets are cached automatically, so subsequent loads of the same asset will return the cached version.
