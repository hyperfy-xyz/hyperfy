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

### `.hasEffect()`: Boolean

Whether the player currently has an active effect.

### `.setEffect({ anchor, emote, snare, freeze, duration, cancellable })`

Sets an effect on the player. If the player already had an effect, it is replaced. If this function is called with `null` it removes any active effect.

All options are optional.

**anchor**: an [Anchor](/docs/ref/Anchor.md) to attach the player to
**emote**: a url to an emote to play while this effect is active
**snare**: a multiplier from 0 to 1 that reduces movement speed, where zero means no snaring and one means entirely snared. when snared, players can still turn and attempt to move.
**freeze**: when true, the player is frozen in place and all movement keys are ignored.
**duration**: how long this effect should last in seconds.
**cancellable**: whether any movement keys will cancel the effect. if enabled, freeze is ignored.
