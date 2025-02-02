# Events

The Events system in Hyperfy provides event emission and handling capabilities. It runs on both client and server, allowing components to communicate through a simple event-based system.

### Methods

### `events.on(name: String, callback: Function): void`

Registers an event listener.

Parameters:
- `name`: The event name to listen for
- `callback`: Function to call when the event occurs. Can receive up to two arguments.

### `events.off(name: String, callback: Function): void`

Removes an event listener.

Parameters:
- `name`: The event name
- `callback`: The callback function to remove

### `events.emit(name: String, arg1?: any, arg2?: any): void`

Emits an event to all registered listeners.

Parameters:
- `name`: The event name
- `arg1`: (Optional) First argument to pass to listeners
- `arg2`: (Optional) Second argument to pass to listeners

### Notes

- Event listeners are stored in Sets for efficient handling
- Callbacks can receive up to two arguments
- Error handling prevents one bad listener from affecting others
- Events are handled synchronously
- The system runs on both client and server

### Usage

The Events system is used to:

1. Handle world events (player join/leave)
2. Communicate between components
3. Create custom event-driven behaviors
4. Implement observer patterns
5. Coordinate system actions

### Example

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Listen for player events
      world.on('playerJoined', this.handlePlayerJoin)
      world.on('playerLeft', this.handlePlayerLeave)
      
      // Listen for custom events
      world.on('gameStart', this.handleGameStart)
      world.on('gameEnd', this.handleGameEnd)
      
      // Create interactive object
      const button = app.create('Action')
      button.onTrigger = () => {
        // Emit custom event
        world.emit('buttonPressed', {
          id: button.id,
          position: button.position.toArray()
        })
      }
      
      app.add(button)
    },
    
    handlePlayerJoin(player) {
      console.log('Player joined:', player.id)
      
      // Emit welcome event
      world.emit('playerWelcome', player, {
        message: 'Welcome to the game!',
        timestamp: Date.now()
      })
    },
    
    handlePlayerLeave(player) {
      console.log('Player left:', player.id)
    },
    
    handleGameStart(config) {
      console.log('Game started with config:', config)
    },
    
    handleGameEnd(results) {
      console.log('Game ended with results:', results)
    },
    
    destroy() {
      // Clean up event listeners
      world.off('playerJoined', this.handlePlayerJoin)
      world.off('playerLeft', this.handlePlayerLeave)
      world.off('gameStart', this.handleGameStart)
      world.off('gameEnd', this.handleGameEnd)
    }
  }
}

// Example of event-driven game mechanics
export default function(world, app, fetch) {
  return {
    start() {
      // Set up game state
      this.score = 0
      this.gameActive = false
      
      // Listen for game events
      world.on('collectItem', this.handleItemCollect)
      world.on('hitObstacle', this.handleObstacleHit)
      world.on('reachedCheckpoint', this.handleCheckpoint)
      
      // Create score display
      this.scoreDisplay = app.create('UIText')
      this.scoreDisplay.text = 'Score: 0'
      app.add(this.scoreDisplay)
      
      // Create game objects
      this.createCollectibles()
      this.createObstacles()
      this.createCheckpoints()
    },
    
    handleItemCollect(item, player) {
      // Update score
      this.score += item.value
      this.scoreDisplay.text = `Score: ${this.score}`
      
      // Emit score update
      world.emit('scoreUpdated', {
        playerId: player.id,
        newScore: this.score,
        itemType: item.type
      })
      
      // Remove collected item
      item.destroy()
    },
    
    handleObstacleHit(obstacle, player) {
      // Emit damage event
      world.emit('playerDamaged', player, {
        amount: obstacle.damage,
        type: obstacle.type
      })
      
      // Visual feedback
      this.createDamageEffect(obstacle.position)
    },
    
    handleCheckpoint(checkpoint, player) {
      // Save progress
      const saveData = {
        position: checkpoint.position.toArray(),
        score: this.score,
        time: world.time
      }
      
      // Emit checkpoint event
      world.emit('checkpointReached', player, saveData)
    },
    
    createDamageEffect(position) {
      const effect = app.create('Mesh')
      effect.position.copy(position)
      app.add(effect)
      
      // Emit effect created event
      world.emit('effectCreated', {
        type: 'damage',
        position: position.toArray()
      })
      
      // Clean up after animation
      setTimeout(() => {
        effect.destroy()
      }, 1000)
    },
    
    destroy() {
      // Clean up event listeners
      world.off('collectItem', this.handleItemCollect)
      world.off('hitObstacle', this.handleObstacleHit)
      world.off('reachedCheckpoint', this.handleCheckpoint)
    }
  }
}
```

This example demonstrates:
- Setting up event listeners
- Emitting events with data
- Handling player events
- Creating custom game events
- Cleaning up listeners
- Event-driven game mechanics
- Coordinating multiple systems

Remember to always clean up event listeners in the destroy method to prevent memory leaks and unintended behavior.
