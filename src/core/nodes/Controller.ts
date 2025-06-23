import * as THREE from 'three'
import { isNumber, isBoolean, isString, isFunction } from 'lodash-es'

import { DEG2RAD } from '../extras/general'

import { Node } from './Node'
import { Layers } from '../extras/Layers'

// Global PHYSX declaration
declare const PHYSX: any;

const layers = ['environment', 'prop', 'player', 'tool']

const defaults = {
  radius: 0.4,
  height: 1,
  visible: false,
  layer: 'environment',
  tag: null,
  onContactStart: null,
  onContactEnd: null,
}

interface ControllerData {
  radius?: number;
  height?: number;
  visible?: boolean;
  layer?: string;
  tag?: string | number | null;
  onContactStart?: Function | null;
  onContactEnd?: Function | null;
}

export class Controller extends Node {
  _radius?: number;
  _height?: number;
  _visible?: boolean;
  _layer?: string;
  _tag?: string | null;
  _onContactStart?: Function | null;
  _onContactEnd?: Function | null;
  handle?: any;
  mesh?: any;
  controller?: any;
  actorHandle?: any;
  needsRebuild?: boolean;
  moveFlags?: any;
  didMove?: boolean;

  constructor(data: ControllerData = {}) {
    super(data)
    this.name = 'controller'

    this.radius = data.radius
    this.height = data.height
    this.visible = data.visible
    this.layer = data.layer
    if (data.tag !== undefined) {
      this.tag = isNumber(data.tag) ? String(data.tag) : data.tag
    } else {
      this.tag = defaults.tag
    }
    this.onContactStart = data.onContactStart
    this.onContactEnd = data.onContactEnd
  }

