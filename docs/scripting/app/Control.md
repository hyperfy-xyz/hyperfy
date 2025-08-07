# Input

## `app.control(options)`: Control

The `app.control()` method gives you access to user inputs like keyboard and mouse and gives you control over the camera etc. It's the primary way to create interactive experiences.

```javascript
// Get a control object
const control = app.control()

// The app will be cleaned up automatically, but if you need to manually release control:
control.release()
```

### Buttons

Listen to press and release events for keyboard keys and mouse buttons.

```javascript
// Listen for 'W' key press and release
control.keyW.onPress = () => { console.log('W pressed') }
control.keyW.onRelease = () => { console.log('W released') }

// Listen for left mouse button
control.mouseLeft.onPress = () => { console.log('Left mouse button pressed') }
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
  const pointerDelta = control.pointer.delta
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
const scrollDelta = control.scrollDelta.value
```

*   `scrollDelta.value` (Number): The scroll delta for the current frame.
*   `scrollDelta.capture` (Boolean): If `true`, consumes the scroll event.

### Camera

Lets you read and also modify the camera position if needed.

By default the camera information is read-only, set `write` to true when you want to take over control.

```jsx
control.camera.write = true
control.camera.position.y = 4
```

*   `camera.position` (Vector3): The position of the camera in world space.
*   `camera.quaternion` (Quaternion): The quaternion rotation of the camera in world space.
*   `camera.rotation` (Euler): The euler rotation (radians) of the camera in world space.
*   `camera.zoom` (Number): Third person zoom value, eg how far back the camera is from its position.
*   `camera.write` (Boolean): Set this to `true` if you want to modify the camera in any way.


### Screen

Gives you the dimensions of the screen in pixels, useful when positioning UI.

*   `screen.width` (Number): The width of the screen in px.
*   `screen.height` (Number): The height of the screen in px.