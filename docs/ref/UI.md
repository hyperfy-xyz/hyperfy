# UI

Displays a UI plane in-world

```jsx
const ui = app.create('ui')
ui.backgroundColor = 'rgba(0, 0, 0, 0.5)'
```

## Properties

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

Makes the UI face the camera. Can be `null`, `full` or `y-axis`. Default to `null`.

### `.pivot`: String

Determines where the "center" of the UI is.
Options are: `top-left`, `top-center`, `top-right`, `center-left`, `center`, `center-right`, `bottom-left`, `bottom-center`, `bottom-right`.
Defaults to `center`.

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

