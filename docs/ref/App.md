# App

The global `app` variable is always available within the app scripting runtime.

### `app.instanceId`: String

The instance ID of the current app.
Every app has its own unique ID that is shared across all clients and the server.

### `app.version`: String

The version of the app instance.
This number is incremented whenever the app is modified which includes but is not limited to updating scripts and models.

### `app.state`: Object

A plain old javascript object that you can use to store state in.
The servers state object is sent to all new clients that connect in their initial snapshot, allowing clients to initialize correctly, eg in the right position/mode.

### `app.on(name, callback)`

Subscribes to custom networked app events and engine update events like `update`, `fixedUpdate` and `lateUpdate`.

Custom networked events are received when a different client/server sends an event with `app.send(event, data)`. 

IMPORTANT: Only subscribe to update events when they are needed. The engine is optimized to completely skip over large amounts of apps that don't need to receive update events.

### `app.off(name, callback)`

Unsubscribes from custom events and update events.

IMPORTANT: Be sure to unsubscribe from update events when they are not needed. The engine is optimized to completely skip over large amounts of apps that don't need to receive update events.

### `app.send(name, data, skipNetworkId)`

Sends an event across the network.
If the caller is on the client, the event is sent to the server. The third argument `skipNetworkId` is a no-op here.
If the caller is on the server, the event is sent to all clients, with the `skipNetworkId` argument allowing you to skip sending to one specific client.

### `app.get(nodeId)`: Node

Finds and returns any node with the matching ID from the model the app is using.
If your model is made with blender, this is the object "name".

NOTE: Blender GLTF exporter renames objects in some cases, eg by removing spaces. Best practice is to simply name everything in UpperCamelCase with no other characters.

### `app.create(nodeName)`: Node

Creates and returns a node of the specified name.

### `app.control(options)`: Control

TODO: provides control to a client to respond to inputs and move the camera etc

### `app.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

### Additional Properties and Methods

### `app.mode`: String

Current app state:
```typescript
{
  ACTIVE: 'active',     // Normal operation
  MOVING: 'moving',     // Being moved by user
  LOADING: 'loading',   // Loading assets
  CRASHED: 'crashed'    // Script error occurred
}
```

### `app.blueprint`: Object

The app's blueprint configuration:
```typescript
{
  id: String,           // Blueprint ID
  model?: String,       // Optional 3D model URL
  script?: String,      // Optional script URL
  config?: Object,      // Custom configuration
  version: Number      // Blueprint version
}
```

### `app.configure(fn)`: void

Sets a configuration handler function that returns configuration options for the app.

### `app.config`: Object

Access to the app's blueprint configuration.

### `app.emit(name, data)`: void

Emits a local event. Cannot emit internal events (fixedUpdate, update, lateUpdate, enter, leave, chat).

### Notes

- Supports hot reloading through blueprint versions
- Handles network synchronization
- Manages asset loading states
- Provides secure script execution
- Supports move/edit modes
- Handles script crashes gracefully
