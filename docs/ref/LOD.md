# LOD

A LOD can hold multiple child nodes and automatically activate/deactivate them based on their distance from the camera.

## Properties

### `.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

## Methods

### `.insert(node, maxDistance)`

Adds `node` as a child of this node and also registers it to be activated/deactivated based on the `maxDistance` value.


