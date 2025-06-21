import * as THREE from '../extras/three'
import { isBoolean, isNumber } from 'lodash-es'

import { Node, secureRef } from './Node'
import { getTrianglesFromGeometry } from '../extras/getTrianglesFromGeometry'
import { getTextureBytesFromMaterial } from '../extras/getTextureBytesFromMaterial'

const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()

const defaults = {
  type: 'box',
  width: 1,
  height: 1,
  depth: 1,
  radius: 0.5,
  radiusTop: 0.5,
  radiusBottom: 0.5,
  radialSegments: 8,
  geometry: null,
  material: null,
  linked: true,
  castShadow: true,
  receiveShadow: true,
  visible: true, // DEPRECATED: use Node.active
}

const types = ['box', 'sphere', 'cylinder', 'cone', 'geometry']

let boxes = {}
const getBox = (width, height, depth) => {
  const key = `${width},${height},${depth}`
  if (!boxes[key]) {
    boxes[key] = new THREE.BoxGeometry(width, height, depth)
  }
  return boxes[key]
}

let spheres = {}
const getSphere = radius => {
  const key = radius
  if (!spheres[key]) {
    spheres[key] = new THREE.SphereGeometry(radius, 16, 12)
  }
  return spheres[key]
}

let cylinders = {}
const getCylinder = (radiusTop, radiusBottom, height, radialSegments) => {
  const key = `${radiusTop},${radiusBottom},${height},${radialSegments}`
  if (!cylinders[key]) {
    cylinders[key] = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
  }
  return cylinders[key]
}

let cones = {}
const getCone = (radius, height, radialSegments) => {
  const key = `${radius},${height},${radialSegments}`
  if (!cones[key]) {
    cones[key] = new THREE.ConeGeometry(radius, height, radialSegments)
  }
  return cones[key]
}

