# Joint

The Joint component in Hyperfy creates physical connections between rigid bodies, allowing for various types of constrained movement and interactions. It supports different joint types including fixed, socket (ball), hinge (revolute), and distance joints.

### Inheritance

Joint inherits all properties and methods from [Node](/docs/ref/Node.md).

### Properties

### `joint.type`: String

The type of joint connection. Default is 'fixed'.
Possible values:
- `'fixed'`: Rigidly connects two bodies with no relative movement
- `'socket'`: Ball-and-socket joint allowing rotational movement
- `'hinge'`: Revolute joint allowing rotation around a single axis
- `'distance'`: Maintains a distance range between connection points

### `joint.body0`: RigidBody | null

The first rigid body in the joint connection. This is the "parent" or anchor body.

### `joint.body1`: RigidBody | null

The second rigid body in the joint connection. This is the "child" or connected body.

### `joint.breakForce`: Number

The force required to break the joint connection. Default is Infinity.

### `joint.breakTorque`: Number

The torque required to break the joint connection. Default is Infinity.

### `joint.axis`: Vector3

The primary axis of rotation for hinge joints. Default is (0, 1, 0) (up).

### `joint.offset0`: Vector3

The local offset position of the joint relative to body0.

### `joint.offset1`: Vector3

The local offset position of the joint relative to body1.

### `joint.quaternion0`: Quaternion

The local rotation of the joint relative to body0.

### `joint.quaternion1`: Quaternion

The local rotation of the joint relative to body1.

### `joint.rotation0`: Euler

The local euler rotation of the joint relative to body0 (YXZ order).

### `joint.rotation1`: Euler

The local euler rotation of the joint relative to body1 (YXZ order).

### Socket Joint Properties

### `joint.limitY`: Number | null

The Y-axis cone limit for socket joints in degrees.

### `joint.limitZ`: Number | null

The Z-axis cone limit for socket joints in degrees.

### Hinge/Distance Joint Properties

### `joint.limitMin`: Number | null

The minimum angle (hinge) or distance (distance) limit.

### `joint.limitMax`: Number | null

The maximum angle (hinge) or distance (distance) limit.

### Spring Properties

### `joint.limitStiffness`: Number | null

The spring stiffness for joint limits.

### `joint.limitDamping`: Number | null

The spring damping for joint limits.

### Other Properties

### `joint.collide`: Boolean

Whether the connected bodies should collide with each other. Default is false.

### Notes

- At least one body must be specified (body0 or body1)
- Joint limits and springs can be used to create soft constraints
- Breaking forces can be used to create destructible connections
- Different joint types have different constraint behaviors and limit properties
- Changes to joint properties require rebuilding the joint

### Usage

Joints are used to:

1. Create mechanical connections between rigid bodies
2. Build complex physics-based mechanisms
3. Create breakable connections
4. Constrain movement in specific ways

### Example

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Create a hinge door example
      
      // Create the door frame
      const frame = app.create('RigidBody')
      frame.type = 'static'
      const frameCollider = app.create('Collider')
      frameCollider.type = 'box'
      frameCollider.setSize(0.1, 2, 0.1)
      frame.add(frameCollider)
      frame.position.set(1, 1, 0)
      
      // Create the door
      const door = app.create('RigidBody')
      door.type = 'dynamic'
      const doorCollider = app.create('Collider')
      doorCollider.type = 'box'
      doorCollider.setSize(1, 2, 0.1)
      door.add(doorCollider)
      door.position.set(1.5, 1, 0)
      
      // Create the hinge joint
      const hinge = app.create('Joint')
      hinge.type = 'hinge'
      hinge.body0 = frame
      hinge.body1 = door
      
      // Set the hinge axis to vertical (Y-axis)
      hinge.axis.set(0, 1, 0)
      
      // Add joint limits to prevent the door from swinging 360 degrees
      hinge.limitMin = -90  // -90 degrees
      hinge.limitMax = 90   // 90 degrees
      
      // Add some spring resistance
      hinge.limitStiffness = 100
      hinge.limitDamping = 10
      
      // Add everything to the scene
      app.add(frame)
      app.add(door)
      app.add(hinge)
    }
  }
}

// Example with a chain of distance joints
export default function(world, app, fetch) {
  return {
    start() {
      const chainLinks = []
      const numLinks = 10
      
      // Create chain links
      for (let i = 0; i < numLinks; i++) {
        const link = app.create('RigidBody')
        link.type = 'dynamic'
        
        const linkCollider = app.create('Collider')
        linkCollider.type = 'box'
        linkCollider.setSize(0.2, 0.1, 0.1)
        link.add(linkCollider)
        
        // Position links vertically
        link.position.set(0, 3 - i * 0.2, 0)
        
        chainLinks.push(link)
        app.add(link)
        
        // Connect links with distance joints
        if (i > 0) {
          const joint = app.create('Joint')
          joint.type = 'distance'
          joint.body0 = chainLinks[i - 1]
          joint.body1 = link
          
          // Set distance constraints
          joint.limitMin = 0.15  // Minimum distance between links
          joint.limitMax = 0.25  // Maximum distance between links
          
          // Add some springiness
          joint.limitStiffness = 200
          joint.limitDamping = 10
          
          // Allow links to collide
          joint.collide = true
          
          // Set break force for chain breaking effect
          joint.breakForce = 1000
          
          app.add(joint)
        }
      }
      
      // Anchor the first link
      chainLinks[0].type = 'static'
    }
  }
}
```

This example demonstrates creating both a hinged door and a chain using different joint types. The door uses a hinge joint with angle limits and spring properties, while the chain uses distance joints with length constraints and break forces.

Remember that joints can significantly impact physics performance, so use them judiciously and consider using fixed joints where possible as they are more computationally efficient.
