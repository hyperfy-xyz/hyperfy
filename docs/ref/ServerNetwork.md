# ServerNetwork

The ServerNetwork system in Hyperfy manages server-side network communication, handling client connections, state synchronization, and persistence. It provides the server counterpart to the ClientNetwork system.

### Properties

### `network.sockets`: Map<String, Socket>

Map of connected client sockets.

### `network.isServer`: Boolean

Always true for ServerNetwork instances.

### Configuration

```typescript
{
  SAVE_INTERVAL: Number,     // Save interval in seconds (default: 60)
  PING_RATE: Number,        // Socket ping rate in seconds (default: 1)
  ADMIN_CODE: String        // Optional admin access code
}
```

### Methods

### `network.send(name: String, data: any, ignoreSocketId?: String): void`

Broadcasts a packet to all connected clients except the ignored socket.

Parameters:
- `name`: Packet type
- `data`: Packet payload
- `ignoreSocketId`: Optional socket ID to exclude

### `network.sendTo(socketId: String, name: String, data: any): void`

Sends a packet to a specific client.

Parameters:
- `socketId`: Target socket ID
- `name`: Packet type
- `data`: Packet payload

### `network.getTime(): Number`

Gets the current server time in seconds.

### Network Events

The system handles various network events:

### Connection Events

### `onConnection(ws: WebSocket, authToken?: String)`

Handles new client connections:
- Authenticates user
- Creates player entity
- Sends initial state snapshot
- Manages admin roles

### Entity Events

### `onEntityAdded(socket: Socket, data: Object)`
### `onEntityModified(socket: Socket, data: Object)`
### `onEntityRemoved(socket: Socket, id: String)`
### `onEntityEvent(socket: Socket, event: Array)`

Handle entity lifecycle and events.

### Blueprint Events

### `onBlueprintAdded(socket: Socket, blueprint: Object)`
### `onBlueprintModified(socket: Socket, data: Object)`

Handle blueprint creation and updates.

### Chat Events

### `onChatAdded(socket: Socket, message: Object)`

Handles chat messages and commands:
- Regular chat messages
- Admin commands (/admin)
- Name changes (/name)
- Spawn point management (/spawn)

### Notes

- Automatically saves state at configured intervals
- Maintains socket connections with ping/pong
- Handles user authentication and roles
- Manages entity persistence
- Supports admin commands
- Tracks dirty entities for saving

### Usage

The ServerNetwork system is used to:

1. Handle client connections
2. Synchronize game state
3. Process network events
4. Manage persistence
5. Handle admin commands

### Example

```javascript
// Example of extending server functionality
export default function(world, app, fetch) {
  return {
    start() {
      // Add custom packet handler
      world.network.onCustomEvent = (socket, data) => {
        this.handleCustomEvent(socket, data)
      }
      
      // Add custom command
      world.network.onChatAdded = async (socket, msg) => {
        if (msg.body.startsWith('/')) {
          const [cmd, ...args] = msg.body.slice(1).split(' ')
          
          if (cmd === 'custom') {
            await this.handleCustomCommand(socket, args)
            return
          }
        }
        
        // Handle regular chat
        world.chat.add(msg, false)
        world.network.send('chatAdded', msg, socket.id)
      }
    },
    
    async handleCustomCommand(socket, args) {
      // Check permissions
      const player = socket.player
      const user = player.data.user
      
      if (!hasRole(user.roles, 'admin')) {
        socket.send('chatAdded', {
          id: uuid(),
          from: null,
          fromId: null,
          body: 'Permission denied',
          createdAt: moment().toISOString()
        })
        return
      }
      
      // Process command
      try {
        await this.executeCustomCommand(args)
        
        // Send success message
        socket.send('chatAdded', {
          id: uuid(),
          from: null,
          fromId: null,
          body: 'Command executed successfully',
          createdAt: moment().toISOString()
        })
      } catch (error) {
        // Send error message
        socket.send('chatAdded', {
          id: uuid(),
          from: null,
          fromId: null,
          body: `Error: ${error.message}`,
          createdAt: moment().toISOString()
        })
      }
    },
    
    // Example of custom entity synchronization
    setupCustomEntity() {
      const entity = app.create('Group')
      
      // Add network properties
      entity.networkState = {
        position: new THREE.Vector3(),
        rotation: new THREE.Euler(),
        state: 'idle'
      }
      
      // Add network event handler
      entity.onEvent = (version, name, data, networkId) => {
        switch(name) {
          case 'move':
            this.handleEntityMove(entity, data)
            // Broadcast to other clients
            world.network.send('entityEvent', [
              entity.id,
              version,
              'move',
              data
            ], networkId)
            break
            
          case 'stateChange':
            this.handleStateChange(entity, data)
            // Broadcast to other clients
            world.network.send('entityEvent', [
              entity.id,
              version,
              'stateChange',
              data
            ], networkId)
            break
        }
      }
      
      return entity
    },
    
    // Example of custom persistence
    async saveCustomData() {
      const data = {
        // Custom data to save
        timestamp: Date.now(),
        state: this.getCustomState()
      }
      
      // Save to database
      await world.network.db('custom_data')
        .insert({
          id: uuid(),
          data: JSON.stringify(data),
          createdAt: moment().toISOString()
        })
    },
    
    // Example of custom authentication
    async authenticateUser(authToken) {
      try {
        // Verify token
        const { userId } = await readJWT(authToken)
        
        // Get user data
        const user = await world.network.db('users')
          .where('id', userId)
          .first()
        
        if (!user) {
          throw new Error('User not found')
        }
        
        // Add custom roles
        user.roles = user.roles.split(',')
        if (this.hasCustomPermission(user)) {
          user.roles.push('custom_role')
        }
        
        return user
      } catch (error) {
        console.error('Authentication failed:', error)
        return null
      }
    }
  }
}
```

This example demonstrates:
- Adding custom packet handlers
- Implementing custom commands
- Managing entity synchronization
- Handling persistence
- Custom authentication
- Role management

Remember that server-side code runs in a trusted environment, so always validate client input and check permissions before processing requests.
