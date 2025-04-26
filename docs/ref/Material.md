# Material

A material on a [Mesh](/docs/ref/Mesh.md) node.

## Properties

### `.textureX`: Number

The offset of the texture on the `x` axis. Useful for UV scrolling.

### `.textureY`: Number

The offset of the texture on the `y` axis. Useful for UV scrolling.

### `.color`: String

The base color of the material. Can be set using any valid CSS color string (e.g. "red", "#ff0000", "rgb(255,0,0)").

### `.emissiveIntensity`: Number

The emissive intensity of the material. Values greater than `1` will activate HDR Bloom, as long as the emissive color is not black.