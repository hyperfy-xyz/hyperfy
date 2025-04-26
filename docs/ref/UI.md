# UI

Displays a UI plane in-world

```jsx
const ui = app.create('ui')
ui.backgroundColor = 'rgba(0, 0, 0, 0.5)'
```

## Properties

### `.space`: String

Whether this UI should be rendered in `world` space or `screen` space.
When `world`, a plane geometry is physically placed in the world.
When `screen`, the canvas is drawn directly on the screen.
Defaults to `world`.

NOTE: when using `screen`, the `.position` value now represents a ratio from 0 to 1 on each axis. For example `position.x = 1` is the far right of the screen and `position.x = 0` is the far left. Use this in combination with the `pivot` and `offset` values.

```jsx
/**
 * Example:
 * The following screen-space UI is rendered in the top left of the 
 * screen, 20px away from both edges.
*/
const ui = app.create('ui', {
  space: 'screen',
  pivot: 'top-right',
  position: [1, 0, 0] // far right
  offset: [-20, 20, 0] // 20px left, 20px down
})
```

### `.width`: Number

The width of the UI canvas in pixels. Defaults to `100`.

### `.height`: Number

The height of the UI canvas in pixels. Defaults to `100`.

### `.size`: Number

This value converts pixels to meters. 
For example if you set `width = 100` and `size = 0.01` your UI will have a width of one meter.
This allows you to build UI while thinking in pixels instead of meters, and makes it easier to resize things later.
Defaults to `0.01`.

### `.lit`: Boolean

Whether the canvas is affected by lighting. Defaults to `false`.

### `.doubleside`: Boolean

Whether the canvas is doublesided. Defaults to `false`.

### `.billboard`: String

Makes the UI face the camera. Can be `none`, `full` or `y`. Default to `none`.

### `.pivot`: String

Determines where the "center" of the UI is.
Options are: `top-left`, `top-center`, `top-right`, `center-left`, `center`, `center-right`, `bottom-left`, `bottom-center`, `bottom-right`.
Defaults to `center`.

### `.offset`: Vector3

Only applicable when using screen-space.
The offset in pixels applied after the `position` value.

### `.scaler`: Array|null

When creating UI in world-space you sometimes want it to scale as if it was in screen-space, so that when you are far away it scales up to match the size it would be if it were on screen and vice versa. This is useful for things like buttons and chat bubbles.

To enable this, set the `scaler` property to an array in the format `[minDistance, maxDistance, baseScale=1]`, eg:

```jsx
ui.scaler = [0, Infinity] // always scale to match screen space
// or...
ui.scaler = [5, 20] // scale to match screen space within 5 and 20 meters
```

Defaults to `null`.

### `.pointerEvents`: Boolean

Whether the UI should receive or ignore pointer events. Defaults to `true`.
If you are building informational screen-space UI that does not need to respond to pointer events, this should be set to `false` for an improved user experience.

### `.backgroundColor`: String

The background color of the UI. 
Can be hex (eg `#000000`) or rgba (eg `rgba(0, 0, 0, 0.5)`).
Defaults to `null`.

### `.borderWidth`: Number

The width of the border in pixels.

### `.borderColor`: String

The color of the border.

### `.borderRadius`: Number

The radius of the border in pixels.

### `.padding`: Number

The inner padding of the UI in pixels.
Defaults to `0`.

### `.flexDirection`: String

The flex direction. `column`, `column-reverse`, `row` or `row-reverse`.
Defaults to `column`.

### `.justifyContent`: String

Options: `flex-start`, `flex-end`, `center`.
Defaults to `flex-start`.

### `.alignItems`: String

Options: `stretch`, `flex-start`, `flex-end`, `center`, `baseline`.
Defaults to `stretch`.

### `.alignContent`: String

Options: `flex-start`, `flex-end`, `stretch`, `center`, `space-between`, `space-around`, `space-evenly`.
Defaults to `flex-start`.

### `.flexWrap`: String

Options: `no-wrap`, `wrap`.
Defaults to `no-wrap`.

### `.gap`: Number

Defaults to `0`.

### `.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