  mount() {
    this.needsRebuild = false
    if (this._visible) {
      const geometry = new THREE.CapsuleGeometry(this._radius!, this._height!, 2, 8)
      geometry.translate(0, this._height! / 2 + this._radius!, 0)
      geometry.computeBoundsTree()
      const material = new THREE.MeshStandardMaterial({ color: 'green' })
      this.mesh = new THREE.Mesh(geometry, material)
      this.mesh.receiveShadow = true
      this.mesh.castShadow = true
      this.mesh.matrixAutoUpdate = false
      this.mesh.matrixWorldAutoUpdate = false
      this.mesh.matrix.copy(this.matrix)
      this.mesh.matrixWorld.copy(this.matrixWorld)
      this.mesh.node = this
      this.ctx.world.graphics.scene.add(this.mesh)
    }
    const desc = new PHYSX.PxCapsuleControllerDesc()
    desc.height = this._height!
    desc.radius = this._radius!
    desc.climbingMode = PHYSX.PxCapsuleClimbingModeEnum.eCONSTRAINED
    desc.slopeLimit = Math.cos(60 * DEG2RAD) // 60 degrees
    desc.material = this.ctx.world.physics.defaultMaterial
    desc.contactOffset = 0.1 // PhysX default = 0.1
    desc.stepOffset = 0.5 // PhysX default = 0.5m
    this.controller = this.ctx.world.physics.controllerManager.createController(desc) // prettier-ignore
    PHYSX.destroy(desc)
    const worldPosition = this.getWorldPosition()
    ;(this.controller as any).setFootPosition((worldPosition as any).toPxExtVec3())

    const actor = this.controller.getActor()
    const nbShapes = actor.getNbShapes()
    const shapeBuffer = new PHYSX.PxArray_PxShapePtr(nbShapes)
    const shapesCount = actor.getShapes(shapeBuffer.begin(), nbShapes, 0)
    for (let i = 0; i < shapesCount; i++) {
      const shape = shapeBuffer.get(i)
      const layer = Layers[this._layer!]
      if (!layer) {
        throw new Error(`[controller] layer not found: ${this._layer}`)
      }
      let pairFlags =
        PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_FOUND |
        PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_LOST |
        PHYSX.PxPairFlagEnum.eNOTIFY_CONTACT_POINTS
      const filterData = new PHYSX.PxFilterData(layer.group, layer.mask, pairFlags, 0)
      const shapeFlags = new PHYSX.PxShapeFlags()
      shapeFlags.raise(PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE | PHYSX.PxShapeFlagEnum.eSIMULATION_SHAPE)
      shape.setFlags(shapeFlags)
      shape.setQueryFilterData(filterData)
      shape.setSimulationFilterData(filterData)
    }
    const self = this
    this.actorHandle = this.ctx.world.physics.addActor(actor, {
      controller: true,
      node: self,
      get tag() {
        return self._tag
      },
      playerId: null,
      get onContactStart() {
        return self._onContactStart
      },
      get onContactEnd() {
        return self._onContactEnd
      },
      onTriggerEnter: null,
      onTriggerLeave: null,
    })
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.unmount()
      this.mount()
      return
    }
    if (didMove) {
      this.mesh?.matrix.copy(this.matrix)
      this.mesh?.matrixWorld.copy(this.matrixWorld)
    }
    // if (this.didMove) {
    //   console.log('character position change without move() ????')
    //   const worldPosition = this.getWorldPosition()
    //   this.controller.setFootPosition(worldPosition.toPxExtVec3())
    //   this.didMove = false
    // }
  }

  unmount() {
    if (this.mesh) {
      this.ctx.world.graphics.scene.remove(this.mesh)
    }
    this.actorHandle?.destroy()
    this.actorHandle = null
    this.controller?.release()
    this.controller = null
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._radius = source._radius
    this._height = source._height
    this._visible = source._visible
    this._layer = source._layer
    this._tag = source._tag
    this._onContactStart = source._onContactStart
    this._onContactEnd = source._onContactEnd
    return this
  }

  get radius() {
    return this._radius
  }

  set radius(value) {
    if (value === undefined) value = defaults.radius;
    if (!isNumber(value)) {
      throw new Error('[controller] radius not a number')
    }
    this._radius = value
    this.needsRebuild = true
    this.setDirty()
  }

  get height() {
    return this._height
  }

  set height(value) {
    if (value === undefined) value = defaults.height;
    if (!isNumber(value)) {
      throw new Error('[controller] height not a number')
    }
    this._height = value
    this.needsRebuild = true
    this.setDirty()
  }

  get visible() {
    return this._visible
  }

  set visible(value) {
    if (value === undefined) value = defaults.visible;
    if (!isBoolean(value)) {
      throw new Error('[controller] visible not a boolean')
    }
    this._visible = value
    this.needsRebuild = true
    this.setDirty()
  }

  get layer() {
    return this._layer
  }

  set layer(value) {
    if (value === undefined) value = defaults.layer;
    if (!isLayer(value)) {
      throw new Error(`[controller] invalid layer: ${value}`)
    }
    this._layer = value
    if (this.controller) {
      // TODO: we could just update the PxFilterData tbh
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get tag() {
    return this._tag
  }

  set tag(value) {
    if (value === undefined) value = defaults.tag;
    if (isNumber(value)) {
      value = value + ''
    }
    if (value !== null && !isString(value)) {
      throw new Error('[controller] tag not a string')
    }
    this._tag = value
  }

  get onContactStart() {
    return this._onContactStart
  }

  set onContactStart(value) {
    if (value === undefined) value = defaults.onContactStart;
    if (value !== null && !isFunction(value)) {
      throw new Error('[controller] onContactStart not a function')
    }
    this._onContactStart = value
  }

  get onContactEnd() {
    return this._onContactEnd
  }

  set onContactEnd(value) {
    if (value === undefined) value = defaults.onContactEnd;
    if (value !== null && !isFunction(value)) {
      throw new Error('[controller] onContactEnd not a function')
    }
    this._onContactEnd = value
  }

  get isGrounded() {
    return this.moveFlags.isSet(PHYSX.PxControllerCollisionFlagEnum.eCOLLISION_DOWN)
  }

  get isCeiling() {
    return this.moveFlags.isSet(PHYSX.PxControllerCollisionFlagEnum.eCOLLISION_UP)
  }

  teleport(vec3) {
    if (!vec3?.isVector3) {
      throw new Error('[controller] teleport expected Vector3')
    }
    this.position.copy(vec3)
    this.controller.setFootPosition(vec3.toPxExtVec3())
  }

  move(vec3) {
    if (!vec3?.isVector3) {
      throw new Error('[controller] move expected Vector3')
    }
    if (!this.controller) return
    this.moveFlags = this.controller.move(vec3.toPxVec3(), 0, 1 / 60, this.ctx.world.physics.controllerFilters)
    // this.isGrounded = moveFlags.isSet(PHYSX.PxControllerCollisionFlagEnum.eCOLLISION_DOWN) // prettier-ignore
    const pos = this.controller.getFootPosition()
    this.position.copy(pos)
    this.didMove = true
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get radius() {
          return self.radius
        },
        set radius(value) {
          self.radius = value
        },
        get height() {
          return self.height
        },
        set height(value) {
          self.height = value
        },
        get visible() {
          return self.visible
        },
        set visible(value) {
          self.visible = value
        },
        get layer() {
          return self.layer
        },
        set layer(value) {
          if (value === 'player') {
            throw new Error('[controller] layer invalid: player')
          }
          self.layer = value
        },
        get tag() {
          return self.tag
        },
        set tag(value) {
          self.tag = value
        },
        get onContactStart() {
          return self.onContactStart
        },
        set onContactStart(value) {
          self.onContactStart = value
        },
        get onContactEnd() {
          return self.onContactEnd
        },
        set onContactEnd(value) {
          self.onContactEnd = value
        },
        get isGrounded() {
          return self.isGrounded
        },
        get isCeiling() {
          return self.isCeiling
        },
        teleport(vec3) {
          return self.teleport(vec3)
        },
        move(vec3) {
          return self.move(vec3)
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

function isLayer(value) {
  return layers.includes(value)
}
