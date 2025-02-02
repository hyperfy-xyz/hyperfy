# UIText

Represents text inside a UI.

```jsx
const text = app.create('uitext')
text.value = 'Hello world'
```

### `uitext.display`: String

Either `none` or `flex`. 
Defaults to `flex`.

### `uitext.value`: String

The text to display.

### `uitext.fontSize`: Number

The font size in pixels.
Defaults to `16`.

### `uitext.color`: String

The font color.
Defaults to `#000000`.

### `uitext.lineHeight`: Number

The line height.
Defaults to `1.2`.

### `uitext.textAlign`: String

Options: `left`, `center`, `right`.
Defaults to `left`.

### `uitext.fontFamily`: String

Defaults to `Rubik`.

### `uitext.fontWeight`: String | Number

Defaults to `normal`, can also be a number like `100` or string like `bold`.

### `uitext.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

### Notes

- Must be a child of a UI node
- Automatically wraps text to fit width
- Supports font weight variations
- Handles text measurement and layout
- Updates automatically when properties change
- Uses canvas for text rendering
