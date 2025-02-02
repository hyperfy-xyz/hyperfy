# Collider

A collider connects to its parent rigidbody to simulate under physics.

NOTE: Setting/modifying the geometry are not currently supported, and only be configured within a GLTF (eg via blender).

### `collider.type`: String

The type of collider, must be `box`, `sphere` or `geometry`. Defaults to `box`.

### `collider.setSize(width, height, depth)`

When type is `box`, sets the size of the box. Defaults to `1, 1, 1`.

### `collider.radius`: Number

When type is `sphere`, sets the radius of the sphere. Defaults to `0.5`.

### `collider.convex`: Boolean

Whether the geometry should be considered "convex". If disabled, the mesh will act as a trimesh. Defaults to `false`

Convex meshes are not only more performant, but also allow two convex dynamic rigidbodies to collide. This is the same behavior that engines like Unity use.

### `collider.trigger`: Boolean

Whether the collider is a trigger. Defaults to `false`.

A trigger will not collide with anything, and instead will trigger the `onTriggerEnter` and `onTriggerLeave` functions on the parent rigidbody.

### `collider.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

### Additional Properties

### `collider.layer`: String

The physics layer for the collider. Defaults to `'environment'`.

### `collider.staticFriction`: Number

The static friction coefficient. Defaults to `0.6`.

### `collider.dynamicFriction`: Number

The dynamic friction coefficient. Defaults to `0.6`.

### `collider.restitution`: Number

The restitution (bounciness) coefficient. Defaults to `0`.

### `collider.setMaterial(staticFriction, dynamicFriction, restitution)`

Sets the physics material properties for the collider.

Parameters:
- `staticFriction`: Static friction coefficient
- `dynamicFriction`: Dynamic friction coefficient
- `restitution`: Restitution coefficient
