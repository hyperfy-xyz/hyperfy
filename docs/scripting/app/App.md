# App

The global `app` variable is always available within the app scripting runtime.

## Properties

### `.instanceId`: String

The instance ID of the current app.
Every app has its own unique ID that is shared across all clients and the server.

### `.version`: String

The version of the app instance.
This number is incremented whenever the app is modified which includes but is not limited to updating scripts and models.

### `.state`: Object

A plain old javascript object that you can use to store state in.
The servers state object is sent to all new clients that connect in their initial snapshot, allowing clients to initialize correctly, eg in the right position/mode.

### `.{...Node}`

Inherits all [Node](/docs/scripting/nodes/Node.md) properties

## Methods

### `.on(name, callback)`

Subscribes to custom networked app events and engine update events like `update`, `fixedUpdate` and `lateUpdate`.

Custom networked events are received when a different client/server sends an event with `app.send(event, data)`. 

IMPORTANT: Only subscribe to update events when they are needed. The engine is optimized to completely skip over large amounts of apps that don't need to receive update events.

### `.off(name, callback)`

Unsubscribes from custom events and update events.

IMPORTANT: Be sure to unsubscribe from update events when they are not needed. The engine is optimized to completely skip over large amounts of apps that don't need to receive update events.

### `.send(name, data, skipNetworkId)`

Sends an event across the network.
If the caller is on the client, the event is sent to the server. The third argument `skipNetworkId` is a no-op here.
If the caller is on the server, the event is sent to all clients, with the `skipNetworkId` argument allowing you to skip sending to one specific client.

### `.emit(name, data)`

Emits a local event to the world that other apps can listen for (using `world.on(name, callback)`).
Emitted events are not networked and only "local" apps (on the same client or server) can receive/listen for them.

NOTE: you cannot emit built-in events such as `enter` or `leave` as these are internal and emitted when players enter or leave the world.

### `.get(nodeId)`: Node

Finds and returns any node with the matching ID from the model the app is using.
If your model is made with blender, this is the object "name".

NOTE: Blender GLTF exporter renames objects in some cases, eg by removing spaces. Best practice is to simply name everything in UpperCamelCase with no other characters.

### `.create(nodeName)`: Node

Creates and returns a node of the specified name.

### `.control(options)`: Control

The `app.control()` method gives you access to user inputs like keyboard and mouse. It's the primary way to create interactive experiences. You can have multiple active controls, and they are prioritized.

```javascript
// Get a control object
const controls = app.control({ priority: 1 })

// The app will be cleaned up automatically, but if you need to manually release control:
controls.release()
```

**Options**

*   `priority` (Number): A number that determines the order of input processing. Higher numbers have higher priority. Defaults to `0`. Player controls usually have a low priority, so scripts can override them.
*   `onButtonPress` (Function): A callback for any button press. `(prop, text) => {}`. `prop` is the button property name (e.g. `keyW`), `text` is the character for the key. Return `true` to consume the event.


### Button Events

You can listen to press and release events for keyboard keys and mouse buttons.

```javascript
// Listen for 'W' key press and release
controls.keyW.onPress = () => { console.log('W pressed') }
controls.keyW.onRelease = () => { console.log('W released') }

// Listen for left mouse button
controls.mouseLeft.onPress = () => { console.log('Left mouse button pressed') }
```

Each button object has the following properties:
*   `onPress` (Function): Callback for when the button is first pressed down.
*   `onRelease` (Function): Callback for when the button is released.
*   `down` (Boolean): `true` if the button is currently held down.
*   `pressed` (Boolean): `true` for the single frame when the button is first pressed.
*   `released` (Boolean): `true` for the single frame when the button is released.
*   `capture` (Boolean): If set to `true`, it will consume the event and prevent lower-priority controls from receiving it.

Here is a list of available button properties:

`keyA` to `keyZ`, `digit0` to `digit9`, `minus`, `equal`, `bracketLeft`, `bracketRight`, `backslash`, `semicolon`, `quote`, `backquote`, `comma`, `period`, `slash`, `arrowUp`, `arrowDown`, `arrowLeft`, `arrowRight`, `home`, `end`, `pageUp`, `pageDown`, `tab`, `capsLock`, `shiftLeft`, `shiftRight`, `controlLeft`, `controlRight`, `altLeft`, `altRight`, `enter`, `space`, `backspace`, `delete`, `escape`, `mouseLeft`, `mouseRight`, `metaLeft`.

### Pointer

Access pointer (mouse) information.

```javascript
// Get pointer delta every frame
app.on('update', () => {
  const pointerDelta = controls.pointer.delta
  if (pointerDelta.x !== 0 || pointerDelta.y !== 0) {
    console.log('Pointer moved:', pointerDelta.x, pointerDelta.y)
  }
})
```

*   `pointer.coords` (Vector3): Pointer coordinates in normalized screen space (`[0,0]` to `[1,1]`).
*   `pointer.position` (Vector3): Pointer coordinates in screen pixels.
*   `pointer.delta` (Vector3): Change in pointer position since the last frame.
*   `pointer.locked` (Boolean): `true` if the pointer is currently locked.
*   `pointer.lock()`: Requests to lock the pointer to the screen.
*   `pointer.unlock()`: Releases the pointer lock.

### Scroll

Get mouse scroll wheel changes.

```javascript
// The value is the scroll delta for the current frame.
const scrollDelta = controls.scrollDelta.value
```

*   `scrollDelta.value` (Number): The scroll delta for the current frame.
*   `scrollDelta.capture` (Boolean): If `true`, consumes the scroll event.


#### `.configure(fields)`

Configures custom UI for your app. See [Props](/docs/scripting/app/Props.md) for more info.
