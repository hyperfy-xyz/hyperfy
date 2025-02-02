# Entity

The Entity class is the foundational building block for all interactive objects in the Hyperfy world. It provides the base functionality for network synchronization, state management, and lifecycle events that all entities in the system share.

### Properties

### `entity.world`: World

A reference to the World instance that this entity belongs to. Provides access to all world systems and functionality.

### `entity.data`: Object

The raw data object containing all serializable properties of the entity. This includes:
- `id`: Unique identifier for the entity
- `type`: The type of entity (e.g., 'app', 'player')
- `position`: [x, y, z] array for entity position
- `quaternion`: [x, y, z, w] array for entity rotation
- Custom properties specific to the entity type

### Methods

### `entity.modify(data: Object): void`

Updates the entity's data with new values. This method is called both when receiving remote entity changes and when applying local changes.

Parameters:
- `data`: Object containing the properties to update

### `entity.onEvent(version: String, name: String, data: any, networkId?: String): void`

Handles events sent to this entity. Events can be used to trigger actions or update state.

Parameters:
- `version`: The version of the entity when the event was created
- `name`: The name of the event
- `data`: Event-specific data payload
- `networkId`: (Optional) The ID of the network connection that sent the event

### `entity.serialize(): Object`

Serializes the entity's current state for network transmission or storage.

Returns:
- The entity's data object containing all serializable properties

### `entity.destroy(local?: Boolean): void`

Cleans up and removes the entity from the world.

Parameters:
- `local`: If true, notifies the network that this entity was destroyed locally

### Notes

- Entities are the base class for all objects in the Hyperfy world, including players, apps, and interactive elements.
- The entity system is designed to work seamlessly across the network, automatically synchronizing state between server and clients.
- When creating custom entities, extend this class to inherit the base networking and lifecycle functionality.
- The `data` object should contain all properties that need to be synchronized across the network.

### Usage

Entities are used to:

1. Create interactive objects in the world
2. Synchronize state across the network
3. Handle events and messages
4. Manage object lifecycle (creation, updates, destruction)

### Example

```javascript
// Creating a custom entity type
class CustomEntity extends Entity {
  constructor(world, data, local) {
    super(world, data, local)
    
    // Initialize custom properties
    this.customState = {
      health: 100,
      score: 0
    }
  }
  
  // Override modify to handle custom data updates
  modify(data) {
    super.modify(data)
    
    if (data.health !== undefined) {
      this.customState.health = data.health
      this.checkHealth()
    }
  }
  
  // Custom event handler
  onEvent(version, name, data, networkId) {
    if (name === 'damage') {
      const newHealth = this.customState.health - data.amount
      
      // Update health locally and sync across network
      this.modify({
        health: newHealth
      })
    }
  }
  
  // Custom method
  checkHealth() {
    if (this.customState.health <= 0) {
      this.destroy(true)  // Destroy locally and sync across network
    }
  }
  
  // Override serialize to include custom state
  serialize() {
    return {
      ...super.serialize(),
      health: this.customState.health,
      score: this.customState.score
    }
  }
}

// Using the custom entity
const entityData = {
  id: 'unique-id',
  type: 'custom',
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1]
}

const customEntity = new CustomEntity(world, entityData, true)

// Later, sending an event to the entity
world.network.send('entityEvent', [
  customEntity.id,
  customEntity.data.version,
  'damage',
  { amount: 10 }
])
```

This example demonstrates creating a custom entity type with its own state management, event handling, and network synchronization. The entity responds to damage events, tracks health state, and automatically synchronizes changes across the network.

Remember to handle network latency and state reconciliation appropriately when dealing with fast-paced interactions or critical state updates.
