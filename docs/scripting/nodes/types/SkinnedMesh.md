# SkinnedMesh

Represents a skinned mesh with bones and animations.

NOTE: Skinned meshes are not automatically instanced in the engine like regular meshes

## Properties

### `.anims`: Array

An array of animation names available. Read-only.

### `.castShadow`: Boolean

Whether this skinned mesh should cast a shadow. Defaults to `true`.

### `.receiveShadow`: Boolean

Whether this skinned mesh should receive a shadow. Defaults to `true`.

### `.{...Node}`

Inherits all [Node](/docs/scripting/nodes/Node.md) properties

## Methods

### `.play({ name: String, fade: Number, loop: Boolean, speed: Number })`

Plays an animation. 
If a previous animation was playing it will stop/fade.

**name**: The name of the animation to play

**fade**: The fade time in seconds, into this animation and out of any previous animation. Defaults to `0.15`

**loop**: Whether the animation should loop. When `false`, will stop on the last frame. Defaults to `true`

**speed**: The speed to play the animation at.

### `.stop({ fade: Number })`

Stops any playing animation. Fade defaults to `0.15`

### `.getBone(boneName)`: Bone

Returns a bone with properties `position`, `quaternion`, `rotation`, `scale` and `matrixWorld`.