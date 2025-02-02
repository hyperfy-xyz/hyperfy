# Sky

The Sky component in Hyperfy manages the sky appearance and environmental lighting in the virtual world. It provides control over background images, HDR environment maps, and sun lighting properties.

### Inheritance

Sky inherits all properties and methods from [Node](/docs/ref/Node.md).

### Properties

### `sky.bg`: String | null

The background image URL or color value. Can be:
- A URL to an image file
- A CSS color string (e.g., '#ff0000' or 'rgba(255, 0, 0, 0.5)')
- `null` to use the default background

### `sky.hdr`: String | null

The URL of an HDR (High Dynamic Range) environment map for image-based lighting. Set to `null` to use the default environment lighting.

### `sky.sunDirection`: Vector3 | null

The direction of the sun light. This affects shadows and lighting in the scene. Set to `null` to use the default sun direction.

### `sky.sunIntensity`: Number | null

The intensity of the sun light. Higher values create stronger lighting and shadows. Set to `null` to use the default intensity.

### Methods

### `sky.mount(): void`

Internal method called when the sky is added to the scene. Creates the necessary environment resources.

### `sky.unmount(): void`

Internal method called when the sky is removed from the scene. Cleans up environment resources.

### `sky.commit(didMove: Boolean): void`

Internal method called when the sky's properties have changed and need to be updated.

### Notes

- Changes to sky properties trigger an automatic rebuild of the environment
- The sky component affects the entire scene's lighting and reflections
- HDR environment maps provide high-quality image-based lighting
- Default values for sky properties are defined in the ClientEnvironment system

### Usage

The Sky component is used to:

1. Set the scene's background
2. Configure environmental lighting
3. Control sun direction and intensity
4. Create realistic reflections using HDR maps

### Example

```javascript
export default function(world, app, fetch) {
  return {
    async start() {
      // Create a sky with custom settings
      const sky = app.create('Sky')
      
      // Set a solid color background
      sky.bg = '#87CEEB'  // Sky blue
      
      // Load an HDR environment map
      sky.hdr = 'asset://day2.hdr'
      
      // Set sun direction (morning sun)
      sky.sunDirection = new THREE.Vector3(-1, 0.5, -1).normalize()
      
      // Set sun intensity
      sky.sunIntensity = 2.0
      
      // Add the sky to the scene
      app.add(sky)
      
      // Later, you can update properties
      this.sky = sky
    },
    
    update(dt) {
      // Example: Animate sun direction for day/night cycle
      if (this.sky) {
        const time = world.time * 0.1
        this.sky.sunDirection = new THREE.Vector3(
          Math.cos(time),
          Math.abs(Math.sin(time)),  // Keep sun above horizon
          Math.sin(time)
        ).normalize()
        
        // Adjust intensity based on sun height
        this.sky.sunIntensity = 0.5 + Math.abs(Math.sin(time)) * 1.5
      }
    }
  }
}

// Example with dynamic sky changes
export default function(world, app, fetch) {
  return {
    start() {
      const sky = app.create('Sky')
      app.add(sky)
      
      // Create weather states
      const weatherStates = {
        clear: {
          bg: '#87CEEB',
          hdr: 'asset://day2.hdr',
          sunIntensity: 2.0
        },
        stormy: {
          bg: '#4A5D6B',
          hdr: 'asset://storm.hdr',
          sunIntensity: 0.5
        },
        sunset: {
          bg: '#FF7F50',
          hdr: 'asset://dusk3.hdr',
          sunIntensity: 1.0
        }
      }
      
      // Function to change weather
      this.setWeather = (state) => {
        const settings = weatherStates[state]
        if (settings) {
          sky.bg = settings.bg
          sky.hdr = settings.hdr
          sky.sunIntensity = settings.sunIntensity
        }
      }
      
      // Start with clear weather
      this.setWeather('clear')
    }
  }
}
```

This example demonstrates creating a sky with custom settings and shows how to create dynamic environmental effects like a day/night cycle or weather system.

Remember that changes to sky properties can be performance-intensive, so avoid updating them too frequently. For smooth transitions, consider interpolating values over time.
