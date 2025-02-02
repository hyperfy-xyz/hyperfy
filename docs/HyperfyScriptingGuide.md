# Hyperfy Scripting Guide

A comprehensive guide to scripting in Hyperfy, covering core concepts, best practices, and common patterns.

## Table of Contents

1. [Script Structure](#script-structure)
2. [Core APIs](#core-apis)
3. [Common Patterns](#common-patterns)
4. [Best Practices](#best-practices)
5. [Examples](#examples)

## Script Structure

Every Hyperfy script exports a default function that receives three parameters:

```javascript
export default function(world, app, fetch) {
  return {
    // Lifecycle methods
    start() {
      // Called when script starts
    },
    
    // Update methods
    fixedUpdate(dt) {
      // Fixed timestep physics update
    },
    update(dt) {
      // Variable timestep update
    },
    lateUpdate(dt) {
      // Post-update operations
    },
    
    // Cleanup
    destroy() {
      // Called when script is destroyed
    }
  }
}
```

### Parameters

- `world`: Access to world systems and global state
- `app`: Interface for creating and managing entities
- `fetch`: Network request function with automatic cleanup

### Lifecycle Methods

- `start()`: Initialize resources and set up systems
- `fixedUpdate(dt)`: Physics and fixed-rate updates
- `update(dt)`: Frame-by-frame updates
- `lateUpdate(dt)`: Post-update operations
- `destroy()`: Clean up resources

## Core APIs

### World API

Access global systems and state:

```javascript
// Network state
world.networkId       // Current network ID
world.isServer       // Is server instance
world.isClient       // Is client instance

// Time
world.getTime()      // Current network time
world.getTimestamp() // Formatted timestamp

// Events
world.on(name, callback)    // Listen for event
world.off(name, callback)   // Remove listener
world.emit(name, data)      // Emit event

// Chat
world.chat(message, broadcast)  // Send chat message

// Players
world.getPlayer(id)  // Get player by ID
```

### App API

Create and manage entities:

```javascript
// Node management
app.create(type)     // Create new node
app.add(node)        // Add to scene
app.remove(node)     // Remove from scene
app.get(id)         // Get node by ID

// State
app.instanceId      // Unique instance ID
app.version        // Blueprint version
app.state          // App state
app.config        // Blueprint config

// Events
app.on(name, callback)    // Listen for event
app.off(name, callback)   // Remove listener
app.send(name, data)      // Send network event
app.emit(name, data)      // Emit local event

// Input
app.control(options)  // Bind input controls
```

## Common Patterns

### State Management

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Initialize state
      app.state = {
        counter: 0,
        active: false,
        items: []
      }
      
      // Listen for state changes
      app.on('stateChange', this.handleStateChange)
    },
    
    handleStateChange(newState) {
      // Update local state
      app.state = newState
      
      // Update visuals
      this.updateVisuals()
    },
    
    updateState(changes) {
      // Update state
      app.state = {
        ...app.state,
        ...changes
      }
      
      // Broadcast changes
      app.send('stateChange', app.state)
    }
  }
}
```

### Network Synchronization

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Set up network events
      app.on('positionUpdate', this.handlePositionUpdate)
      
      // Create synchronized object
      this.object = app.create('Mesh')
      this.object.geometry = 'box'
      
      // Store network state
      this.networkState = {
        position: new THREE.Vector3(),
        rotation: new THREE.Euler()
      }
    },
    
    update(dt) {
      if (world.isServer) {
        // Server: Send updates
        app.send('positionUpdate', {
          position: this.object.position.toArray(),
          rotation: this.object.rotation.toArray()
        })
      } else {
        // Client: Interpolate
        this.object.position.lerp(this.networkState.position, dt * 10)
        this.object.rotation.lerp(this.networkState.rotation, dt * 10)
      }
    },
    
    handlePositionUpdate(data) {
      // Update network state
      this.networkState.position.fromArray(data.position)
      this.networkState.rotation.fromArray(data.rotation)
    }
  }
}
```

### Physics Integration

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Create physical object
      this.object = app.create('RigidBody')
      this.object.type = 'dynamic'
      
      // Add collider
      const collider = app.create('Collider')
      collider.type = 'box'
      this.object.add(collider)
      
      // Add visual mesh
      const mesh = app.create('Mesh')
      mesh.geometry = 'box'
      this.object.add(mesh)
      
      app.add(this.object)
    },
    
    fixedUpdate(dt) {
      // Apply forces
      if (this.object.isGrounded()) {
        const jumpForce = new THREE.Vector3(0, 10, 0)
        this.object.applyForce(jumpForce)
      }
    }
  }
}
```

### UI Creation

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Create UI container
      const container = app.create('UIView')
      container.width = 300
      container.height = 200
      container.backgroundColor = '#1a1a1a'
      container.borderRadius = 8
      container.padding = 16
      
      // Add content
      const text = app.create('UIText')
      text.text = 'Hello World'
      text.color = '#ffffff'
      container.add(text)
      
      // Add button
      const button = app.create('UIView')
      button.height = 40
      button.backgroundColor = '#3a3a3a'
      button.borderRadius = 4
      button.justifyContent = 'center'
      button.alignItems = 'center'
      
      const label = app.create('UIText')
      label.text = 'Click Me'
      button.add(label)
      
      // Add interaction
      button.onPointerDown = () => {
        this.handleClick()
      }
      
      container.add(button)
      app.add(container)
    }
  }
}
```

