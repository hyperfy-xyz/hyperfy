# UIIframe

Represents an iframe element inside a UI, allowing you to embed web content.

```jsx
const iframe = app.create('uiiframe')
iframe.src = 'https://www.youtube.com/embed/VIDEO_ID'
```

## Properties

### `.display`: String

Either `none` or `flex`. 
Defaults to `flex`.

### `.backgroundColor`: String

The background color of the iframe container. 
Can be hex (eg `#000000`) or rgba (eg `rgba(0, 0, 0, 0.5)`).
Defaults to `null`.

### `.borderRadius`: Number

The radius of the border in pixels.
Defaults to `0`.

### `.margin`: Number

The outer margin of the iframe in pixels.
Defaults to `0`.

### `.padding`: Number

The inner padding of the iframe in pixels.
Defaults to `0`.

### `.src`: String

The URL source of the iframe content.
Defaults to `null`.

### `.width`: Number

The width of the iframe in pixels.
Defaults to `null`.

### `.height`: Number

The height of the iframe in pixels.
Defaults to `null`.

### `.sandbox`: String

The sandbox attribute for the iframe.
Defaults to `'allow-scripts allow-same-origin'`.

### `.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties 