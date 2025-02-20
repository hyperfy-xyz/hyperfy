# Avatar

Renders a VRM avatar

```jsx
const src = props.avatar?.url
const emote = props.emote?.url
const avatar = app.create('avatar', { src, emote })
app.add(avatar)
```

## Properties

### `.src`: String

An asset url (eg from props) or an absolute URL to a `.vrm` file.

### `.emote`: String

An emote url (eg from props) or an absolute URL to a `.glb` file with an emote animation.

## Methods

### `.getHeight()`: Number

Returns the height of the avatar in meters. This might be `null` if the avatar hasn't loaded yet. Read-only. 

### `.getBoneTransform(boneName)`: Matrix4

Returns a matrix of the bone transform in world space.

```jsx
const matrix = avatar.getBoneTransform('rightHand')
weapon.position.setFromMatrixPosition(matrix)
weapon.quaternion.setFromRotationMatrix(matrix)
```

Note that VRM avatars have required and optional bones, and in some cases incuding while avatars are loading this method may return null.

The VRM spec defines the following bones as required:

```
hips, spine, chest, neck, head, leftShoulder, leftUpperArm, leftLowerArm, leftHand, rightShoulder, rightUpperArm, rightLowerArm, rightHand, leftUpperLeg, leftLowerLeg, leftFoot, leftToes, rightUpperLeg, rightLowerLeg, rightFoot, rightToes
```

### `.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

