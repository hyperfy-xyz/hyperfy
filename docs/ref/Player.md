# Player

Represents a player. An instance of Player can be retrived from events or via [World.getPlayer](/docs/ref/World.md)

NOTE: Setting/modifying the geometry are not currently supported, and only be configured within a GLTF (eg via blender).

## Properties

### `.networkId`: String

A completely unique ID that is given to every player each time they connect.

### `.entityId`: String

The entity's ID.

### `.id`: String

The player ID. This ID is the same each time the player enters the world.

### `.name`: String

The players name.

### `.position`: Vector3

The players position in the world.

### `.quaternion`: Quaternion

The players rotation in the world.

### `.rotation`: Euler

The players rotation in the world.

## Methods

### `.teleport(position, rotationY)`

Teleports the player instantly to the new position. The `rotationY` value is in radians, and if omitted the player will continue facing their current direction.    

### `.getBoneTransform(boneName)`: Matrix4

Returns a matrix of the bone transform in world space.

See [Avatar](/docs/ref/Avatar.md) for full details.

