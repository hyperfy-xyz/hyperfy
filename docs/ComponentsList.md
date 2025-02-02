# Hyperfy Components

A comprehensive list of all available components in Hyperfy, organized by category.

## Core Systems

### World Management
- [World](ref/World.md) - Core system manager and game loop
- [App](ref/App.md) - Interactive application foundation
- [Entity](ref/Entity.md) - Base entity class
- [Player](ref/Player.md) - Player entity management

### Networking
- [ClientNetwork](ref/ClientNetwork.md) - Client-side networking
- [ServerNetwork](ref/ServerNetwork.md) - Server-side networking

### Asset Management
- [ClientLoader](ref/ClientLoader.md) - Client-side asset loading
- [ServerLoader](ref/ServerLoader.md) - Server-side asset loading
- [Blueprints](ref/Blueprints.md) - Asset blueprint management

### Environment
- [ClientEnvironment](ref/ClientEnvironment.md) - Environment and lighting
- [Stage](ref/Stage.md) - Scene management
- [Sky](ref/Sky.md) - Sky and environment maps

### User Interface
- [UI](ref/UI.md) - Base UI system
- [UIView](ref/UIView.md) - Flexbox layout container
- [UIText](ref/UIText.md) - Text rendering
- [UIImage](ref/UIImage.md) - Image rendering

### Physics
- [Physics](ref/Physics.md) - Physics system
- [RigidBody](ref/RigidBody.md) - Physical body
- [Collider](ref/Collider.md) - Collision shape

### Input and Controls
- [ClientControls](ref/ClientControls.md) - Input handling
- [Controller](ref/Controller.md) - Input controller
- [Action](ref/Action.md) - Interactive trigger

### Scene Graph
- [Node](ref/Node.md) - Base node class
- [Group](ref/Group.md) - Node container
- [Mesh](ref/Mesh.md) - 3D mesh
- [LOD](ref/LOD.md) - Level of detail
- [Joint](ref/Joint.md) - Physical joint

### Avatar
- [Avatar](ref/Avatar.md) - VRM avatar system
- [Nametag](ref/Nametag.md) - Player name display

### Development Tools
- [ClientEditor](ref/ClientEditor.md) - In-world editor
- [ClientStats](ref/ClientStats.md) - Performance monitoring

### Communication
- [Chat](ref/Chat.md) - Chat system
- [Events](ref/Events.md) - Event system

## System Features

### World
- Game loop management
- System coordination
- Time management
- Camera control
- Hot reloading

### App
- Script execution
- Asset management
- State synchronization
- Event handling
- UI creation

### Networking
- Client/server communication
- State synchronization
- Asset uploading
- Player management
- Chat messaging

### Physics
- Rigid body dynamics
- Collision detection
- Joint constraints
- Ray casting
- Physics materials

### UI
- Flexbox layouts
- Event handling
- Text rendering
- Image display
- Style properties

### Environment
- Lighting system
- Shadow mapping
- Sky rendering
- Post-processing
- Environment maps

### Development
- In-world editing
- Performance monitoring
- Asset management
- Debug visualization
- Error handling

## Best Practices

### Performance
1. Use LOD for complex models
2. Optimize physics colliders
3. Minimize draw calls
4. Cache frequently used objects
5. Use efficient event handling

### Architecture
1. Separate logic into systems
2. Use events for communication
3. Handle cleanup properly
4. Follow component patterns
5. Implement error handling

### Networking
1. Minimize network traffic
2. Handle latency gracefully
3. Validate client input
4. Use appropriate sync methods
5. Implement fallbacks

### UI
1. Use flexbox for layouts
2. Handle different resolutions
3. Implement responsive design
4. Optimize UI updates
5. Follow accessibility guidelines

## Getting Started

1. Create a new app using the App class
2. Set up necessary systems
3. Load required assets
4. Implement game logic
5. Handle cleanup

Example:
```javascript
export default function(world, app, fetch) {
  return {
    async start() {
      // Load assets
      await this.loadAssets()
      
      // Set up systems
      this.setupSystems()
      
      // Create UI
      this.createUI()
      
      // Initialize game logic
      this.initGame()
    },
    
    async loadAssets() {
      // Use ClientLoader
    },
    
    setupSystems() {
      // Configure physics, networking, etc.
    },
    
    createUI() {
      // Use UIView, UIText, etc.
    },
    
    initGame() {
      // Implement game logic
    },
    
    destroy() {
      // Clean up resources
    }
  }
}
```

## Additional Resources

- [HyperfyScriptingGuide](HyperfyScriptingGuide.md) - Detailed scripting guide
- API Documentation - Individual component references
- Example Projects - Sample implementations
- Community Resources - Shared components and tools

Remember to consult individual component documentation for detailed APIs and usage examples.
