# How to Use Primitive Spawning in Hyperfy Apps

## Important: Understanding the Architecture

Apps in Hyperfy typically have:
1. A **model** (GLB file) - The 3D content
2. A **script** (JS file) - The behavior/logic

For primitive spawning, you don't need a model file since primitives are created dynamically by the script.

## Method 1: Create an App with Empty/Minimal Model

1. Create a minimal GLB file (can be an empty scene or a single invisible object)
2. Create your script that spawns primitives
3. Drop the GLB file into the world to create the app
4. Add your script to the app

## Method 2: Use Console for Testing

You can test primitive spawning directly in the browser console:

```js
// Access the world object
const w = window.world

// Create a box
const box = w.box({ width: 1, height: 1, depth: 1 })
box.position.set(0, 1, -5)
box.material.color = 'red'

// Create a sphere
const sphere = w.sphere({ radius: 0.5 })
sphere.position.set(2, 1, -5)
sphere.material.color = 'blue'

// Remove them later
w.remove(box)
w.remove(sphere)
```

## Method 3: Modify an Existing App

1. Select an existing app in your world
2. Open the script editor
3. Replace or modify the script to include primitive spawning:

```js
export default {
  init() {
    // Your existing code...
    
    // Add primitive spawning
    const cube = world.box({ width: 0.5, height: 0.5, depth: 0.5 })
    cube.position.set(0, 1, 0)
    cube.material.color = 'yellow'
  }
}
```

## Common Issues

1. **"primitive" is not a valid model URL** - Don't set the app's model to "primitive", use a real GLB file
2. **Primitives not showing** - Make sure to set position, primitives spawn at origin (0,0,0) by default
3. **Memory leaks** - Always remove primitives in the `destroy()` method

## Example Script

See `example-primitive-app.js` for a complete working example that demonstrates all primitive types with animation.