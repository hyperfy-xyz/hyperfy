# LOD

A LOD can hold multiple child nodes and automatically activate/deactivate them based on their distance from the camera.

## Properties

### `.scaleAware`: Boolean

When enabled, the max distance of child items are multiplied by their scale. This produces a balance where larger objects will retain higher lod levels over further distances. 

In most cases this should be enabled but there are some cases where you may not want this behavior.

Defaults to `true`.

### `.{...Node}`

Inherits all [Node](/docs/scripting/nodes/Node.md) properties

## Methods

### `.insert(node, maxDistance)`

Adds `node` as a child of this node and also registers it to be activated/deactivated based on the `maxDistance` value.


