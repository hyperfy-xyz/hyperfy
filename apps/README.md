# Local Apps Development

This directory contains locally developed apps that can be loaded into the game engine without using the in-browser editor.

## Creating a New App

1. Create a new directory in `/apps` with your app name (e.g., `my-app`)
2. Add a `manifest.json` file with the following structure:

```json
{
  "name": "My App",
  "description": "Description of your app",
  "model": "model.glb",  // optional - path to 3D model file
  "script": "script.js"  // optional - path to script file
}
```

3. Add your app files:
   - `script.js` - Your app's JavaScript code
   - `model.glb` - Your app's 3D model (optional)
   - Any other assets your app needs