export class Mesh extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'mesh'

    this.type = data.type
    this.width = data.width
    this.height = data.height
    this.depth = data.depth
    this.radius = data.radius
    this.radiusTop = data.radiusTop
    this.radiusBottom = data.radiusBottom
    this.radialSegments = data.radialSegments
    this.geometry = data.geometry
    this.material = data.material
    this.linked = data.linked
    this.castShadow = data.castShadow
    this.receiveShadow = data.receiveShadow
    this.visible = data.visible
    
    // Store pending material properties until handle is created
    this._pendingMaterialProps = {}
  }

  mount() {
    this.needsRebuild = false
    let geometry
    if (this._type === 'box') {
      geometry = getBox(this._width, this._height, this._depth)
    } else if (this._type === 'sphere') {
      geometry = getSphere(this._radius)
    } else if (this._type === 'cylinder') {
      geometry = getCylinder(this._radiusTop, this._radiusBottom, this._height, this._radialSegments)
    } else if (this._type === 'cone') {
      geometry = getCone(this._radius, this._height, this._radialSegments)
    } else if (this._type === 'geometry') {
      geometry = this._geometry
    }
    
    // Ensure we have geometry
    if (!geometry) {
      console.warn('[Mesh] No geometry available for type:', this._type)
      return
    }
    // Ensure we have a material, create default if needed
    let material = this._material
    if (!material) {
      const defaultMat = this.ctx.world.stage.getDefaultMaterial()
      material = defaultMat.raw  // Use the raw THREE.js material
    }
    if (this._visible) {
      this.handle = this.ctx.world.stage.insert({
        geometry,
        material,
        linked: this._linked,
        castShadow: this._castShadow,
        receiveShadow: this._receiveShadow,
        matrix: this.matrixWorld,
        node: this,
      })
      // Apply any pending material properties
      if (this.handle && this.handle.material && this._pendingMaterialProps) {
        for (const [key, value] of Object.entries(this._pendingMaterialProps)) {
          if (key in this.handle.material) {
            this.handle.material[key] = value
          }
        }
        this._pendingMaterialProps = {}
      }
    } else {
      this.sItem = {
        matrix: this.matrixWorld,
        geometry,
        material,
        getEntity: () => this.ctx.entity,
        node: this,
      }
      this.ctx.world.stage.octree.insert(this.sItem)
    }
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.unmount()
      this.mount()
      return
    }
    if (didMove) {
      if (this.handle) {
        this.handle.move(this.matrixWorld)
      }
      if (this.sItem) {
        this.ctx.world.stage.octree.move(this.sItem)
      }
    }
  }

  unmount() {
    this.handle?.destroy()
    if (this.sItem) {
      this.ctx.world.stage.octree.remove(this.sItem)
      this.sItem = null
    }
    this.handle = null
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._type = source._type
    this._width = source._width
    this._height = source._height
    this._depth = source._depth
    this._radius = source._radius
    this._radiusTop = source._radiusTop
    this._radiusBottom = source._radiusBottom
    this._radialSegments = source._radialSegments
    this._geometry = source._geometry
    this._material = source._material
    this._linked = source._linked
    this._castShadow = source._castShadow
    this._receiveShadow = source._receiveShadow
    this._visible = source._visible
    return this
  }

  applyStats(stats) {
    if (this._geometry && !stats.geometries.has(this._geometry.uuid)) {
      stats.geometries.add(this._geometry.uuid)
      stats.triangles += getTrianglesFromGeometry(this._geometry)
    }
    if (this._material && !stats.materials.has(this._material.uuid)) {
      stats.materials.add(this._material.uuid)
      stats.textureBytes += getTextureBytesFromMaterial(this._material)
    }
  }

  get type() {
    return this._type
  }

  set type(value = defaults.type) {
    if (!isType(value)) {
      throw new Error('[mesh] type invalid')
    }
    if (this._type === value) return
    this._type = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get width() {
    return this._width
  }

  set width(value = defaults.width) {
    if (!isNumber(value)) {
      throw new Error('[mesh] width not a number')
    }
    if (this._width === value) return
    this._width = value
    if (this.handle && this._type === 'box') {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get height() {
    return this._height
  }

  set height(value = defaults.height) {
    if (!isNumber(value)) {
      throw new Error('[mesh] height not a number')
    }
    if (this._height === value) return
    this._height = value
    if (this.handle && (this._type === 'box' || this._type === 'cylinder' || this._type === 'cone')) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get depth() {
    return this._depth
  }

  set depth(value = defaults.depth) {
    if (!isNumber(value)) {
      throw new Error('[mesh] depth not a number')
    }
    if (this._depth === value) return
    this._depth = value
    if (this.handle && this._type === 'box') {
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
      throw new Error('[mesh] radius not a number')
    }
    if (this._radius === value) return
    this._radius = value
    if (this.handle && (this._type === 'sphere' || this._type === 'cone')) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get radiusTop() {
    return this._radiusTop
  }

  set radiusTop(value = defaults.radiusTop) {
    if (!isNumber(value)) {
      throw new Error('[mesh] radiusTop not a number')
    }
    if (this._radiusTop === value) return
    this._radiusTop = value
    if (this.handle && this._type === 'cylinder') {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get radiusBottom() {
    return this._radiusBottom
  }

  set radiusBottom(value = defaults.radiusBottom) {
    if (!isNumber(value)) {
      throw new Error('[mesh] radiusBottom not a number')
    }
    if (this._radiusBottom === value) return
    this._radiusBottom = value
    if (this.handle && this._type === 'cylinder') {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get radialSegments() {
    return this._radialSegments
  }

  set radialSegments(value = defaults.radialSegments) {
    if (!isNumber(value)) {
      throw new Error('[mesh] radialSegments not a number')
    }
    if (this._radialSegments === value) return
    this._radialSegments = value
    if (this.handle && (this._type === 'cylinder' || this._type === 'cone')) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get geometry() {
    return secureRef({}, () => this._geometry)
  }

  set geometry(value = defaults.geometry) {
    if (value && !value.isBufferGeometry) {
      throw new Error('[mesh] geometry invalid')
    }
    if (this._geometry === value) return
    this._geometry = value
    this.needsRebuild = true
    this.setDirty()
  }

  get material() {
    return this.handle?.material
  }

  set material(value = defaults.material) {
    if (value && !value.isMaterial) {
      throw new Error('[mesh] material invalid')
    }
    if (this._material === value) return
    this._material = value
    this.needsRebuild = true
    this.setDirty()
  }

  get linked() {
    return this._linked
  }

  set linked(value = defaults.linked) {
    if (!isBoolean(value)) {
      throw new Error('[mesh] linked not a boolean')
    }
    if (this._linked === value) return
    this._linked = value
    this.needsRebuild = true
    this.setDirty()
  }

  get castShadow() {
    return this._castShadow
  }

  set castShadow(value = defaults.castShadow) {
    if (!isBoolean(value)) {
      throw new Error('[mesh] castShadow not a boolean')
    }
    if (this._castShadow === value) return
    this._castShadow = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get receiveShadow() {
    return this._receiveShadow
  }

  set receiveShadow(value = defaults.receiveShadow) {
    if (!isBoolean(value)) {
      throw new Error('[mesh] receiveShadow not a boolean')
    }
    if (this._receiveShadow === value) return
    this._receiveShadow = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get visible() {
    return this._visible
  }

  set visible(value = defaults.visible) {
    if (!isBoolean(value)) {
      throw new Error('[mesh] visible not a boolean')
    }
    if (this._visible === value) return
    this._visible = value
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
        get radiusTop() {
          return self.radiusTop
        },
        set radiusTop(value) {
          self.radiusTop = value
        },
        get radiusBottom() {
          return self.radiusBottom
        },
        set radiusBottom(value) {
          self.radiusBottom = value
        },
        get radialSegments() {
          return self.radialSegments
        },
        set radialSegments(value) {
          self.radialSegments = value
        },
        get geometry() {
          return self.geometry
        },
        set geometry(value) {
          self.geometry = value
        },
        get material() {
          // If handle exists, return the actual material proxy
          if (self.handle && self.handle.material) {
            return self.handle.material
          }
          // Otherwise return a temporary proxy that stores properties
          if (!self._tempMaterialProxy) {
            self._tempMaterialProxy = new Proxy({}, {
              set(target, prop, value) {
                self._pendingMaterialProps[prop] = value
                return true
              },
              get(target, prop) {
                return self._pendingMaterialProps[prop]
              }
            })
          }
          return self._tempMaterialProxy
        },
        set material(value) {
          throw new Error('[mesh] set material not supported')
          // if (!value) throw new Error('[mesh] material cannot be unset')
          // self.ctx.world._allowMaterial = true
          // self.material = value._ref
          // self.ctx.world._allowMaterial = false
          // self.needsRebuild = true
          // self.setDirty()
        },
        get linked() {
          return self.linked
        },
        set linked(value) {
          self.linked = value
        },
        get castShadow() {
          return self.castShadow
        },
        set castShadow(value) {
          self.castShadow = value
        },
        get receiveShadow() {
          return self.receiveShadow
        },
        set receiveShadow(value) {
          self.receiveShadow = value
        },
        get visible() {
          return self.visible
        },
        set visible(value) {
          self.visible = value
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
