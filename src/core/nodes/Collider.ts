import * as THREE from 'three'
import { isBoolean, isNumber } from 'lodash-es'

import { getRef, Node, secureRef } from './Node'

import { Layers } from '../extras/Layers'
import { geometryToPxMesh } from '../extras/geometryToPxMesh'

// Global PHYSX declaration
declare const PHYSX: any;

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

interface ColliderData {
  type?: string;
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
  geometry?: any;
  convex?: boolean;
  trigger?: boolean;
  layer?: string;
  staticFriction?: number;
  dynamicFriction?: number;
  restitution?: number;
}

export class Collider extends Node {
  _type?: string;
  _width?: number;
  _height?: number;
  _depth?: number;
  _radius?: number;
  _geometry?: any;
  _convex?: boolean;
  _trigger?: boolean;
  _layer?: string;
  _staticFriction?: number;
  _dynamicFriction?: number;
  _restitution?: number;
  shape?: any;
  pmesh?: any;
  needsRebuild?: boolean;
  
  constructor(data: ColliderData = {}) {
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
      geometry = new PHYSX.PxBoxGeometry(this._width! / 2, this._height! / 2, this._depth! / 2)
    } else if (this._type === 'sphere') {
      geometry = new PHYSX.PxSphereGeometry(this._radius!)
    } else if (this._type === 'geometry') {
      // note: triggers MUST be convex according to PhysX/Unity
      const isConvex = this._trigger || this._convex || false
      pmesh = geometryToPxMesh(this.ctx.world, this._geometry, isConvex)
      if (!pmesh) return console.error('failed to generate collider pmesh')
      this.matrixWorld.decompose(_v1 as any, _q1, _v2 as any)
      _v1.multiplyScalar(0.02) // for visible selection
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
    const material = this.ctx.world.physics.getMaterial(this._staticFriction!, this._dynamicFriction!, this._restitution!)
    const flags = new PHYSX.PxShapeFlags()
    if (this._trigger) {
      flags.raise(PHYSX.PxShapeFlagEnum.eTRIGGER_SHAPE)
    } else {
      flags.raise(PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE | PHYSX.PxShapeFlagEnum.eSIMULATION_SHAPE)
    }
    const layer = Layers[this._layer!]
    if (!layer) {
      throw new Error(`[collider] layer not found: ${this._layer}`)
    }
    let pairFlags = PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_FOUND | PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_LOST
    if (!this._trigger) {
      pairFlags |= PHYSX.PxPairFlagEnum.eNOTIFY_CONTACT_POINTS
    }
    this.pmesh = pmesh
    const filterData = new PHYSX.PxFilterData(layer.group, layer.mask, pairFlags, 0)
    try {
      this.shape = this.ctx.world.physics.physics.createShape(geometry, material, true, flags)
    } catch (err) {
      console.error('[collider] failed to create shape')
      console.error(err)
      // cleanup
      if (geometry) {
        PHYSX.destroy(geometry)
      }
      if (this.pmesh) {
        this.pmesh.release()
        this.pmesh = null
      }
      return
    }
    this.shape.setQueryFilterData(filterData)
    this.shape.setSimulationFilterData(filterData)
    // const parentWorldScale = _v2
    // this.parent.matrixWorld.decompose(_v1, _q1, parentWorldScale)
    const position = _v1.copy(this.position).multiply(this.parent?.scale || new THREE.Vector3(1, 1, 1))
    const pose = new PHYSX.PxTransform()
    
    // Check if the extended methods exist
    if (typeof (position as any).toPxTransform === 'function') {
      (position as any).toPxTransform(pose)
    } else {
      // Fallback: manually set the position
      pose.p.x = position.x
      pose.p.y = position.y  
      pose.p.z = position.z
    }
    
    if (typeof (this.quaternion as any).toPxTransform === 'function') {
      (this.quaternion as any).toPxTransform(pose)
    } else {
      // Fallback: manually set the quaternion
      pose.q.x = this.quaternion.x
      pose.q.y = this.quaternion.y
      pose.q.z = this.quaternion.z
      pose.q.w = this.quaternion.w
    }
    
    this.shape.setLocalPose(pose)
    ;(this.parent as any)?.addShape?.(this.shape)
    // console.log('geometry', geometry)
    // this._geometry = geometry
    PHYSX.destroy(geometry)
    this.needsRebuild = false
  }

  commit(didMove: any) {
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
    ;(this.parent as any)?.removeShape?.(this.shape)
    this.shape?.release()
    this.shape = null
    this.pmesh?.release()
    this.pmesh = null
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

  set type(value) {
    if (value === undefined) value = defaults.type;
    if (!isType(value)) {
      throw new Error(`[collider] invalid type: ${value}`)
    }
    this._type = value
    this.needsRebuild = true
    this.setDirty()
  }

  get width() {
    return this._width
  }

  set width(value) {
    if (value === undefined) value = defaults.width;
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

  set height(value) {
    if (value === undefined) value = defaults.height;
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

  set depth(value) {
    if (value === undefined) value = defaults.depth;
    if (!isNumber(value)) {
      throw new Error('[collider] depth not a number')
    }
    this._depth = value
    if (this.shape && this._type === 'box') {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  setSize(width: number, height: number, depth: number) {
    this.width = width
    this.height = height
    this.depth = depth
  }

  get radius() {
    return this._radius
  }

  set radius(value) {
    if (value === undefined) value = defaults.radius;
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

  set geometry(value) {
    if (value === undefined) value = defaults.geometry;
    this._geometry = getRef(value)
    this.needsRebuild = true
    this.setDirty()
  }

  get convex() {
    return this._convex
  }

  set convex(value) {
    if (value === undefined) value = defaults.convex;
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

  set trigger(value) {
    if (value === undefined) value = defaults.trigger;
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

  set layer(value) {
    if (value === undefined) value = defaults.layer;
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

  set staticFriction(value) {
    if (value === undefined) value = defaults.staticFriction;
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

  set dynamicFriction(value) {
    if (value === undefined) value = defaults.dynamicFriction;
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

  set restitution(value) {
    if (value === undefined) value = defaults.restitution;
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

  requestRebuild() {
    this.needsRebuild = true
    this.setDirty()
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
        requestRebuild() {
          self.requestRebuild()
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
