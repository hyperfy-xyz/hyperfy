# Input

## `app.control(options)`: Control

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

