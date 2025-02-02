# UI

Displays a UI plane in-world

```jsx
const ui = app.create('ui')
ui.backgroundColor = 'rgba(0, 0, 0, 0.5)'
```

### `ui.width`: Number

The width of the UI canvas in pixels. Defaults to `100`.

### `ui.height`: Number

The height of the UI canvas in pixels. Defaults to `100`.

### `ui.size`: Number

This value converts pixels to meters. 
For example if you set `width = 100` and `size = 0.01` your UI will have a width of one meter.
This allows you to build UI while thinking in pixels instead of meters, and makes it easier to resize things later.
Defaults to `0.01`.

### `ui.lit`: Boolean

Whether the canvas is affected by lighting. Defaults to `false`.

### `ui.doubleside`: Boolean

Whether the canvas is doublesided. Defaults to `false`.

### `ui.billboard`: String

Makes the UI face the camera. Can be `null`, `full` or `y-axis`. Default to `null`.

### `ui.pivot`: String

Determines where the "center" of the UI is.
Options are: `top-left`, `top-center`, `top-right`, `center-left`, `center`, `center-right`, `bottom-left`, `bottom-center`, `bottom-right`.
Defaults to `center`.

### `ui.backgroundColor`: String

The background color of the UI. 
Can be hex (eg `#000000`) or rgba (eg `rgba(0, 0, 0, 0.5)`).
Defaults to `null`.

### `ui.borderRadius`: Number

The radius of the border in pixels.

### `ui.padding`: Number

The inner padding of the UI in pixels.
Defaults to `0`.

### `ui.flexDirection`: String

The flex direction. `column`, `column-reverse`, `row` or `row-reverse`.
Defaults to `column`.

### `ui.justifyContent`: String

Options: `flex-start`, `flex-end`, `center`.
Defaults to `flex-start`.

### `ui.alignItems`: String

Options: `stretch`, `flex-start`, `flex-end`, `center`, `baseline`.
Defaults to `stretch`.

### `ui.alignContent`: String

Options: `flex-start`, `flex-end`, `stretch`, `center`, `space-between`, `space-around`, `space-evenly`.
Defaults to `flex-start`.

### `ui.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

### Additional Properties

### `ui.res`: Number

Resolution multiplier for the UI canvas. Higher values result in sharper text but use more memory. Defaults to `2`.

### `ui.transparent`: Boolean

Whether the UI material should be transparent. Defaults to `true`.

### Notes

- Cannot be nested inside another UI node
- Uses Yoga for flexbox layout
- Automatically handles resolution scaling
- Supports billboarding for camera-facing UI
- Supports hit detection for interaction
- Uses canvas for rendering
