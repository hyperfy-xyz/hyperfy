# Node

The Node is the base class for all other nodes in Hyperfy. It provides fundamental properties and methods for positioning, rotating, and scaling objects in the 3D space.

### `node.id`: String

A unique identifier for the node. This is auto-generated when creating nodes via script. For GLTF models converted to nodes, it uses the same object name you would see in 3D modeling software like Blender.

### `node.position`: Vector3

The local position of the node relative to its parent.

### `node.quaternion`: Quaternion

The local rotation of the node represented as a quaternion. Updating this automatically updates the `rotation` property.

### `node.rotation`: Euler

The local rotation of the node represented as Euler angles. Updating this automatically updates the `quaternion` property.

### `node.scale`: Vector3

The local scale of the node.

### `node.matrixWorld`: Matrix4

The world matrix of this node in global space.

### `node.parent`: Node | null

The parent node, if any. `null` if this node is at the root level.

### `node.add(child: Node)`: Node

Adds a child node to this node and returns the parent node (self).

### `node.remove(child: Node)`: Node

Removes a child node from this node and returns the parent node (self).

### `node.traverse(callback: Function)`: void

Executes a callback function for this node and all of its descendants.

### `node.getWorldPosition(target: Vector3)`: Vector3

Gets the world position of the node and sets it to the target Vector3.

### `node.getWorldQuaternion(target: Quaternion)`: Quaternion

Gets the world rotation of the node as a Quaternion and sets it to the target Quaternion.

### `node.getWorldScale(target: Vector3)`: Vector3

Gets the world scale of the node and sets it to the target Vector3.

### Notes

- When working with GLTF models, note that some 3D modeling software may rename objects when exporting. It's best practice to name everything in UpperCamelCase with no special characters to avoid issues.
- The `matrixWorld` property is automatically updated by the Hyperfy engine. You typically don't need to modify it directly.
- When adding or removing child nodes, be mindful of performance implications, especially if done frequently.

### Example

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Create a new node
      const parentNode = app.create('Group')
      parentNode.position.set(0, 1, 0)

      // Create a child node
      const childNode = app.create('Mesh')
      childNode.scale.set(0.5, 0.5, 0.5)

      // Add child to parent
      parentNode.add(childNode)

      // Add parent to the app
      app.add(parentNode)

      // Traverse the node and its children
      parentNode.traverse(node => {
        console.log(`Visited node: ${node.id}`)
      })

      // Get world position
      const worldPos = new Vector3()
      childNode.getWorldPosition(worldPos)
      console.log(`Child world position: ${worldPos.x}, ${worldPos.y}, ${worldPos.z}`)
    }
  }
}
