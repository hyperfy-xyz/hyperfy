# UIImage

The UIImage component in Hyperfy is used to display images within UI layouts. It provides flexible image display options with support for different sizing and fitting modes.

### Inheritance

UIImage inherits all properties and methods from [Node](/docs/ref/Node.md).

### Properties

### `uiImage.display`: String

The display mode for the image container. Default is 'flex'.
- Possible values: 'flex', 'none'

### `uiImage.src`: String | null

The URL of the image to display. Set to `null` to clear the image.

### `uiImage.width`: Number | null

The width of the image in pixels. If `null`, the width will be determined by the image's natural size or container constraints.

### `uiImage.height`: Number | null

The height of the image in pixels. If `null`, the height will be determined by the image's natural size or container constraints.

### `uiImage.objectFit`: String

Determines how the image should be resized to fit its container. Default is 'contain'.
- `'contain'`: Scale the image to fit within the container while maintaining aspect ratio
- `'cover'`: Scale the image to cover the entire container while maintaining aspect ratio
- `'fill'`: Stretch the image to fill the container, potentially distorting it

### `uiImage.backgroundColor`: String | null

The background color of the image container. Can be any valid CSS color string. Set to `null` for no background.

### Methods

### `uiImage.loadImage(src: String): Promise<HTMLImageElement>`

Loads an image from the specified URL.

Parameters:
- `src`: The URL of the image to load

Returns:
- A Promise that resolves with the loaded image element

### Notes

- UIImage must be a child of a [UI](/docs/ref/UI.md) component
- Images are automatically scaled and positioned based on their `objectFit` property
- The component uses the Yoga layout engine for flexible positioning within UI layouts
- Images are loaded asynchronously and the component will update when loading completes
- Cross-origin images are supported with automatic handling of CORS headers

### Usage

UIImage components are used to:

1. Display images within UI layouts
2. Create responsive image layouts
3. Implement image-based UI elements like icons or backgrounds
4. Create complex UI layouts with mixed text and images

### Example

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Create a UI container
      const container = app.create('UI')
      container.width = 500
      container.height = 400
      container.backgroundColor = 'rgba(0, 0, 0, 0.5)'
      container.padding = 20
      
      // Create an image that maintains aspect ratio
      const profileImage = app.create('UIImage')
      profileImage.src = 'asset://profile.jpg'
      profileImage.width = 150
      profileImage.height = 150
      profileImage.objectFit = 'cover'
      profileImage.backgroundColor = '#ffffff'
      container.add(profileImage)
      
      // Create a banner image that fills its container
      const bannerImage = app.create('UIImage')
      bannerImage.src = 'asset://banner.jpg'
      bannerImage.width = 460  // Container width - padding
      bannerImage.height = 100
      bannerImage.objectFit = 'fill'
      container.add(bannerImage)
      
      // Create a responsive gallery layout
      const gallery = app.create('UIView')
      gallery.flexDirection = 'row'
      gallery.flexWrap = 'wrap'
      gallery.gap = 10
      
      // Add multiple thumbnail images
      const thumbnails = [
        'asset://thumb1.jpg',
        'asset://thumb2.jpg',
        'asset://thumb3.jpg'
      ]
      
      thumbnails.forEach(src => {
        const thumb = app.create('UIImage')
        thumb.src = src
        thumb.width = 100
        thumb.height = 100
        thumb.objectFit = 'cover'
        thumb.backgroundColor = '#333333'
        
        // Add hover effect
        thumb.onPointerEnter = () => {
          thumb.scale.set(1.1, 1.1, 1)
        }
        
        thumb.onPointerLeave = () => {
          thumb.scale.set(1, 1, 1)
        }
        
        // Add click handler
        thumb.onPointerDown = () => {
          console.log('Thumbnail clicked:', src)
        }
        
        gallery.add(thumb)
      })
      
      container.add(gallery)
      app.add(container)
    }
  }
}

// Example with dynamic image loading and error handling
export default function(world, app, fetch) {
  return {
    async start() {
      const imageViewer = app.create('UI')
      imageViewer.width = 300
      imageViewer.height = 300
      
      const image = app.create('UIImage')
      image.backgroundColor = '#222222'
      image.objectFit = 'contain'
      
      // Function to load and display an image
      this.loadImage = async (url) => {
        try {
          image.src = url
          // The image will automatically load and display
        } catch (error) {
          console.error('Failed to load image:', error)
          // Set a fallback image
          image.src = 'asset://error-placeholder.jpg'
        }
      }
      
      imageViewer.add(image)
      app.add(imageViewer)
      
      // Load initial image
      await this.loadImage('asset://initial-image.jpg')
    }
  }
}
```

This example demonstrates various ways to use UIImage components, including:
- Basic image display with different fitting modes
- Creating responsive layouts with multiple images
- Adding interactivity with hover effects and click handlers
- Handling image loading and errors
- Creating image galleries and viewers

Remember to handle image loading errors appropriately and provide fallback content when needed. Also, consider the performance implications when working with many images or large image files.
