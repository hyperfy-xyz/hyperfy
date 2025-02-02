# ServerLoader

The ServerLoader system in Hyperfy provides server-side asset loading capabilities. It handles loading and caching of various file types including models, emotes, avatars, and scripts, with specific adaptations for the Node.js environment.

### Properties

### `loader.assetsDir`: String

Base directory for resolving asset:// URLs.

### `loader.promises`: Map<String, Promise>

Map of loading promises by asset key.

### `loader.results`: Map<String, any>

Map of loaded assets by asset key.

### Methods

### `loader.load(type: String, url: String): Promise<any>`

Loads an asset of the specified type.

Parameters:
- `type`: Asset type ('model', 'emote', 'avatar', 'script')
- `url`: Asset URL

Returns:
- Promise resolving to the loaded asset

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

### Supported Asset Types

### Models ('model')
```typescript
{
  toNodes(): Node        // Creates node hierarchy from GLB
}
```

### Emotes ('emote')
```typescript
{
  toClip(options?: Object): AnimationClip  // Creates animation clip
}
```

### Avatars ('avatar')
```typescript
{
  toNodes(): Node        // Creates placeholder avatar node
}
```

### Scripts ('script')
```typescript
{
  evaluate(): Function   // Evaluates script code
}
```

### Notes

- Runs in Node.js environment
- Provides file system based loading
- Caches loaded assets
- Handles asset:// URL resolution
- Supports GLB/GLTF parsing
- Limited VRM support on server

### Usage

The ServerLoader system is used to:

1. Load server-side assets
2. Parse 3D models
3. Load animation data
4. Evaluate scripts
5. Cache loaded resources

### Example

```javascript
export default function(world, app, fetch) {
  return {
    async start() {
      // Load server-side assets
      await this.loadServerAssets()
      
      // Set up asset handlers
      this.setupAssetHandlers()
    },
    
    async loadServerAssets() {
      try {
        // Load model
        const model = await world.loader.load(
          'model',
          'asset://models/server-object.glb'
        )
        
        // Create nodes from model
        const nodes = model.toNodes()
        
        // Add to scene
        app.add(nodes)
        
        // Load emote animation
        const emote = await world.loader.load(
          'emote',
          'asset://animations/server-emote.glb'
        )
        
        // Create animation clip
        const clip = emote.toClip({
          loop: true,
          duration: 2
        })
        
        // Store references
        this.serverAssets = {
          model,
          emote
        }
      } catch (error) {
        console.error('Failed to load server assets:', error)
      }
    },
    
    setupAssetHandlers() {
      // Handle asset requests
      world.on('requestAsset', async (data) => {
        const { type, url, clientId } = data
        
        try {
          // Check cache first
          if (world.loader.has(type, url)) {
            const asset = world.loader.get(type, url)
            this.sendAssetToClient(clientId, asset)
            return
          }
          
          // Load new asset
          const asset = await world.loader.load(type, url)
          this.sendAssetToClient(clientId, asset)
        } catch (error) {
          console.error(`Failed to load asset ${url}:`, error)
          this.sendAssetError(clientId, error)
        }
      })
    },
    
    // Example of processing loaded models
    async processServerModel(url) {
      const model = await world.loader.load('model', url)
      
      // Create nodes
      const nodes = model.toNodes()
      
      // Process nodes
      nodes.traverse(node => {
        if (node.isMesh) {
          // Modify materials
          node.material = this.createServerMaterial()
          
          // Add physics
          const collider = app.create('Collider')
          collider.fromMesh(node)
          node.add(collider)
        }
      })
      
      return nodes
    },
    
    // Example of handling script loading
    async loadServerScript(url) {
      try {
        const script = await world.loader.load('script', url)
        
        // Create execution context
        const context = {
          world,
          app,
          // Add server-specific APIs
          server: this.createServerAPI()
        }
        
        // Execute script
        const result = script.evaluate()(context)
        
        return result
      } catch (error) {
        console.error(`Failed to load script ${url}:`, error)
        throw error
      }
    },
    
    // Example of asset URL resolution
    resolveAssetPath(assetUrl) {
      if (!assetUrl.startsWith('asset://')) {
        throw new Error('Invalid asset URL')
      }
      
      // Get physical path
      const physicalPath = world.loader.resolveURL(assetUrl)
      
      // Verify path is within assets directory
      if (!physicalPath.startsWith(world.loader.assetsDir)) {
        throw new Error('Invalid asset path')
      }
      
      return physicalPath
    },
    
    destroy() {
      // Clean up event listeners
      world.off('requestAsset')
      
      // Clean up assets
      if (this.serverAssets) {
        // Cleanup is handled by loader cache
        this.serverAssets = null
      }
    }
  }
}
```

This example demonstrates:
- Loading server-side models
- Processing loaded assets
- Handling asset requests
- Managing asset cache
- Script evaluation
- Path resolution

Remember that the ServerLoader operates in Node.js and has some limitations compared to the client-side loader, particularly for VRM files and certain visual assets.
