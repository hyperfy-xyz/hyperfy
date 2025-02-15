import { isBoolean } from 'lodash-es'
import * as THREE from '../extras/three'

const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _v3 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _m1 = new THREE.Matrix4()
const _m2 = new THREE.Matrix4()
const _m3 = new THREE.Matrix4()
const _box3 = new THREE.Box3()
const _sphere = new THREE.Sphere()
const _points = []

const defaults = {
  active: true,
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1],
}

let nodeIds = -1

const secure = { allowRef: false }
export function getRef(pNode) {
  secure.allowRef = true
  const node = pNode._ref
  secure.allowRef = false
  return node
}

export class Node {
  constructor(data = {}) {
    this.id = data.id || `${++nodeIds}`
    this.name = 'node'

    this.parent = null
    this.children = []
    this.ctx = null
    this.position = new THREE.Vector3()
    this.position.fromArray(data.position || defaults.position)
    this.quaternion = new THREE.Quaternion()
    this.quaternion.fromArray(data.quaternion || defaults.quaternion)
    this.rotation = new THREE.Euler().setFromQuaternion(this.quaternion)
    this.rotation.reorder('YXZ')
    this.scale = new THREE.Vector3()
    this.scale.fromArray(data.scale || defaults.scale)
    this.matrix = new THREE.Matrix4()
    this.matrixWorld = new THREE.Matrix4()
    this.position._onChange(() => {
      this.setTransformed()
    })
    this.rotation._onChange(() => {
      this.quaternion.setFromEuler(this.rotation, false)
      this.setTransformed()
    })
    this.quaternion._onChange(() => {
      this.rotation.setFromQuaternion(this.quaternion, undefined, false)
      this.setTransformed()
    })
    this.scale._onChange(() => {
      this.setTransformed()
    })
    this._onPointerEnter = data.onPointerEnter
    this._onPointerLeave = data.onPointerLeave
    this._onPointerDown = data.onPointerDown
    this._onPointerUp = data.onPointerUp
    this._cursor = data.cursor
    this._active = isBoolean(data.active) ? data.active : defaults.active
    // this.scale._onChange?
    this.isDirty = false
    this.isTransformed = true
    this.mounted = false
  }

