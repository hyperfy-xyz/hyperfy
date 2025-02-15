# Mesh

Represents a mesh to be rendered. 
Internally the mesh is automatically instanced for performance.

NOTE: Setting/modifying the geometry or materials are not currently supported, and only be configured within a GLTF (eg via blender).

## Properties

### `.castShadow`: Boolean

Whether this mesh should cast a shadow. Defaults to `true`.

### `.receiveShadow`: Boolean

Whether this mesh should receive a shadow. Defaults to `true`.

### `.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

