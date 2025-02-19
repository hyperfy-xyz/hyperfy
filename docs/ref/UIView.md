# UIView

Represents a single view inside a UI, similar to a `div`.

```jsx
const view = app.create('uiview')
view.backgroundColor = 'rgba(0, 0, 0, 0.5)'
```

## Properties

### `.display`: String

Either `none` or `flex`. 
Defaults to `flex`.

### `.width`: Number

The width of the view in pixels. Defaults to `100`.

### `.height`: Number

The height of the view in pixels. Defaults to `100`.

### `.backgroundColor`: String

The background color of the view. 
Can be hex (eg `#000000`) or rgba (eg `rgba(0, 0, 0, 0.5)`).
Defaults to `null`.

### `.borderWidth`: Number

The width of the border in pixels.

### `.borderColor`: String

The color of the border.

### `.borderRadius`: Number

The radius of the border in pixels.

### `.margin`: Number

The outer margin of the view in pixels.
Defaults to `0`.

### `.padding`: Number

The inner padding of the view in pixels.
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

### `.flexBasis`: Number

Defaults to `null`.

### `.flexGrow`: Number

Defaults to `null`.

### `.flexShrink`: Number

Defaults to `null`.

### `.flexWrap`: String

Options: `no-wrap`, `wrap`.
Defaults to `no-wrap`.

### `.gap`: Number

Defaults to `0`.

### `.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

