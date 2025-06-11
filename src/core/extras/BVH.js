import * as THREE from 'three'

const _tempBox = new THREE.Box3()
const _tempVec = new THREE.Vector3()
const _center = new THREE.Vector3()
const _size = new THREE.Vector3()
const _camPos = new THREE.Vector3()

export class BVHNode {
  constructor() {
    this.bounds = new THREE.Box3()
    this.left = null
    this.right = null
    this.items = null // array of items for leaf nodes
  }
}

export class BVHTree {
  constructor(world, maxItemsPerLeaf = 4) {
    this.world = world
    this.root = null
    this.maxItemsPerLeaf = maxItemsPerLeaf
    this.vis = null
  }

  insert(item) {
    if (!item.bounds) {
      item.bounds = new THREE.Box3()
    }
    if (!item.geometry.boundingBox) {
      item.geometry.computeBoundingBox()
    }
    item.bounds.copy(item.geometry.boundingBox)
    item.bounds.applyMatrix4(item.matrix)
    if (!this.root) {
      this.root = new BVHNode()
      this.root.items = [item]
      this.root.bounds.copy(item.bounds)

      // Visualization hook: new root node created
      this.vis?.insert(this.root)

      return
    }
    this._insertRecursive(this.root, item)
  }

  remove(item) {
    if (!this.root) return false
    const result = this._removeRecursive(this.root, null, item)

    // Check if root is now empty and remove it
    if (this.root && this.root.items && this.root.items.length === 0) {
      this.vis?.remove(this.root)
      this.root = null
    }

    return result
  }

  // Traverse tree with frustum, front-to-back order
  traverseFrustum(frustum, camera, callback) {
    if (!this.root) return

    const queue = []

    _camPos.setFromMatrixPosition(camera.matrixWorld)

    // Add root with distance
    this.root.bounds.getCenter(_center)
    this.root.dist = _center.distanceToSquared(_camPos)
    queue.push(this.root)

    // Process nodes front-to-back
    while (queue.length > 0) {
      // Sort by distance (front to back)
      queue.sort((a, b) => a.dist - b.dist)
      const node = queue.shift()

      // Frustum culling
      if (!frustum.intersectsBox(node.bounds)) continue

      if (node.items) {
        // Leaf node - process items
        for (const item of node.items) {
          if (frustum.intersectsBox(item.bounds)) {
            if (callback(item) === false) return // Early exit if callback returns false
          }
        }
      } else if (node.left) {
        // Internal node - add children to queue
        node.left.bounds.getCenter(_center)
        node.left.dist = _center.distanceToSquared(_camPos)
        queue.push(node.left)

        node.right.bounds.getCenter(_center)
        node.right.dist = _center.distanceToSquared(_camPos)
        queue.push(node.right)
      }
    }
  }

  // Fast frustum query without ordering
  queryFrustum(frustum, results = []) {
    if (!this.root) return results
    this._queryFrustumRecursive(this.root, frustum, results)
    return results
  }

  clear() {
    if (this.root && this.vis) {
      this._clearRecursive(this.root)
    }
    this.root = null
  }

  // Private methods
  _clearRecursive(node) {
    if (node.left) {
      this._clearRecursive(node.left)
      this._clearRecursive(node.right)
    }
    this.vis?.remove(node)
  }

  _insertRecursive(node, item) {
    // Store old bounds to check if they changed
    const oldBounds = node.bounds.clone()

    // Expand bounds to include new item
    node.bounds.union(item.bounds)

    // Visualization hook: bounds changed
    if (this.vis && !node.bounds.equals(oldBounds)) {
      this.vis.update(node)
    }

    if (node.items) {
      // Leaf node
      node.items.push(item)

      // Split if too many items
      if (node.items.length > this.maxItemsPerLeaf) {
        this._splitNode(node)
      }
    } else {
      // Internal node - insert into best child
      const left = node.left
      const right = node.right

      // Calculate volume increase for each child
      _tempBox.copy(left.bounds).union(item.bounds)
      const leftIncrease = this._getVolume(_tempBox) - this._getVolume(left.bounds)

      _tempBox.copy(right.bounds).union(item.bounds)
      const rightIncrease = this._getVolume(_tempBox) - this._getVolume(right.bounds)

      // Insert into child with less volume increase
      if (leftIncrease < rightIncrease) {
        this._insertRecursive(left, item)
      } else {
        this._insertRecursive(right, item)
      }
    }
  }

