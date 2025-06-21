# Scripts

## IMPORTANT

As Hyperfy is in alpha, the scripting API is likely to evolve fast with breaking changes.
This means your apps can and will break as you upgrade worlds.
Once scripting is stable we'll move toward a forward compatible model, which will allow apps to be shared/traded with more confidence that they will continue to run correctly.

## Lifecycle

TODO: explain the app lifecycle across client and server

## Globals

Apps run inside their own secure environment with a strict API that allows apps built by many different authors to co-exist in a real-time digital world.

Just as websites run inside a DOM-based environment that provides browser APIs via globals, Apps run inside an app-based environment that provides app specific APIs by way of its own set of globals.

- [app](/docs/ref/App.md)
- [world](/docs/ref/World.md)
- [props](/docs/ref/Props.md)
- [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [num](/docs/ref/num.md)
- [Vector3](https://threejs.org/docs/#api/en/math/Vector3)
- [Quaternion](https://threejs.org/docs/#api/en/math/Quaternion)
- [Euler](https://threejs.org/docs/#api/en/math/Euler)
- [Matrix4](https://threejs.org/docs/#api/en/math/Matrix4)

## Nodes

Apps are made up of a hierarchy of nodes that you can view and modify within the app runtime using scripts.

The gltf model that each app is based on is automatically converted into nodes and inserted into the app runtime for you to interact with.

Some nodes can also be created and used on the fly using `app.create(nodeName)`.

- [Group](/docs/ref/Group.md)
- [Mesh](/docs/ref/Mesh.md)
- [LOD](/docs/ref/LOD.md)
- [Avatar](/docs/ref/Avatar.md)
- [Action](/docs/ref/Action.md)
- [Controller](/docs/ref/Controller.md)
- [RigidBody](/docs/ref/RigidBody.md)
- [Collider](/docs/ref/Collider.md)
- [Joint](/docs/ref/Joint.md)

## Creating Primitives

Hyperfy provides convenient methods to create primitive meshes directly from scripts without needing to load external models.

### Basic Usage

```js
// Create a box
const cube = world.box({ width: 1, height: 1, depth: 1 })
cube.position.set(0, 0.5, -2)
cube.material.color = 'red'

// Create a sphere
const sphere = world.sphere({ radius: 0.5 })
sphere.position.set(2, 0.5, -2)
sphere.material.color = 'blue'

// Create a cylinder
const cylinder = world.cylinder({ 
  radiusTop: 0.3, 
  radiusBottom: 0.5, 
  height: 1.5,
  radialSegments: 8 
})
cylinder.position.set(-2, 0.75, -2)
cylinder.material.color = 'green'

// Create a cone
const cone = world.cone({ 
  radius: 0.5, 
  height: 1, 
  radialSegments: 8 
})
cone.position.set(0, 0.5, -4)
cone.material.color = 'yellow'
```

### Generic Method

You can also use the generic `spawnMesh` method:

```js
const mesh = world.spawnMesh({ 
  type: 'sphere',  // 'box', 'sphere', 'cylinder', or 'cone'
  radius: 0.5      // plus any type-specific parameters
})
```

### Parameters

- **Box**: `width`, `height`, `depth`
- **Sphere**: `radius`
- **Cylinder**: `radiusTop`, `radiusBottom`, `height`, `radialSegments`
- **Cone**: `radius`, `height`, `radialSegments`

### Notes

- Meshes created this way are lightweight instanced objects
- They obey normal physics and ray-cast rules
- They use the default unlit material which can be modified via the material proxy
- Remember to remove primitives when no longer needed: `world.remove(mesh)`