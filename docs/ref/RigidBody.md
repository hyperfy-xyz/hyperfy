# RigidBody

A rigidbody that has colliders as children will act under physics.

### `rigidbody.type`: String

The type of rigidbody, either `static`, `kinematic` or `dynamic`. Defaults to `static`.

NOTE: if you plan to move the rigidbody with code without being dynamic, use `kinematic` for performance reasons.

### `rigidbody.onContactStart`: Function (Experimental)

The function to call when a child collider generates contacts with another rigidbody.

### `rigidbody.onContactEnd`: Function (Experimental)

The function to call when a child collider ends contacts with another rigidbody.

### `rigidbody.onTriggerEnter`: Function (Experimental)

The function to call when a child trigger collider is entered.

### `rigidbody.onTriggerLeave`: Function (Experimental)

The function to call when a child trigger collider is left.

### `rigidbody.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

### Additional Properties

### `rigidbody.mass`: Number

The mass of the rigidbody. Only applies to dynamic and kinematic bodies. Defaults to `1`.

### `rigidbody.tag`: String

Optional tag to identify the rigidbody. Cannot use reserved tags like 'player'.

### `rigidbody.sleeping`: Boolean (Read-only)

Whether the rigidbody is currently sleeping (inactive due to lack of movement).

### Physics Methods

### `rigidbody.addForce(force: Vector3, mode?: Number)`

Adds a force to the rigidbody.

### `rigidbody.addTorque(torque: Vector3, mode?: Number)`

Adds a torque (rotational force) to the rigidbody.

### Transform Methods

### `rigidbody.getPosition(vec3?: Vector3): Vector3`

Gets the current world position. Optionally takes a Vector3 to store the result.

### `rigidbody.setPosition(vec3: Vector3)`

Sets the world position.

### `rigidbody.getQuaternion(quat?: Quaternion): Quaternion`

Gets the current world rotation. Optionally takes a Quaternion to store the result.

### `rigidbody.setQuaternion(quat: Quaternion)`

Sets the world rotation.

### Velocity Methods

### `rigidbody.getLinearVelocity(vec3?: Vector3): Vector3`

Gets the current linear velocity. Optionally takes a Vector3 to store the result.

### `rigidbody.setLinearVelocity(vec3: Vector3)`

Sets the linear velocity.

### `rigidbody.getAngularVelocity(vec3?: Vector3): Vector3`

Gets the current angular velocity. Optionally takes a Vector3 to store the result.

### `rigidbody.setAngularVelocity(vec3: Vector3)`

Sets the angular velocity.

### Kinematic Control

### `rigidbody.setKinematicTarget(position: Vector3, quaternion: Quaternion)`

Sets the target position and rotation for kinematic rigidbodies. Only works when type is 'kinematic'.

### Notes

- Static rigidbodies are immovable and best for level geometry
- Kinematic rigidbodies can be moved by code but don't respond to physics
- Dynamic rigidbodies fully participate in physics simulation
- Mass only affects dynamic and kinematic bodies
- Contact and trigger events are experimental features
