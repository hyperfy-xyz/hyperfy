# Image

Renders an image in the world on a surface.

## Properties

### `.src`: String

A url to an image file, or an asset url from an image prop.

Supported: png, jpeg, jpg, webp

### `.width`: Number|null

The width of the surface. When set to `null` it will adapt to the aspect ratio of the image and the specified `height`. Defaults to `null`.

### `.height`: Number|null

The height of the surface. When set to `null` it will adapt to the aspect ratio of the image and the specified `width`. Defaults to `null`.

### `.fit`: Enum("none", "contain", "cover")

The resize strategy for fitting the image onto its surface. `contain` will shrink the image until it is entirely visible. `cover` will expand the image until it covers the entire surface. `none` will apply no logic and stretch to fit the size.

Defaults to `contain`.

### `.color`: String

The color of the 'outside' areas of the surface where the image isn't drawn. Can also be set to `transparent` to support transparent images. Defaults to `black`.

### `.pivot`: String

The pivot point of the surface.

Available options: `top-left`, `top-center`, `top-right`, `center-left`, `center`, `center-right`, `bottom-left`, `bottom-center`, `bottom-right`.

Defaults to `center`.

### `.lit`: Boolean

Whether the surface is lit (reacts to lighting) or not. Defaults to `false`.

### `.doubleside`: Boolean

Whether the surface should render the image on both sides. Defaults to `true`.

### `.castShadow`: Boolean

Whether the surface should cast a shadow. Defaults to `false`.

### `.receiveShadow`: Boolean

Whether the surface should receive shadows. Defaults to `false`.

### `.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