## Best Practices

### Performance

1. **Minimize Object Creation**
```javascript
// Bad
update(dt) {
  const vector = new THREE.Vector3(x, y, z)
}

// Good
start() {
  this.vector = new THREE.Vector3()
}
update(dt) {
  this.vector.set(x, y, z)
}
```

2. **Use Object Pooling**
```javascript
export default function(world, app, fetch) {
  return {
    start() {
      this.pool = []
      this.active = new Set()
    },
    
    spawn() {
      // Reuse or create
      let object = this.pool.pop() || this.createObject()
      this.active.add(object)
      return object
    },
    
    despawn(object) {
      // Return to pool
      this.active.delete(object)
      this.pool.push(object)
    }
  }
}
```

3. **Optimize Updates**
```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Only update when needed
      app.on('stateChange', () => {
        this.needsUpdate = true
      })
    },
    
    update(dt) {
      if (!this.needsUpdate) return
      this.updateVisuals()
      this.needsUpdate = false
    }
  }
}
```

### Error Handling

```javascript
export default function(world, app, fetch) {
  return {
    async start() {
      try {
        await this.initialize()
      } catch (error) {
        console.error('Failed to initialize:', error)
        this.handleError(error)
      }
    },
    
    handleError(error) {
      // Show error UI
      const message = app.create('UIText')
      message.text = `Error: ${error.message}`
      message.color = '#ff0000'
      app.add(message)
      
      // Notify user
      world.chat(`An error occurred: ${error.message}`)
    }
  }
}
```

### Resource Management

```javascript
export default function(world, app, fetch) {
  return {
    async start() {
      // Track resources
      this.resources = new Set()
      
      // Load assets
      const model = await world.loader.load(
        'model',
        'asset://models/object.glb'
      )
      this.resources.add(model)
      
      // Create objects
      const node = app.create('Mesh')
      this.resources.add(node)
    },
    
    destroy() {
      // Clean up all resources
      for (const resource of this.resources) {
        if (resource.destroy) {
          resource.destroy()
        }
      }
      this.resources.clear()
    }
  }
}
```

## Examples

### Interactive Object

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Create interactive object
      const object = app.create('Mesh')
      object.geometry = 'box'
      object.material.color = '#ff0000'
      
      // Add hover effect
      object.onPointerEnter = () => {
        object.material.color = '#00ff00'
      }
      object.onPointerLeave = () => {
        object.material.color = '#ff0000'
      }
      
      // Add click handler
      object.onPointerDown = () => {
        this.handleClick()
      }
      
      app.add(object)
      this.object = object
    },
    
    handleClick() {
      // Animate on click
      const scale = this.object.scale.x > 1 ? 1 : 1.5
      this.object.scale.setScalar(scale)
      
      // Emit event
      app.send('objectClicked', {
        scale
      })
    }
  }
}
```

### Multiplayer Game

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Initialize game state
      app.state = {
        players: new Map(),
        score: 0,
        gameState: 'waiting'
      }
      
      // Set up network events
      app.on('playerJoined', this.handlePlayerJoin)
      app.on('playerLeft', this.handlePlayerLeave)
      app.on('scoreUpdate', this.handleScoreUpdate)
      
      // Create game UI
      this.createUI()
    },
    
    handlePlayerJoin(player) {
      // Create player representation
      const avatar = app.create('Mesh')
      avatar.position.copy(player.position)
      app.add(avatar)
      
      // Track player
      app.state.players.set(player.id, {
        avatar,
        score: 0
      })
      
      // Update UI
      this.updatePlayerList()
    },
    
    handleScoreUpdate(data) {
      const player = app.state.players.get(data.playerId)
      if (player) {
        player.score = data.score
        this.updateScoreboard()
      }
    },
    
    updateScoreboard() {
      // Sort players by score
      const sorted = Array.from(app.state.players.entries())
        .sort((a, b) => b[1].score - a[1].score)
      
      // Update UI
      this.scoreboard.clear()
      sorted.forEach(([id, player]) => {
        const row = app.create('UIView')
        row.flexDirection = 'row'
        row.justifyContent = 'space-between'
        
        const name = app.create('UIText')
        name.text = world.getPlayer(id).name
        row.add(name)
        
        const score = app.create('UIText')
        score.text = player.score.toString()
        row.add(score)
        
        this.scoreboard.add(row)
      })
    }
  }
}
```

Remember to:
- Handle cleanup properly
- Validate network data
- Use appropriate error handling
- Follow performance best practices
- Document your code
