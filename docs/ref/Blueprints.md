# Blueprints

The Blueprints system in Hyperfy manages app blueprints, providing a central registry for app configurations and assets. It runs on both client and server, handling blueprint creation, modification, and asset preloading.

### Properties

### `blueprints.items`: Map<String, Blueprint>

Map of all blueprints by their ID.

### Methods

### `blueprints.get(id: String): Blueprint | null`

Gets a blueprint by ID.

Parameters:
- `id`: Blueprint ID

Returns:
- The blueprint if found, null otherwise

### `blueprints.add(data: Blueprint, local?: Boolean): void`

Adds a new blueprint to the registry.

Parameters:
```typescript
interface Blueprint {
  id: String,              // Unique blueprint ID
  model?: String,          // Optional 3D model URL (.glb/.vrm)
  script?: String,         // Optional script URL
  config?: {               // Optional configuration
    [key: string]: {
      type: String,        // Asset type
      url: String         // Asset URL
    }
  },
  preload?: Boolean,      // Whether to preload assets
  // ... other blueprint properties
}
```
- `local`: Whether this is a local blueprint addition

### `blueprints.modify(data: Partial<Blueprint>): void`

Updates an existing blueprint.

Parameters:
- `data`: Partial blueprint data with at least an ID

### `blueprints.serialize(): Array<Blueprint>`

Serializes all blueprints for network transmission.

Returns:
- Array of blueprint data

### `blueprints.deserialize(data: Array<Blueprint>): void`

Recreates blueprint registry from serialized data and initiates asset preloading.

Parameters:
- `data`: Array of blueprint data

### Notes

- Automatically handles asset preloading
- Supports VRM avatars and GLB models
- Manages script loading
- Broadcasts blueprint changes
- Rebuilds entities when blueprints change

### Usage

The Blueprints system is used to:

1. Register app configurations
2. Manage asset preloading
3. Handle blueprint modifications
4. Coordinate entity rebuilding
5. Synchronize blueprints across clients

### Example

```javascript
export default function(world, app, fetch) {
  return {
    async start() {
      // Create a blueprint for a custom entity
      const blueprint = {
        id: 'custom-entity',
        model: 'asset://models/custom.glb',
        script: 'asset://scripts/custom.js',
        config: {
          texture: {
            type: 'texture',
            url: 'asset://textures/custom.jpg'
          },
          sound: {
            type: 'audio',
            url: 'asset://sounds/custom.mp3'
          }
        },
        preload: true,  // Preload all assets
        properties: {
          speed: 1.0,
          scale: 2.0
        }
      }
      
      // Add blueprint locally and broadcast
      world.blueprints.add(blueprint, true)
      
      // Create entity from blueprint
      this.createEntityFromBlueprint('custom-entity')
      
      // Listen for blueprint modifications
      world.on('blueprintModified', this.handleBlueprintChange)
    },
    
    createEntityFromBlueprint(blueprintId) {
      const blueprint = world.blueprints.get(blueprintId)
      if (!blueprint) {
        console.error('Blueprint not found:', blueprintId)
        return
      }
      
      // Create entity with blueprint
      const entity = app.create('Group')
      entity.blueprint = blueprint
      
      // Apply blueprint properties
      if (blueprint.properties) {
        Object.assign(entity, blueprint.properties)
      }
      
      // Add to scene
      app.add(entity)
      
      return entity
    },
    
    handleBlueprintChange(blueprint) {
      console.log('Blueprint modified:', blueprint.id)
      
      // Update existing entities using this blueprint
      this.updateEntitiesWithBlueprint(blueprint)
    },
    
    updateEntitiesWithBlueprint(blueprint) {
      // Find entities using this blueprint
      const entities = Array.from(app.children).filter(
        entity => entity.blueprint?.id === blueprint.id
      )
      
      // Update each entity
      entities.forEach(entity => {
        // Reset entity state
        entity.state = {}
        
        // Apply new blueprint properties
        if (blueprint.properties) {
          Object.assign(entity, blueprint.properties)
        }
        
        // Rebuild entity
        entity.build()
      })
    },
    
    // Example of modifying a blueprint
    updateBlueprintProperties(blueprintId, properties) {
      const blueprint = world.blueprints.get(blueprintId)
      if (!blueprint) return
      
      // Create modification data
      const modification = {
        id: blueprintId,
        properties: {
          ...blueprint.properties,
          ...properties
        }
      }
      
      // Apply modification
      world.blueprints.modify(modification)
    },
    
    // Example of handling asset preloading
    async preloadBlueprintAssets(blueprintId) {
      const blueprint = world.blueprints.get(blueprintId)
      if (!blueprint) return
      
      const preloads = []
      
      // Add model if present
      if (blueprint.model) {
        const type = blueprint.model.endsWith('.vrm') ? 'avatar' : 'model'
        preloads.push({ type, url: blueprint.model })
      }
      
      // Add script if present
      if (blueprint.script) {
        preloads.push({ type: 'script', url: blueprint.script })
      }
      
      // Add config assets
      if (blueprint.config) {
        Object.values(blueprint.config)
          .filter(value => value?.url && value?.type)
          .forEach(value => {
            preloads.push({ type: value.type, url: value.url })
          })
      }
      
      // Preload all assets
      await world.loader.preload(preloads)
      console.log('Blueprint assets preloaded:', blueprintId)
    },
    
    destroy() {
      // Clean up event listeners
      world.off('blueprintModified', this.handleBlueprintChange)
    }
  }
}
```

This example demonstrates:
- Creating blueprints with assets
- Managing blueprint modifications
- Creating entities from blueprints
- Handling blueprint changes
- Asset preloading
- Entity rebuilding

Remember that blueprints are a powerful way to define reusable entity configurations and manage asset preloading efficiently.
