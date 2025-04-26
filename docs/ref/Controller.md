# Controller

A capsule controller that can be used to easily build moving characters, npcs, pets, mounts etc.

## Properties

### `.radius`: Number

The radius of the capsule. Defaults to `0.3` which is the same as the player capsule.

### `.height`: Number

The height of the mid section of the capsule. Defaults to `1` which is also the same as the player capsule.

### `.layer`: String

The physics layer for this controller. This determines what the controller collides with. Can be `environment` or `prop` or `tool`. Defaults to `environment`.

### `.tag`: String

A tag that can be seen by raycast, trigger and contact events.

### `.onContactStart`: Function

A function that is called whenever another physics object comes in contact with this controller.

### `.onContactEnd`: Function

A function that is called whenever another physics object ends contact with this controller.

### `.isGrounded`: Boolean

A read-only property describing whether the controller is standing on something.

### `.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

## Methods

### `.move(vec3)`

The primary utility of a controller. Will move the controller in the direction and magnitude specified, but will also slide against walls etc.

Note that controllers do not have gravity by default, but you can simulate this by setting vec3.y = -9.81 for example.

### `.teleport(vec3)` 

Teleports the controller to a new position.




