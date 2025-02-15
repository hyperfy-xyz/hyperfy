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