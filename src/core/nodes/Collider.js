import * as THREE from '../extras/three'
import { isBoolean, isNumber } from 'lodash-es'

import { getRef, Node, secureRef } from './Node'

import { Layers } from '../extras/Layers'
import { geometryToPxMesh } from '../extras/geometryToPxMesh'

const defaults = {
  type: 'box',
  width: 1,
  height: 1,
  depth: 1,
  radius: 0.5,
  geometry: null,
  convex: false,
  trigger: false,
  layer: 'environment',
  staticFriction: 0.6,
  dynamicFriction: 0.6,
  restitution: 0,
}

const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()

const types = ['box', 'sphere', 'geometry']
const layers = ['environment', 'prop', 'player', 'tool']

export class Collider extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'collider'

    this.type = data.type
    this.width = data.width
    this.height = data.height
    this.depth = data.depth
    this.radius = data.radius
    this.geometry = data.geometry
    this.convex = data.convex
    this.trigger = data.trigger
    this.layer = data.layer
    this.staticFriction = data.staticFriction
    this.dynamicFriction = data.dynamicFriction
    this.restitution = data.restitution
  }

  mount() {
    let geometry
    let pmesh
    if (this._type === 'box') {
      geometry = new PHYSX.PxBoxGeometry(this._width / 2, this._height / 2, this._depth / 2)
    } else if (this._type === 'sphere') {
      geometry = new PHYSX.PxSphereGeometry(this._radius)
    } else if (this._type === 'geometry') {
      // note: triggers MUST be convex according to PhysX/Unity
      const isConvex = this._trigger || this._convex
      pmesh = geometryToPxMesh(this.ctx.world, this._geometry, isConvex)
      if (!pmesh) return console.error('failed to generate collider pmesh')
      this.matrixWorld.decompose(_v1, _q1, _v2)
      const scale = new PHYSX.PxMeshScale(new PHYSX.PxVec3(_v2.x, _v2.y, _v2.z), new PHYSX.PxQuat(0, 0, 0, 1))
      if (isConvex) {
        geometry = new PHYSX.PxConvexMeshGeometry(pmesh.value, scale)
      } else {
        // const flags = new PHYSX.PxMeshGeometryFlags()
        // flags.raise(PHYSX.PxMeshGeometryFlagEnum.eDOUBLE_SIDED)
        geometry = new PHYSX.PxTriangleMeshGeometry(pmesh.value, scale)
      }
      PHYSX.destroy(scale)
    }
    const material = this.ctx.world.physics.physics.createMaterial(
      this._staticFriction,
      this._dynamicFriction,
      this._restitution
    )
    const flags = new PHYSX.PxShapeFlags()
    if (this._trigger) {
      flags.raise(PHYSX.PxShapeFlagEnum.eTRIGGER_SHAPE)
    } else {
      flags.raise(PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE | PHYSX.PxShapeFlagEnum.eSIMULATION_SHAPE)
    }
    const layer = Layers[this._layer]
    let pairFlags = PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_FOUND | PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_LOST
    if (!this._trigger) {
      pairFlags |= PHYSX.PxPairFlagEnum.eNOTIFY_CONTACT_POINTS
    }
    this.pmesh = pmesh
    const filterData = new PHYSX.PxFilterData(layer.group, layer.mask, pairFlags, 0)
    this.shape = this.ctx.world.physics.physics.createShape(geometry, material, true, flags)
    this.shape.setQueryFilterData(filterData)
    this.shape.setSimulationFilterData(filterData)
    // const parentWorldScale = _v2
    // this.parent.matrixWorld.decompose(_v1, _q1, parentWorldScale)
    const position = _v1.copy(this.position).multiply(this.parent.scale)
    const pose = new PHYSX.PxTransform()
    position.toPxTransform(pose)
    this.quaternion.toPxTransform(pose)
    this.shape.setLocalPose(pose)
    this.parent?.addShape?.(this.shape)
    // console.log('geometry', geometry)
    // this._geometry = geometry
    PHYSX.destroy(geometry)
    this.needsRebuild = false
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.unmount()
      this.mount()
      return
    }
    if (didMove) {
      // ...
    }
  }

  unmount() {
    // if (this.type === 'geometry' && pxMeshes[this.geometry.uuid]) {
    //   pxMeshes[this.geometry.uuid].release()
    //   delete pxMeshes[this.geometry.uuid]
    // }
    this.parent?.removeShape?.(this.shape)
    this.shape?.release()
    this.shape = null
    this.pmesh?.release()
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._type = source._type
    this._width = source._width
    this._height = source._height
    this._depth = source._depth
    this._radius = source._radius
    this._geometry = source._geometry
    this._convex = source._convex
    this._trigger = source._trigger
    this._layer = source._layer
    this._staticFriction = source._staticFriction
    this._dynamicFriction = source._dynamicFriction
    this._restitution = source._restitution
    return this
  }

  get type() {
    return this._type
  }

  set type(value = defaults.type) {
    if (!isType(value)) {
      throw new Error(`[collider] invalid type:`, value)
    }
    this._type = value
    this.needsRebuild = true
    this.setDirty()
  }

  get width() {
    return this._width
  }

  set width(value = defaults.width) {
    if (!isNumber(value)) {
      throw new Error('[collider] width not a number')
    }
    this._width = value
    if (this.shape && this._type === 'box') {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get height() {
    return this._height
  }

  set height(value = defaults.height) {
    if (!isNumber(value)) {
      throw new Error('[collider] height not a number')
    }
    this._height = value
    if (this.shape && this._type === 'box') {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get depth() {
    return this._depth
  }

  set depth(value = defaults.depth) {
    if (!isNumber(value)) {
      throw new Error('[collider] depth not a number')
    }
    this._depth = value
    if (this.shape && this._type === 'box') {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  setSize(width, height, depth) {
    this.width = width
    this.height = height
    this.depth = depth
  }

  get radius() {
    return this._radius
  }

  set radius(value = defaults.radius) {
    if (!isNumber(value)) {
      throw new Error('[collider] radius not a number')
    }
    this._radius = value
    if (this.shape && this._type === 'sphere') {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get geometry() {
    return secureRef({}, () => this._geometry)
  }

  set geometry(value = defaults.geometry) {
    this._geometry = getRef(value)
    this.needsRebuild = true
    this.setDirty()
  }

  get convex() {
    return this._convex
  }

  set convex(value = defaults.convex) {
    if (!isBoolean(value)) {
      throw new Error('[collider] convex not a boolean')
    }
    this._convex = value
    if (this.shape) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get trigger() {
    return this._trigger
  }

  set trigger(value = defaults.trigger) {
    if (!isBoolean(value)) {
      throw new Error('[collider] trigger not a boolean')
    }
    this._trigger = value
    if (this.shape) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get layer() {
    return this._layer
  }

  set layer(value = defaults.layer) {
    if (!isLayer(value)) {
      throw new Error(`[collider] invalid layer: ${value}`)
    }
    this._layer = value
    if (this.shape) {
      // TODO: we could just update the PxFilterData tbh
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get staticFriction() {
    return this._staticFriction
  }

  set staticFriction(value = defaults.staticFriction) {
    if (!isNumber(value)) {
      throw new Error('[collider] staticFriction not a number')
    }
    this._staticFriction = value
    if (this.shape) {
      // todo: we could probably just update the PxMaterial tbh
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get dynamicFriction() {
    return this._dynamicFriction
  }

  set dynamicFriction(value = defaults.dynamicFriction) {
    if (!isNumber(value)) {
      throw new Error('[collider] dynamicFriction not a number')
    }
    this._dynamicFriction = value
    if (this.shape) {
      // todo: we could probably just update the PxMaterial tbh
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get restitution() {
    return this._restitution
  }

  set restitution(value = defaults.restitution) {
    if (!isNumber(value)) {
      throw new Error('[collider] restitution not a number')
    }
    this._restitution = value
    if (this.shape) {
      // todo: we could probably just update the PxMaterial tbh
      this.needsRebuild = true
      this.setDirty()
    }
  }

  setMaterial(staticFriction, dynamicFriction, restitution) {
    this.staticFriction = staticFriction
    this.dynamicFriction = dynamicFriction
    this.restitution = restitution
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get type() {
          return self.type
        },
        set type(value) {
          self.type = value
        },
        get width() {
          return self.width
        },
        set width(value) {
          self.width = value
        },
        get height() {
          return self.height
        },
        set height(value) {
          self.height = value
        },
        get depth() {
          return self.depth
        },
        set depth(value) {
          self.depth = value
        },
        setSize(width, height, depth) {
          self.setSize(width, height, depth)
        },
        get radius() {
          return self.radius
        },
        set radius(value) {
          self.radius = value
        },
        get geometry() {
          return self.geometry
        },
        set geometry(value) {
          self.geometry = value
        },
        get convex() {
          return self.convex
        },
        set convex(value) {
          self.convex = value
        },
        get trigger() {
          return self.trigger
        },
        set trigger(value) {
          self.trigger = value
        },
        get layer() {
          return self.layer
        },
        set layer(value) {
          if (value === 'player') {
            throw new Error('[collider] layer invalid: player')
          }
          self.layer = value
        },
        get staticFriction() {
          return self.staticFriction
        },
        set staticFriction(value) {
          self.staticFriction = value
        },
        get dynamicFriction() {
          return self.dynamicFriction
        },
        set dynamicFriction(value) {
          self.dynamicFriction = value
        },
        get restitution() {
          return self.restitution
        },
        set restitution(value) {
          self.restitution = value
        },
        setMaterial(staticFriction, dynamicFriction, restitution) {
          self.setMaterial(staticFriction, dynamicFriction, restitution)
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

function isType(value) {
  return types.includes(value)
}

function isLayer(value) {
  return layers.includes(value)
}
