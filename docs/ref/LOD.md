# LOD

A LOD can hold multiple child nodes and automatically activate/deactivate them based on their distance from the camera.

### `lod.insert(node, maxDistance)`

Adds `node` as a child of this node and also registers it to be activated/deactivated based on the `maxDistance` value.

Parameters:
- `node`: The node to add as a child
- `maxDistance`: The maximum distance at which this node should be visible. Nodes are sorted by distance, with closer nodes taking precedence.

### `lod.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

### Notes

- LOD (Level of Detail) automatically manages node visibility based on camera distance
- Only one LOD level is active at a time
- LOD levels are sorted by distance, with closer distances taking priority
- Nodes are automatically hidden when not active
- Useful for performance optimization by showing simpler models at greater distances