  _removeRecursive(node, parent, item) {
    if (node.items) {
      // Leaf node - remove item
      const idx = node.items.indexOf(item)
      if (idx !== -1) {
        node.items.splice(idx, 1)

        // Store old bounds
        const oldBounds = node.bounds.clone()

        // Recompute bounds
        if (node.items.length > 0) {
          node.bounds.copy(node.items[0].bounds)
          for (let i = 1; i < node.items.length; i++) {
            node.bounds.union(node.items[i].bounds)
          }

          // Visualization hook: bounds changed
          if (this.vis && !node.bounds.equals(oldBounds)) {
            this.vis.update(node)
          }
        } else if (parent) {
          // Node is now empty, might need to restructure
          // For now, just update bounds
          if (this.vis && !node.bounds.equals(oldBounds)) {
            this.vis.update(node)
          }
        }

        return true
      }
      return false
    }

    // Internal node - search children
    let found = false
    const oldBounds = node.bounds.clone()

    if (node.left.bounds.intersectsBox(item.bounds)) {
      if (this._removeRecursive(node.left, node, item)) {
        found = true
      }
    }

    if (node.right.bounds.intersectsBox(item.bounds)) {
      if (this._removeRecursive(node.right, node, item)) {
        found = true
      }
    }

    if (found) {
      // Recompute bounds after removal
      node.bounds.copy(node.left.bounds)
      node.bounds.union(node.right.bounds)

      // Visualization hook: bounds changed
      if (this.vis && !node.bounds.equals(oldBounds)) {
        this.vis.update(node)
      }
    }

    return found
  }

  _splitNode(node) {
    const items = node.items

    // Find best split axis and position
    let bestAxis = 0
    let bestCost = Infinity
    let bestSplit = 0

    node.bounds.getSize(_size)

    // Try each axis
    for (let axis = 0; axis < 3; axis++) {
      // Skip if too thin
      if (_size.getComponent(axis) < 0.001) continue

      // Sort items along axis
      items.sort((a, b) => {
        a.bounds.getCenter(_tempVec)
        const aPos = _tempVec.getComponent(axis)
        b.bounds.getCenter(_tempVec)
        const bPos = _tempVec.getComponent(axis)
        return aPos - bPos
      })

      // Try different split positions
      for (let i = 1; i < items.length; i++) {
        // Calculate cost of this split
        const leftBox = new THREE.Box3()
        const rightBox = new THREE.Box3()

        for (let j = 0; j < i; j++) {
          leftBox.union(items[j].bounds)
        }
        for (let j = i; j < items.length; j++) {
          rightBox.union(items[j].bounds)
        }

        const cost = i * this._getVolume(leftBox) + (items.length - i) * this._getVolume(rightBox)

        if (cost < bestCost) {
          bestCost = cost
          bestAxis = axis
          bestSplit = i
        }
      }
    }

    // Re-sort by best axis if needed
    if (bestAxis !== 2) {
      items.sort((a, b) => {
        a.bounds.getCenter(_tempVec)
        const aPos = _tempVec.getComponent(bestAxis)
        b.bounds.getCenter(_tempVec)
        const bPos = _tempVec.getComponent(bestAxis)
        return aPos - bPos
      })
    }

    // Create child nodes
    const left = new BVHNode()
    const right = new BVHNode()

    left.items = items.slice(0, bestSplit)
    right.items = items.slice(bestSplit)

    // Calculate bounds
    left.bounds.copy(left.items[0].bounds)
    for (let i = 1; i < left.items.length; i++) {
      left.bounds.union(left.items[i].bounds)
    }

    right.bounds.copy(right.items[0].bounds)
    for (let i = 1; i < right.items.length; i++) {
      right.bounds.union(right.items[i].bounds)
    }

    // Convert leaf to internal node
    node.items = null
    node.left = left
    node.right = right

    // Visualization hooks: new nodes created
    if (this.vis) {
      this.vis.insert(left)
      this.vis.insert(right)
    }
  }

  _queryFrustumRecursive(node, frustum, results) {
    if (!frustum.intersectsBox(node.bounds)) return

    if (node.items) {
      // Leaf node
      for (const item of node.items) {
        if (frustum.intersectsBox(item.bounds)) {
          results.push(item)
        }
      }
    } else if (node.left) {
      // Internal node
      this._queryFrustumRecursive(node.left, frustum, results)
      this._queryFrustumRecursive(node.right, frustum, results)
    }
  }

  _getVolume(box) {
    box.getSize(_size)
    return _size.x * _size.y * _size.z
  }

  showVis() {
    this.vis = createVis(this)
    this.vis.init()
  }

  hideVis() {
    if (this.vis) {
      this.vis.destroy()
      this.vis = null
    }
  }

