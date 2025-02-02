# ClientNetwork

The ClientNetwork system in Hyperfy manages client-side network communication, handling WebSocket connections, packet processing, and state synchronization between the client and server.

### Properties

### `network.id`: String | null

The client's unique network identifier, assigned after connection.

### `network.isClient`: Boolean

Always true for ClientNetwork instances. Used to distinguish between client and server code.

### `network.apiUrl`: String

The base URL for API requests.

### Methods

### `network.send(name: String, data: any): void`

Sends a packet to the server.

Parameters:
- `name`: The packet type/method name
- `data`: The packet payload

### `network.upload(file: File): Promise<void>`

Uploads a file to the server.

Parameters:
- `file`: The file to upload

### `network.getTime(): Number`

Gets the current server-synchronized time in seconds.

Returns:
- Current time with server offset applied

### Network Events

The system handles various network events:

### `onSnapshot(data: Object)`

Handles initial state snapshot from server:
```typescript
{
  id: String,           // Client's network ID
  serverTime: Number,   // Server timestamp
  chat: Object,         // Chat state
  blueprints: Object,   // Blueprint state
  entities: Object,     // Entity state
  authToken: String     // Authentication token
}
```

### `onEntityAdded(data: Object)`

Handles new entity creation:
```typescript
{
  id: String,           // Entity ID
  type: String,         // Entity type
  // ... entity-specific data
}
```

### `onEntityModified(data: Object)`

Handles entity state updates:
```typescript
{
  id: String,           // Entity ID
  // ... changed properties
}
```

### `onEntityEvent(event: Array)`

Handles entity-specific events:
```typescript
[
  entityId: String,     // Target entity ID
  version: String,      // Entity version
  name: String,         // Event name
  data: any            // Event data
]
```

### Notes

- Uses WebSocket for real-time communication
- Automatically handles connection and reconnection
- Maintains server time synchronization
- Queues and processes packets in order
- Supports binary packet format for efficiency

### Usage

The ClientNetwork system is used to:

1. Maintain connection with the server
2. Synchronize game state
3. Handle entity updates and events
4. Upload files and assets
5. Manage authentication

### Example

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Send custom event to server
      world.network.send('customEvent', {
        type: 'action',
        data: { x: 10, y: 20 }
      })
      
      // Upload an asset
      const handleFileUpload = async (file) => {
        try {
          await world.network.upload(file)
          console.log('File uploaded successfully')
        } catch (error) {
          console.error('Upload failed:', error)
        }
      }
      
      // Create networked entity
      const createNetworkedObject = () => {
        const data = {
          type: 'customEntity',
          position: [0, 1, 0],
          properties: {
            health: 100,
            state: 'idle'
          }
        }
        
        // Entity will be created locally and synced to other clients
        world.entities.add(data, true)
      }
      
      // Listen for network events
      world.on('disconnect', (code) => {
        console.log('Disconnected from server:', code)
      })
    }
  }
}

// Example of entity with network events
export default function(world, app, fetch) {
  return {
    start() {
      const entity = app.create('Group')
      
      // Handle incoming network events
      entity.onEvent = (version, name, data, networkId) => {
        switch(name) {
          case 'damage':
            this.handleDamage(data.amount)
            break
            
          case 'stateChange':
            this.updateState(data.newState)
            break
            
          case 'interact':
            this.handleInteraction(data.playerId)
            break
        }
      }
      
      // Method to send events to server
      this.sendNetworkEvent = (name, data) => {
        world.network.send('entityEvent', [
          entity.id,
          entity.version,
          name,
          data
        ])
      }
      
      // Example of sending event
      this.interact = () => {
        this.sendNetworkEvent('interact', {
          timestamp: world.network.getTime(),
          position: entity.position.toArray()
        })
      }
      
      app.add(entity)
      this.entity = entity
    },
    
    handleDamage(amount) {
      // Handle damage event
      this.health -= amount
      
      if (this.health <= 0) {
        // Notify server of destruction
        this.sendNetworkEvent('destroyed', {
          finalHealth: 0,
          timestamp: world.network.getTime()
        })
      }
    },
    
    updateState(newState) {
      // Update visual state
      this.currentState = newState
      this.updateAnimation(newState)
    },
    
    handleInteraction(playerId) {
      // Handle player interaction
      const player = world.entities.get(playerId)
      if (player) {
        // Respond to interaction
        this.sendNetworkEvent('interactResponse', {
          playerId,
          success: true
        })
      }
    }
  }
}
```

This example demonstrates:
- Sending and receiving network events
- Handling entity synchronization
- Managing network state
- Uploading files
- Implementing networked interactions

Remember to handle network latency and state reconciliation appropriately in your networked entities and interactions.
