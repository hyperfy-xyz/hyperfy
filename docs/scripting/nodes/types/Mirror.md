# Mirror

Creates a reflective surface that renders real-time reflections, including the local player avatar even when in first-person mode.

## Properties

### `.width`: Number

The width of the mirror surface. Defaults to `2`.

### `.height`: Number

The height of the mirror surface. Defaults to `2`.

### `.tint`: String

A color tint applied to the reflection. This can be used to create colored mirrors or adjust the reflection's appearance. Defaults to `#ffffff` (white/no tint).

### `.textureWidth`: Number

The width of the render texture used for reflections. Higher values provide better quality but impact performance. Defaults to `512`.

### `.textureHeight`: Number

The height of the render texture used for reflections. Higher values provide better quality but impact performance. Defaults to `512`.

### `.{...Node}`

Inherits all [Node](/docs/scripting/nodes/Node.md) properties

## Example

```javascript
// Create a basic mirror
const mirror = app.create('mirror', {
  width: 4,
  height: 3,
  position: [0, 1.5, -5],
})
app.add(mirror)
```

## Notes

- For performance, consider using lower texture resolutions for smaller or distant mirrors