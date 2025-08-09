# Player

Represents a player. An instance of Player can be retrived via [World.getPlayer](/docs/scripting/world/World.md)

## Properties

### `.id`: String

The players unique ID. This is always the same for the same player, even when they leave and come back.

### `.name`: String

The players name.

### `.local`: Boolean

Whether the player is local to this client.

### `.admin`: Boolean

Whether the player is an admin in this world.

### `.position`: Vector3

The players position in the world.

### `.quaternion`: Quaternion

The players rotation in the world.

### `.rotation`: Euler

The players rotation in the world.

## Methods

### `.teleport(position, rotationY)`

Teleports the player instantly to the new position. The `rotationY` value is in radians, and if omitted the player will continue facing their current direction.

### `.push(force)`

Applies a short, impulse-like push to the local player in world-space. Multiple pushes accumulate vectorially and decay over time with high drag.

- **force**: A direction/impulse vector. Accepts a `Vector3`.

Behavior:
- Adds the impulse to the player’s current push; subsequent calls add to the existing push rather than replacing it.
- Can only be called on a local player.

Example:
```js
// Dash forward relative to camera yaw
const FORWARD = new Vector3(0, 0, -1)
const euler = new Euler(0, 0, 0, 'YXZ')
const quat = new Quaternion()

euler.setFromQuaternion(world.getPlayer().quaternion)
euler.x = 0; euler.z = 0
quat.setFromEuler(euler)

const dir = FORWARD.clone().applyQuaternion(quat).normalize()
world.getPlayer().push(dir.multiplyScalar(30)) // short forward burst
```

### `.getBoneTransform(boneName)`: Matrix4

Returns a matrix of the bone transform in world space.

See [Avatar](/docs/scripting/nodes/types/Avatar.md) for full details.

### `.damage(amount)`

Removes health from the player. Health cannot go below zero.

### `.heal(amount)`

Adds health to the player. Health cannot go above 100.

### `.applyEffect({ anchor, emote, snare, freeze, turn, duration, cancellable, onEnd })`

Applies an effect to the player. If the player already has an effect, it is replaced. If this function is called with `null` it removes any active effect.

All options are optional.

**anchor**: an [Anchor](/docs/scripting/nodes/types/Anchor.md) to attach the player to

**emote**: a url to an emote to play while this effect is active

**snare**: a multiplier from 0 to 1 that reduces movement speed, where zero means no snaring and one means entirely snared. when snared, players can still turn and attempt to move.

**freeze**: when true, the player is frozen in place and all movement keys are ignored.

**turn**: when true, the player will continually face the direction the camera is looking in.

**duration**: how long this effect should last in seconds.

**cancellable**: whether any movement keys will cancel the effect. if enabled, freeze is ignored.

**onEnd**: a function that should be called either at the end of the `duration` or when the player moves if `cancellable`.

### `.screenshare(screenId)`

Can only be called on a local player.

Prompts the player to share their screen, and then casts it to all video nodes that have a matching `.screenId` property.

### `.setVoiceLevel(level)`

Overrides the players voice chat level to `disabled`, `spatial` or `global`.

By default all players have the voice level defined in the world settings menu, but `.setVoiceLevel` allows apps to override it using any logic needed.

Calling `player.setVoiceLevel(null)` removes the current apps override and reverting to the world setting (unless another app is overriding it).

**NOTE:** Changes stack with priority, so if two apps have set a voice level, the higher priority level takes precendence. Global is the highest priority.

Must be called on the server for security reasons.
