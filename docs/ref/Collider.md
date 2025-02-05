# Collider

A collider connects to its parent rigidbody to simulate under physics.

NOTE: Setting/modifying the geometry are not currently supported, and only be configured within a GLTF (eg via blender).

## Properties

### `.type`: String

The type of collider, must be `box`, `sphere` or `geometry`. Defaults to `box`.

### `.setSize(width, height, depth)`

When type is `box`, sets the size of the box. Defaults to `1, 1, 1`.

### `.radius`: Number

When type is `sphere`, sets the radius of the sphere. Defaults to `0.5`.

### `.convex`: Boolean

Whether the geometry should be considered "convex". If disabled, the mesh will act as a trimesh. Defaults to `false`

Convex meshes are not only more performant, but also allow two convex dynamic rigidbodies to collide. This is the same behavior that engines like Unity use.

### `.trigger`: Boolean

Whether the collider is a trigger. Defaults to `false`.

A trigger will not collide with anything, and instead will trigger the `onTriggerEnter` and `onTriggerLeave` functions on the parent rigidbody.

NOTE: Triggers are forced to act like convex shapes. This is a limitation in the physics engine.

### `.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

