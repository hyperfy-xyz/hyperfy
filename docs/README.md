# Hyperfy Documentation

Welcome to the Hyperfy documentation! This guide provides comprehensive information about Hyperfy's systems, components, and development practices.

## Getting Started

- [Components List](ComponentsList.md) - Overview of all available components

## Core Systems

### World & App
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

### Scripting
- [Scripting Guide](HyperfyScriptingGuide.md) - Learn how to create scripts in Hyperfy

## Development Workflow

1. **Project Setup**
   - Create a new app using the App class
   - Set up necessary systems
   - Load required assets

2. **Asset Management**
   - Use ClientLoader/ServerLoader for assets
   - Create and manage blueprints
   - Handle asset preloading

3. **Scripting**
   - Write scripts from the UI, or use the scripting guide
   - Use appropriate lifecycle methods
   - Implement proper cleanup

5. **Networking**
   - Handle client/server communication
   - Synchronize state
   - Validate data

6. **UI Development**
   - Use flexbox layouts
   - Handle responsiveness
   - Implement interactions

7. **Testing & Optimization**
   - Use ClientStats for monitoring
   - Optimize performance
   - Test across devices

## Best Practices

### Performance
- Use LOD for complex models
- Optimize physics colliders
- Minimize draw calls
- Cache frequently used objects
- Use efficient event handling

### Architecture
- Separate logic into systems
- Use events for communication
- Handle cleanup properly
- Follow component patterns
- Implement error handling

### Networking
- Minimize network traffic
- Handle latency gracefully
- Validate client input
- Use appropriate sync methods
- Implement fallbacks

### UI
- Use flexbox for layouts
- Handle different resolutions
- Implement responsive design
- Optimize UI updates
- Follow accessibility guidelines

## Examples

Check the [Scripting Guide](HyperfyScriptingGuide.md) for detailed examples of:
- State management
- Network synchronization
- Physics integration
- UI creation
- Resource management
- Error handling
- And more...

## Contributing

When contributing to the documentation:
1. Follow the existing format and style
2. Include clear examples
3. Document all parameters and return values
4. Provide best practices and common patterns
5. Keep examples concise but informative


Remember to consult individual component documentation for detailed APIs and usage examples.
