# Mesh

Represents a mesh to be rendered. 
Internally the mesh is automatically instanced for performance.

NOTE: Setting/modifying the geometry or materials are not currently supported, and only be configured within a GLTF (eg via blender).

### `mesh.castShadow`: Boolean

Whether this mesh should cast a shadow. Defaults to `true`.

### `mesh.receiveShadow`: Boolean

Whether this mesh should receive a shadow. Defaults to `true`.

### `mesh.visible`: Boolean

Whether the mesh is visible and rendered. Defaults to `true`.

### `mesh.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

### Additional Properties

### `mesh.type`: String

The type of mesh. Must be one of: `'box'`, `'sphere'`, or `'geometry'`. Defaults to `'box'`.

### `mesh.setSize(width, height, depth)`

When type is `'box'`, sets the size of the box. Default size is `1, 1, 1`.

### `mesh.radius`: Number

When type is `'sphere'`, sets the radius of the sphere. Defaults to `0.5`.

### `mesh.linked`: Boolean

Whether the mesh is linked to its parent's transform. Defaults to `true`.

### Notes

- Box meshes are automatically instanced for performance
- Sphere meshes use 16 width segments and 12 height segments
- Geometry meshes must be provided via GLTF models
- Material modifications are currently not supported
