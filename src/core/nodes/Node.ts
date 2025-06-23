import * as THREE from '../extras/three'
import { Vector3Enhanced } from '../extras/Vector3Enhanced'

// Helper function to replace lodash
function isBoolean(value: any): value is boolean {
  return typeof value === 'boolean'
}

const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _m1 = new THREE.Matrix4()

const defaults = {
  active: true,
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1],
}

let nodeIds = -1

const EPSILON = 0.000000001

const secure = { allowRef: false }
export function getRef(pNode: any): any {
  if (!pNode || !pNode._isRef) return pNode
  secure.allowRef = true
  const node = pNode._ref
  secure.allowRef = false
  return node
}

export function secureRef(obj: any = {}, getRef: () => any): any {
  const tpl = {
    get _ref() {
      if (!secure.allowRef) return null
      return getRef()
    },
  }
  obj._isRef = true
  const descriptor = Object.getOwnPropertyDescriptor(tpl, '_ref')
  if (descriptor) {
    Object.defineProperty(obj, '_ref', descriptor)
  }
  return obj
}

export class Node {
  id: string;
  name: string;
  parent: Node | null;
  children: Node[];
  ctx: any;
  position: Vector3Enhanced;
  quaternion: THREE.Quaternion;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  matrix: THREE.Matrix4;
  matrixWorld: THREE.Matrix4;
  _onPointerEnter?: any;
  _onPointerLeave?: any;
  _onPointerDown?: any;
  _onPointerUp?: any;
  _cursor?: string;
  _active: boolean;
  isDirty: boolean;
  isTransformed: boolean;
  mounted: boolean;
  proxy?: any;
  
  constructor(data: any = {}) {
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
    ;(this.position as Vector3Enhanced)._onChange(() => {
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
      // scale set to exactly zero on any axis causes matrices to have NaN values.
      // this causes our octrees to fail into an infinite loop
      if (this.scale.x === 0 || this.scale.y === 0 || this.scale.z === 0) {
        return this.scale.set(this.scale.x || EPSILON, this.scale.y || EPSILON, this.scale.z || EPSILON)
      }
      this.setTransformed()
      return this.scale
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

  activate(ctx?: any): void {
    if (ctx) this.ctx = ctx
    if (!this._active) return
    // top down mount
    if (this.mounted) return
    this.updateTransform()
    this.mounted = true
    this.mount()
    const children = this.children
    for (let i = 0, l = children.length; i < l; i++) {
      const child = children[i]
      if (child) {
        child.activate(ctx)
      }
    }
  }

  deactivate() {
    if (!this.mounted) return
    // bottom up unmount
    const children = this.children
    for (let i = 0, l = children.length; i < l; i++) {
      const child = children[i]
      if (child) {
        child.deactivate()
      }
    }
    this.unmount()
    this.isDirty = false
    this.isTransformed = true
    this.mounted = false
  }

  add(node: Node) {
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

  remove(node: Node) {
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
    this.traverse((node: Node) => {
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
    } else if (this._active && !this.parent) {
      this.activate(this.ctx)
    }
  }

  clean() {
    if (!this.isDirty) return
    let top: Node = this
    while (top.parent && top.parent.isDirty) {
      top = top.parent
    }
    let didTransform: boolean | undefined
    top.traverse((node: Node) => {
      if (node.isTransformed) {
        didTransform = true
      }
      if (didTransform) {
        node.updateTransform()
      }
      if (node.mounted) {
        node.commit(didTransform || false)
      }
      node.isDirty = false
    })
  }

  mount() {
    // called when transforms are ready and this thing should be added to the scene
  }

  commit(_didTransform: boolean) {
    // called when dirty (either transform changed or node-specific)
    // if the transform changed it should be moved in the same (this.matrixWorld)
  }

  unmount() {
    // called when this thing should be removed from scene
  }

  updateTransform() {
    if (this.isTransformed) {
      this.matrix.compose(this.position as any, this.quaternion, this.scale as any)
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

  traverse(callback: (node: Node) => void) {
    callback(this)
    const children = this.children
    for (let i = 0, l = children.length; i < l; i++) {
      const child = children[i]
      if (child) {
        child.traverse(callback)
      }
    }
  }

  clone(recursive?: boolean): this {
    return new (this.constructor as any)().copy(this, recursive)
  }

  copy(source: Node, recursive?: boolean) {
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
        if (child) {
          this.add(child.clone(recursive))
        }
      }
    }
    return this
  }

  get(id: string): Node | null {
    if (this.id === id) return this
    for (let i = 0, l = this.children.length; i < l; i++) {
      const child = this.children[i]
      if (child) {
        const found = child.get(id)
        if (found) {
          return found
        }
      }
    }
    return null
  }

  // todo: getWorldQuaternion etc
  getWorldPosition(vec3 = _v1) {
    this.matrixWorld.decompose(vec3 as any, _q1, _v2 as any)
    return vec3
  }

  getWorldMatrix(mat = _m1) {
    return mat.copy(this.matrixWorld)
  }

  getStats(recursive?: boolean, stats?: any): any {
    if (!stats) {
      stats = {
        geometries: new Set(),
        materials: new Set(),
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

  applyStats(_stats: any) {
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
        set id(_value) {
          throw new Error('Setting ID not currently supported')
        },
        get name() {
          return self.name
        },
        get position() {
          return self.position
        },
        set position(_value) {
          throw new Error('Cannot replace node position')
        },
        get quaternion() {
          return self.quaternion
        },
        set quaternion(_value) {
          throw new Error('Cannot replace node quaternion')
        },
        get rotation() {
          return self.rotation
        },
        set rotation(_value) {
          throw new Error('Cannot replace node position')
        },
        get scale() {
          return self.scale
        },
        set scale(_value) {
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
        set parent(_value) {
          throw new Error('Cannot set parent directly')
        },
        get children() {
          return self.children.map(child => {
            return child.getProxy()
          })
        },
        get(id: string) {
          const node = self.get(id)
          return node?.getProxy() || null
        },
        getWorldMatrix(mat: any) {
          return self.getWorldMatrix(mat)
        },
        add(pNode: any) {
          const node = getRef(pNode)
          self.add(node)
          return this
        },
        remove(pNode: any) {
          const node = getRef(pNode)
          self.remove(node)
          return this
        },
        traverse(callback: (node: any) => void) {
          self.traverse((node: Node) => {
            callback(node.getProxy())
          })
        },
        // detach(node) {
        //   self.detach(node)
        // },
        clone(recursive?: boolean) {
          const node = self.clone(recursive)
          return node.getProxy()
        },
        clean() {
          self.clean()
        },
        get _ref() {
          if (!secure.allowRef) return null
          return self
        },
        get _isRef() {
          return true
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