  activate(ctx) {
    if (ctx) this.ctx = ctx
    if (!this._active) return
    // top down mount
    if (this.mounted) return
    this.updateTransform()
    this.mounted = true
    this.mount()
    const children = this.children
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].activate(ctx)
    }
  }

  deactivate() {
    if (!this.mounted) return
    // bottom up unmount
    const children = this.children
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].deactivate()
    }
    this.unmount()
    this.mounted = false
  }

  add(node) {
    if (!node) return console.error('no node to add')
    if (node.parent) {
      node.parent.remove(node)
    }
    node.parent = this
    this.children.push(node)
    if (this.mounted) {
      node.activate(this.ctx)
    }
    return this
  }

  remove(node) {
    const idx = this.children.indexOf(node)
    if (idx === -1) return
    node.deactivate()
    node.parent = null
    this.children.splice(idx, 1)
    return this
  }

  // detach(node) {
  //   if (node) {
  //     const idx = this.children.indexOf(node)
  //     if (idx === -1) return
  //     this.project()
  //     node.parent = null
  //     this.children.splice(idx, 1)
  //     node.matrix.copy(node.matrixWorld)
  //     node.matrix.decompose(node.position, node.quaternion, node.scale)
  //     node.project()
  //     node.update()
  //   } else {
  //     this.parent?.detach(this)
  //   }
  // }

  setTransformed() {
    // - ensure this is marked as transformed
    // - ensure this and all descendants are dirty
    // - ensure only this node is tracked dirty
    if (this.isTransformed) return
    this.traverse(node => {
      if (node === this) {
        node.isTransformed = true
        node.setDirty()
      } else if (node.isDirty) {
        // if we come across an already dirty node we must ensure its not tracked
        // as we will clean it via this one
        this.ctx.world.stage.dirtyNodes.delete(node)
      } else {
        node.isDirty = true
      }
    })
  }

  setDirty() {
    // if we haven't mounted no track
    if (!this.mounted) return
    // if already dirty, either this or a parent is being tracked so we're good
    if (this.isDirty) return
    this.isDirty = true
    this.ctx.world.stage.dirtyNodes.add(this)
  }

  get active() {
    return this._active
  }

  set active(value) {
    if (this._active === value) return
    this._active = value
    if (!this._active && this.mounted) {
      this.deactivate()
    } else if (this._active && this.parent?.mounted) {
      this.activate(this.parent.ctx)
    }
  }

  clean() {
    if (!this.isDirty) return
    let didTransform
    this.traverse(node => {
      if (node.isTransformed) {
        didTransform = true
      }
      if (didTransform) {
        node.updateTransform()
      }
      if (node.mounted) {
        node.commit(didTransform)
      }
      node.isDirty = false
    })
  }

  mount() {
    // called when transforms are ready and this thing should be added to the scene
  }

  commit(didTransform) {
    // called when dirty (either transform changed or node-specific)
    // if the transform changed it should be moved in the same (this.matrixWorld)
  }

  unmount() {
    // called when this thing should be removed from scene
  }

  updateTransform() {
    if (this.isTransformed) {
      this.matrix.compose(this.position, this.quaternion, this.scale)
      this.isTransformed = false
    }
    if (this.parent) {
      this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix)
    } else {
      this.matrixWorld.copy(this.matrix)
    }
    // const children = this.children
    // for (let i = 0, l = children.length; i < l; i++) {
    //   children[i].project()
    // }
  }

  traverse(callback) {
    callback(this)
    const children = this.children
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].traverse(callback)
    }
  }

  clone(recursive) {
    return new this.constructor().copy(this, recursive)
  }

  copy(source, recursive) {
    this.id = source.id
    this.position.copy(source.position)
    this.quaternion.copy(source.quaternion)
    this.scale.copy(source.scale)
    this._onPointerEnter = source._onPointerEnter
    this._onPointerLeave = source._onPointerLeave
    this._onPointerDown = source._onPointerDown
    this._onPointerUp = source._onPointerUp
    this._cursor = source._cursor
    this._active = source._active
    if (recursive) {
      for (let i = 0; i < source.children.length; i++) {
        const child = source.children[i]
        this.add(child.clone(recursive))
      }
    }
    return this
  }

  get(id) {
    if (this.id === id) return this
    for (let i = 0, l = this.children.length; i < l; i++) {
      const found = this.children[i].get(id)
      if (found) {
        return found
      }
    }
    return null
  }

  // todo: getWorldQuaternion etc
  getWorldPosition(vec3 = _v1) {
    this.matrixWorld.decompose(vec3, _q1, _v2)
    return vec3
  }

  getStats(recursive, stats) {
    if (!stats) {
      stats = {
        geometries: new Set(),
        triangles: 0,
        textureBytes: 0,
      }
    }
    this.applyStats(stats)
    if (recursive) {
      for (const child of this.children) {
        child.getStats(recursive, stats)
      }
    }
    return stats
  }

  applyStats(stats) {
    // nodes should override this and add their stats
  }

  get onPointerEnter() {
    return this._onPointerEnter
  }

  set onPointerEnter(value) {
    this._onPointerEnter = value
  }

  get onPointerLeave() {
    return this._onPointerLeave
  }

  set onPointerLeave(value) {
    this._onPointerLeave = value
  }

  get onPointerDown() {
    return this._onPointerDown
  }

  set onPointerDown(value) {
    this._onPointerDown = value
  }

  get onPointerUp() {
    return this._onPointerUp
  }

  set onPointerUp(value) {
    this._onPointerUp = value
  }

  get cursor() {
    return this._cursor
  }

  set cursor(value) {
    this._cursor = value
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      const proxy = {
        get id() {
          return self.id
        },
        set id(value) {
          throw new Error('Setting ID not currently supported')
        },
        get name() {
          return self.name
        },
        get position() {
          return self.position
        },
        set position(value) {
          throw new Error('Cannot replace node position')
        },
        get quaternion() {
          return self.quaternion
        },
        set quaternion(value) {
          throw new Error('Cannot replace node quaternion')
        },
        get rotation() {
          return self.rotation
        },
        set rotation(value) {
          throw new Error('Cannot replace node position')
        },
        get scale() {
          return self.scale
        },
        set scale(value) {
          throw new Error('Cannot replace node scale')
        },
        get matrixWorld() {
          return self.matrixWorld
        },
        get active() {
          return self.active
        },
        set active(value) {
          self.active = value
        },
        get parent() {
          return self.parent?.getProxy()
        },
        set parent(value) {
          throw new Error('Cannot set parent directly')
        },
        add(pNode) {
          const node = getRef(pNode)
          self.add(node)
          return this
        },
        remove(pNode) {
          const node = getRef(pNode)
          self.remove(node)
          return this
        },
        traverse(callback) {
          self.traverse(node => {
            callback(node.getProxy())
          })
        },
        // detach(node) {
        //   self.detach(node)
        // },
        clone(recursive) {
          const node = self.clone(recursive)
          return node.getProxy()
        },
        get _ref() {
          if (!secure.allowRef) return null
          return self
        },
        get onPointerEnter() {
          return self.onPointerEnter
        },
        set onPointerEnter(value) {
          self.onPointerEnter = value
        },
        get onPointerLeave() {
          return self.onPointerLeave
        },
        set onPointerLeave(value) {
          self.onPointerLeave = value
        },
        get onPointerDown() {
          return self.onPointerDown
        },
        set onPointerDown(value) {
          self.onPointerDown = value
        },
        get onPointerUp() {
          return self.onPointerUp
        },
        set onPointerUp(value) {
          self.onPointerUp = value
        },
        get cursor() {
          return self.cursor
        },
        set cursor(value) {
          self.cursor = value
        },
      }
      this.proxy = proxy
    }
    return this.proxy
  }
}
