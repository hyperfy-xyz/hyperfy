# Nametag

The Nametag component in Hyperfy displays a text label that follows an entity in 3D space. It's commonly used for player names, object labels, or any other text that needs to hover above an entity.

### Inheritance

Nametag inherits all properties and methods from [Node](/docs/ref/Node.md).

### Properties

### `nametag.label`: String

The text to display in the nametag. Default is '...'.

### Notes

- Nametags automatically face the camera (billboard)
- The nametag's position updates automatically when its parent node moves
- Nametags are managed by the world's nametag system for efficient rendering
- The appearance (font, size, color) is controlled by the global nametag system settings

### Usage

Nametags are used to:

1. Display player names
2. Label interactive objects
3. Show status information above entities
4. Create floating waypoints or markers

### Example

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Create a simple labeled object
      const object = app.create('Group')
      
      // Add a visual representation
      const mesh = app.create('Mesh')
      object.add(mesh)
      
      // Add a nametag
      const nametag = app.create('Nametag')
      nametag.label = 'Interactive Object'
      
      // Position the nametag above the object
      nametag.position.y = 2
      
      // Add the nametag to the object
      object.add(nametag)
      
      // Add the object to the scene
      app.add(object)
    }
  }
}

// Example with dynamic nametag updates
export default function(world, app, fetch) {
  return {
    start() {
      // Create an interactive object
      const interactiveObject = app.create('Group')
      
      // Add a nametag for status
      const statusTag = app.create('Nametag')
      statusTag.label = 'Status: Ready'
      statusTag.position.y = 2
      interactiveObject.add(statusTag)
      
      // Store reference for updates
      this.statusTag = statusTag
      
      // Add interaction handler
      interactiveObject.onPointerDown = () => {
        this.toggleStatus()
      }
      
      app.add(interactiveObject)
      
      // Initialize state
      this.isActive = false
    },
    
    toggleStatus() {
      this.isActive = !this.isActive
      
      // Update nametag text
      this.statusTag.label = `Status: ${this.isActive ? 'Active' : 'Ready'}`
    }
  }
}

// Example with multiple nametags and positioning
export default function(world, app, fetch) {
  return {
    start() {
      // Create a complex object with multiple labels
      const machine = app.create('Group')
      
      // Add main label
      const titleTag = app.create('Nametag')
      titleTag.label = 'Processing Unit'
      titleTag.position.y = 2.5
      machine.add(titleTag)
      
      // Add status label
      const statusTag = app.create('Nametag')
      statusTag.label = 'Online'
      statusTag.position.set(0, 2, 0)
      machine.add(statusTag)
      
      // Add temperature label
      const tempTag = app.create('Nametag')
      tempTag.label = '25°C'
      tempTag.position.set(0, 1.5, 0)
      machine.add(tempTag)
      
      // Store references for updates
      this.statusTag = statusTag
      this.tempTag = tempTag
      
      // Add to scene
      app.add(machine)
      
      // Update temperature periodically
      this.updateInterval = setInterval(() => {
        const temp = 20 + Math.random() * 10
        this.tempTag.label = `${temp.toFixed(1)}°C`
      }, 1000)
    },
    
    destroy() {
      // Clean up interval
      clearInterval(this.updateInterval)
    }
  }
}
```

This example demonstrates various ways to use nametags:
- Basic static labels
- Dynamic status indicators
- Multiple nametags with different positions
- Updating nametag content based on state or events

Remember that nametags are rendered efficiently by the system, so you can use many of them without significant performance impact. However, consider the readability of your scene when using multiple nametags in close proximity.
