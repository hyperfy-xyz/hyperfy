# Models

Dragging and dropping a `glb` model directly into a world will convert it into an "App" with no script or config attached to it.

For the purposes of these docs, we will assume you are using Blender to author 3D models and export them to GLTF-Binary (glb) files to use in your world.

## Naming Conventions

The names of your objects will be used as the ID's for nodes when using the scripting API.

It's recommended to use UpperCamelCase for all blender object names, as the GLTF exporter will replace things like spaces with other characters, making it harder to find your meshes/nodes when writing scripts in-world.

## Duplicate Linked

When using the same mesh multiple times inside a single model, be sure to use the Duplicate Linked (Option + D) option so that the objects share the same underlying mesh.

This not only reduces the file size of your model, but our engine is able to better optimize and automatically instance those meshes together in a single draw-call for huge performance.

## LODs

- TODO: lod node
- TODO: inserting lod children

## Collision

- TODO: rigidbody node
- TODO: collider node
- TODO: wireframe display