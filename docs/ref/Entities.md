# Entities

The Entities system in Hyperfy manages entity creation, lifecycle, and updates. It runs on both client and server, handling different entity types including apps and players.

### Properties

### `entities.items`: Map<String, Entity>

Map of all entities by their ID.

### `entities.players`: Map<String, Player>

Map of player entities by their ID.

### `entities.player`: PlayerLocal | null

Reference to the local player entity, if any.

### `entities.hot`: Set<Entity>

Set of entities that need frequent updates.

### Methods

### `entities.get(id: String): Entity | null`

Gets an entity by ID.

Parameters:
- `id`: Entity ID

Returns:
- The entity if found, null otherwise

### `entities.getPlayer(entityId: String): Player | null`

Gets a player entity by ID.

Parameters:
- `entityId`: Player entity ID

Returns:
- The player entity if found, null otherwise

### `entities.add(data: Object, local?: Boolean): Entity`

Creates and adds a new entity to the world.

Parameters:
```typescript
{
  id: String,              // Unique entity ID
  type: String,           // Entity type ('app', 'player')
  owner?: String,         // Network ID of entity owner
  // ... entity-specific data
}
```
- `local`: Whether this is a local entity creation

Returns:
- The created entity

### `entities.remove(id: String): void`

Removes an entity from the world.

Parameters:
- `id`: Entity ID to remove

### `entities.setHot(entity: Entity, hot: Boolean): void`

Sets whether an entity should receive frequent updates.

Parameters:
- `entity`: Entity to update
- `hot`: Whether to enable frequent updates

### `entities.serialize(): Array<Object>`

Serializes all entities for network transmission.

Returns:
- Array of serialized entity data

### `entities.deserialize(data: Array<Object>): void`

Recreates entities from serialized data.

Parameters:
- `data`: Array of serialized entity data

### Notes

- Handles both local and networked entities
- Manages player entities separately
- Provides optimized updates through "hot" entities
- Supports entity serialization for networking
- Runs on both client and server

### Usage

The Entities system is used to:

1. Create and manage entities
2. Handle player entities
3. Optimize entity updates
4. Serialize entity state
5. Coordinate entity lifecycle

### Example

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Create a new entity
      const entityData = {
        id: 'unique-id',
        type: 'app',
        position: [0, 1, 0],
        script: `
          return {
            start() {
              console.log('Entity started')
            },
            update(dt) {
              // Frequent updates needed
              this.updatePosition(dt)
            }
          }
        `
      }
      
      const entity = world.entities.add(entityData, true)
      
      // Enable frequent updates
      world.entities.setHot(entity, true)
      
      // Store reference
      this.entity = entity
      
      // Listen for player events
      world.on('playerJoined', this.handlePlayerJoin)
    },
    
    handlePlayerJoin(playerEntity) {
      console.log('Player joined:', playerEntity.id)
      
      // Get player reference
      const player = world.entities.getPlayer(playerEntity.id)
      
      if (player) {
        // Handle player interaction
        this.setupPlayerInteraction(player)
      }
    },
    
    setupPlayerInteraction(player) {
      // Create interactive zone
      const zone = app.create('Action')
      zone.onTrigger = () => {
        // Interact with player
        this.interactWithPlayer(player)
      }
      app.add(zone)
    },
    
    interactWithPlayer(player) {
      // Check if this is the local player
      const isLocal = player === world.entities.player
      
      if (isLocal) {
        console.log('Local player interaction')
      } else {
        console.log('Remote player interaction')
      }
    },
    
    // Example of entity serialization
    saveGameState() {
      // Get serialized entity data
      const entityData = world.entities.serialize()
      
      // Save to storage
      localStorage.setItem('gameState', JSON.stringify(entityData))
    },
    
    // Example of entity deserialization
    loadGameState() {
      const savedData = localStorage.getItem('gameState')
      if (savedData) {
        const entityData = JSON.parse(savedData)
        
        // Recreate entities
        world.entities.deserialize(entityData)
      }
    },
    
    destroy() {
      // Clean up
      world.off('playerJoined', this.handlePlayerJoin)
      
      if (this.entity) {
        world.entities.remove(this.entity.id)
      }
    }
  }
}

// Example of a "hot" entity with frequent updates
export default function(world, app, fetch) {
  return {
    start() {
      // Create entity that needs frequent updates
      const movingEntity = app.create('Group')
      
      // Add visual representation
      const mesh = app.create('Mesh')
      movingEntity.add(mesh)
      
      // Enable frequent updates
      world.entities.setHot(movingEntity, true)
      
      // Store state
      this.state = {
        time: 0,
        speed: 1
      }
      
      app.add(movingEntity)
      this.entity = movingEntity
    },
    
    update(dt) {
      // This will be called frequently due to "hot" status
      this.state.time += dt
      
      // Update position
      const position = this.entity.position
      position.x = Math.sin(this.state.time * this.state.speed) * 5
      position.y = Math.cos(this.state.time * this.state.speed) * 2
      
      // Update transform
      this.entity.updateMatrix()
    },
    
    destroy() {
      // Disable frequent updates before removal
      world.entities.setHot(this.entity, false)
    }
  }
}
```

This example demonstrates:
- Creating and managing entities
- Handling player entities
- Using hot updates
- Serializing entity state
- Managing entity lifecycle
- Coordinating player interactions

Remember that "hot" entities receive frequent updates, so use this feature judiciously to maintain good performance.
