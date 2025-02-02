# World

The global `world` variable is always available within the app scripting runtime.

### `world.networkId`: String

A unique ID for the current server or client.

### `world.isServer`: Boolean

Whether the script is currently executing on the server.

### `world.isClient`: Boolean

Whether the script is currently executing on the client.

### `world.add(node)`

Adds a node into world-space, outside of the apps local hierarchy.

### `world.remove(node)`

Removes a node from world-space, outside of the apps local hierarchy.

### `world.attach(node)`

Adds a node into world-space, maintaining its current world transform.

### `world.on(event, callback)`

Subscribes to world events.
Currently only `enter` and `leave` are available which let you know when a player enters or leaves the world.

### `world.off(event, callback)`

Unsubscribes from world events.

### Additional Properties

### `world.time`: Number

Current world time in seconds.

### `world.frame`: Number

Current frame number.

### `world.networkRate`: Number

Network update rate in seconds. Defaults to 1/8 (8Hz).

### Systems

The world manages several core systems:

- `world.events`: Event handling system
- `world.scripts`: Script management system
- `world.chat`: Chat system
- `world.blueprints`: Blueprint management system
- `world.entities`: Entity management system
- `world.physics`: Physics system
- `world.stage`: Stage/scene management system

### Update Cycle

The world runs the following update cycle:

1. `fixedUpdate(dt)`: Fixed timestep updates (1/50s)
2. `update(dt)`: Variable timestep updates
3. `lateUpdate(dt)`: Post-update operations
4. `postLateUpdate(dt)`: Final update phase

### Notes

- Manages the game loop and system coordination
- Handles fixed and variable timestep updates
- Coordinates all core systems
- Provides network synchronization
- Manages the camera and scene