  getCount(node = this.root) {
    if (!node) return 0
    let count = 1 // Count this node
    if (node.left) {
      count += this.getCount(node.left)
    }
    if (node.right) {
      count += this.getCount(node.right)
    }
    return count
  }
}

// Usage example:
/*
  const bvh = new BVHTree(world, 4); // max 4 items per leaf
  
  // Enable visualization
  bvh.showVis();
  
  // Insert items - visualization will automatically update
  const item = {
    geometry: myGeometry,
    matrix: myMatrix,
    // ... other properties
  };
  bvh.insert(item);
  
  // Remove and reinsert when moved - visualization will track changes
  bvh.remove(item);
  item.matrix = newMatrix;
  bvh.insert(item);
  
  // Disable visualization
  bvh.hideVis();
  
  // Traverse front-to-back for rendering
  bvh.traverseFrustum(camera.frustum, camera, (item) => {
    // Issue occlusion query, render, etc.
    renderer.render(item.mesh);
    
    // Return false to stop traversal (e.g., if occluded)
    if (isFullyOccluded) return false;
  });
  
  // Or get all visible items at once
  const visible = bvh.queryFrustum(camera.frustum);
*/

function createVis(bvh) {
  const world = bvh.world
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  const boxes = new THREE.BoxGeometry(1, 1, 1)
  const edges = new THREE.EdgesGeometry(boxes)
  const geometry = new THREE.InstancedBufferGeometry().copy(edges)
  const iMatrix = new THREE.InstancedBufferAttribute(new Float32Array(1000000 * 16), 16)
  iMatrix.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('iMatrix', iMatrix)
  const offsetAttr = new THREE.InstancedBufferAttribute(new Float32Array(100000 * 3), 3)
  geometry.setAttribute('offset', offsetAttr)
  const scaleAttr = new THREE.InstancedBufferAttribute(new Float32Array(100000 * 3), 3)
  geometry.setAttribute('scale', scaleAttr)
  geometry.instanceCount = 0
  const material = new THREE.LineBasicMaterial({
    color: 'red',
    onBeforeCompile: shader => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
          attribute mat4 iMatrix;
          #include <common>
          `
      )
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
          #include <begin_vertex>
          transformed = (iMatrix * vec4(position, 1.0)).xyz;
          `
      )
    },
  })
  const mesh = new THREE.LineSegments(geometry, material)
  mesh.frustumCulled = false
  const items = []
  function insert(node) {
    if (node._visItem) return
    const idx = mesh.geometry.instanceCount
    mesh.geometry.instanceCount++
    node.bounds.getCenter(position)
    node.bounds.getSize(scale)
    const matrix = new THREE.Matrix4().compose(position, quaternion, scale)
    iMatrix.set(matrix.elements, idx * 16)
    iMatrix.needsUpdate = true
    node._visItem = { idx, matrix }
    items.push(node._visItem)
    // console.log('add', items.length)
  }
  function update(node) {
    if (!node._visItem) return
    node.bounds.getCenter(position)
    node.bounds.getSize(scale)
    const { idx, matrix } = node._visItem
    matrix.compose(position, quaternion, scale)
    iMatrix.set(matrix.elements, idx * 16)
    iMatrix.needsUpdate = true
  }
  function remove(node) {
    const item = node._visItem
    if (!item) return
    const last = items[items.length - 1]
    const isOnly = items.length === 1
    const isLast = item === last
    if (isOnly) {
      items.length = 0
      mesh.geometry.instanceCount = 0
    } else if (isLast) {
      items.pop()
      mesh.geometry.instanceCount--
    } else {
      if (!last) {
        console.log(
          'wtf',
          item,
          items.indexOf(item),
          last,
          items.length,
          // items[items.length - 1]
          mesh.geometry.instanceCount,
          items
        )
        throw new Error('wtf')
      }
      iMatrix.set(last.matrix.elements, item.idx * 16)
      last.idx = item.idx
      items[item.idx] = last
      items.pop()
      mesh.geometry.instanceCount--
    }
    node._visItem = null
    iMatrix.needsUpdate = true
  }
  function traverse(node, callback) {
    callback(node)
    if (node.left) {
      traverse(node.left, callback)
      traverse(node.right, callback)
    }
  }
  function destroy() {
    traverse(bvh.root, node => {
      node._visItem = null
    })
    world.stage.scene.remove(mesh)
  }
  function init() {
    if (bvh.root) {
      traverse(bvh.root, node => {
        insert(node)
      })
    }
    world.stage.scene.add(mesh)
  }
  return {
    init,
    insert,
    update,
    remove,
    destroy,
  }
}
