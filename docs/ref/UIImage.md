# UIImage

Represents an image inside a UI, similar to an img tag in HTML.

```jsx
const image = app.create('uiimage', {
  src: 'https://example.com/image.png',
  width: 200,
  height: 150,
  objectFit: 'cover',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  borderRadius: 10
});
```

## Properties

### `.display`: String

Determines whether the image is displayed or hidden. Options are flex or none.
Defaults to flex.


### `.src`: String

The URL of the image to display.
Defaults to null.

### `.height`: Number

The height of the image in pixels.
Defaults to null (image’s natural height).

### `.objectFit`: String

How the image should fit within its container. Options are contain, cover, or fill.
Defaults to contain.

### `.backgroundColor`: String

The radius of the border in pixels.
Defaults to 0.

### `.flexDirection`: String

The flex direction for the image container. Options are column, column-reverse, row, or row-reverse.
Inherits from parent UI node by default.

### `.justifyContent`: String

Options: flex-start, flex-end, center.
Inherits from parent UI node by default.

### `.alignItems`: String

Options: flex-start, flex-end, stretch, center, space-between, space-around, space-evenly.
Inherits from parent UI node by default.

### `.flexWrap`: String

Options: no-wrap, wrap.
Inherits from parent UI node by default.

### `.gap`: Number

The gap between child elements in pixels.
Inherits from parent UI node by default.

### `.margin`: Number

The outer margin of the image container in pixels.
Defaults to 0.

### `.padding`: Number

The inner padding of the image container in pixels.
Defaults to 0.

### `.borderWidth`: Number

The width of the border in pixels.
Defaults to 0.

### `.borderColor`: String

The color of the border.
Can be hex (e.g., #000000) or rgba (e.g., rgba(0, 0, 0, 0.5)).
Defaults to null.

---

## Methods

### `.loadImage(src)`: Promise

Loads an image from the specified URL. Returns a promise that resolves when the image is loaded or rejects if loading fails.

```jsx
image.src = 'https://example.com/new-image.png';
```

## Example Usage

Here’s an example of creating a responsive UI with an image that covers its container:

```jsx
// Create a UI node
const ui = app.create('ui', {
  space: 'screen',
  position: [0, 1, 0],
  width: 300,
  height: 200,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  pivot: 'top-left'
});

// Create an image element
const image = app.create('uiimage', {
  src: 'https://example.com/image.png',
  width: 300,
  height: 200,
  objectFit: 'cover',
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  borderRadius: 10
});

// Add the image to the UI node
ui.add(image);
```

In this example:

- The image is positioned at the top-left of the screen.
- The image covers its container while maintaining its aspect ratio.
- The container has a semi-transparent white background with rounded corners.

You can also make the image configurable using app.configure to allow users to change properties like the source URL or dimensions.

```jsx
// Configure the app with a file input for images
app.configure([
  {
    type: 'file',
    key: 'selectedImage',
    label: 'Upload Image',
    kind: 'image' // Specify the kind as 'image' to restrict file types
  }
]);

// Create the image element using the selected file
const image = app.create('uiimage', {
  src: props.selectedImage?.url, // Use the URL of the selected image
  width: 300,
  height: 200,
  objectFit: 'cover',
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  borderRadius: 10
});
```
