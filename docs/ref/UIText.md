# UIText

Represents text inside a UI.

```jsx
const text = app.create('uitext')
text.value = 'Hello world'
```

## Properties

### `.display`: String

Either `none` or `flex`. 
Defaults to `flex`.

### `.backgroundColor`: String

The background color of the view. 
Can be hex (eg `#000000`) or rgba (eg `rgba(0, 0, 0, 0.5)`).
Defaults to `null`.

### `.borderRadius`: Number

The radius of the border in pixels.

### `.margin`: Number

The outer margin of the view in pixels.
Defaults to `0`.

### `.padding`: Number

The inner padding of the view in pixels.
Defaults to `0`.

### `.value`: String

The text to display.

### `.fontSize`: Number

The font size in pixels.
Defauls to `16`.

### `.color`: Number

The font color.
Defauls to `#000000`.

### `.lineHeight`: Number

The line height.
Defaults to `1.2`.

### `.textAlign`: String

Options: `left`, `center`, `right`.
Defaults to `left`.

### `.fontFamily`: String

Defaults to `Rubik`.

### `.fontWeight`: Number

Defaults to `normal`, can also be a number like `100` or string like `bold`.

### `.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

