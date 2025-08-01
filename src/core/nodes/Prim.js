import * as THREE from '../extras/three'
import { isBoolean, isNumber, isString, isArray } from 'lodash-es'

import { Node, secureRef } from './Node'
import { getTrianglesFromGeometry } from '../extras/getTrianglesFromGeometry'
import { getTextureBytesFromMaterial } from '../extras/getTextureBytesFromMaterial'
import { toVibrantHSL } from '../utils/colorUtils'

const defaults = {
  kind: 'box',
  size: [1, 1, 1],
  color: 'white',
  castShadow: true,
  receiveShadow: true,
  emissive: true,
}

const kinds = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'plane']

// Geometry cache
let geometryCache = new Map()

const getGeometry = (kind) => {
  // All primitives of the same kind share one unit-sized geometry
  if (!geometryCache.has(kind)) {
    let geometry
    
    switch (kind) {
      case 'box':
        geometry = new THREE.BoxGeometry(1, 1, 1)
        break
      case 'sphere':
        geometry = new THREE.SphereGeometry(1, 16, 12)
        break
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(1, 1, 1, 16)
        break
      case 'cone':
        geometry = new THREE.ConeGeometry(1, 1, 16)
        break
      case 'torus':
        geometry = new THREE.TorusGeometry(1, 0.3, 12, 16) // Default tube ratio
        break
      case 'plane':
        geometry = new THREE.PlaneGeometry(1, 1)
        break
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1)
    }
    
    geometryCache.set(kind, geometry)
  }
  
  return geometryCache.get(kind)
}

// Material cache - always returns white material for instancing
let defaultMaterial = null

const getMaterial = () => {
  if (!defaultMaterial) {
    defaultMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.8,
      metalness: 0.2,
    })
  }
  return defaultMaterial
}

export class Prim extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'prim'
    
    this.kind = data.kind
    this.size = data.size
    // Convert color to vibrant HSL for better GPU animation
    const rawColor = data.color !== undefined ? data.color : defaults.color
    this.color = toVibrantHSL(rawColor)
    this.castShadow = data.castShadow
    this.receiveShadow = data.receiveShadow
    this.emissive = data.emissive !== undefined ? data.emissive : defaults.emissive
  }
  
  mount() {
    this.needsRebuild = false
    
    // Get unit-sized geometry for this kind
    const geometry = getGeometry(this._kind)
    
    // Apply size via scale
    this.updateScaleFromSize()
    
    // Always use instance colors
    const material = getMaterial()
    
    // Create mesh
    this.handle = this.ctx.world.stage.insert({
      geometry,
      material,
      linked: true,
      color: new THREE.Color(this._color),
      emissive: this._emissive,
      castShadow: this._castShadow,
      receiveShadow: this._receiveShadow,
      matrix: this.matrixWorld,
      node: this,
    })
  }
  
  updateScaleFromSize() {
    // Apply size as scale transformation
    if (this._kind === 'sphere') {
      // Sphere uses uniform scale
      const radius = this._size[0]
      this.scale.set(radius, radius, radius)
    } else if (this._kind === 'torus') {
      // Torus: major radius as uniform scale, tube ratio handled in geometry
      const radius = this._size[0]
      this.scale.set(radius, radius, radius)
    } else if (this._kind === 'cylinder' || this._kind === 'cone') {
      // Cylinder/cone: radius for X/Z, height for Y
      const radius = this._size[0]
      const height = this._size[1]
      this.scale.set(radius, height, radius)
    } else {
      // Box/plane: direct mapping
      this.scale.set(this._size[0], this._size[1], this._size[2])
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
    }
  }
  
  unmount() {
    this.handle?.destroy()
    this.handle = null
  }
  
  copy(source, recursive) {
    super.copy(source, recursive)
    this._kind = source._kind
    this._size = [...source._size]
    this._color = source._color
    this._emissive = source._emissive
    this._castShadow = source._castShadow
    this._receiveShadow = source._receiveShadow
    return this
  }
  
  applyStats(stats) {
    const geometry = getGeometry(this._kind)
    if (geometry && !stats.geometries.has(geometry.uuid)) {
      stats.geometries.add(geometry.uuid)
      stats.triangles += getTrianglesFromGeometry(geometry)
    }
    const material = getMaterial()
    if (material && !stats.materials.has(material.uuid)) {
      stats.materials.add(material.uuid)
      stats.textureBytes += getTextureBytesFromMaterial(material)
    }
  }
  
  get kind() {
    return this._kind
  }
  
  set kind(value = defaults.kind) {
    if (!isString(value) || !kinds.includes(value)) {
      throw new Error('[prim] kind invalid')
    }
    if (this._kind === value) return
    this._kind = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }
  
  get size() {
    return this._size
  }
  
  set size(value = defaults.size) {
    if (!isArray(value) || value.length < 1 || value.length > 3) {
      throw new Error('[prim] size must be array of 1-3 numbers')
    }
    // Normalize size array
    const normalized = [
      value[0] || 1,
      value[1] || value[0] || 1,
      value[2] || value[0] || 1
    ]
    if (this._size && this._size[0] === normalized[0] && this._size[1] === normalized[1] && this._size[2] === normalized[2]) return
    this._size = normalized
    
    // Update scale instead of rebuilding
    if (this.handle) {
      this.updateScaleFromSize()
      this.setDirty()
    }
  }
  
  get color() {
    return this._color
  }
  
  set color(value = defaults.color) {
    if (!isString(value)) {
      throw new Error('[prim] color must be string')
    }
    // Convert to vibrant HSL
    const vibrantColor = toVibrantHSL(value)
    if (this._color === vibrantColor) return
    this._color = vibrantColor
    if (this.handle) {
      // Update color directly via instance attributes
      if (this.handle.setColor) {
        this.handle.setColor(new THREE.Color(vibrantColor))
      }
    }
  }
  
  get castShadow() {
    return this._castShadow
  }
  
  set castShadow(value = defaults.castShadow) {
    if (!isBoolean(value)) {
      throw new Error('[prim] castShadow not a boolean')
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
      throw new Error('[prim] receiveShadow not a boolean')
    }
    if (this._receiveShadow === value) return
    this._receiveShadow = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }
  
  get emissive() {
    return this._emissive
  }
  
  set emissive(value = defaults.emissive) {
    if (!isBoolean(value)) {
      throw new Error('[prim] emissive not a boolean')
    }
    if (this._emissive === value) return
    this._emissive = value
    if (this.handle) {
      // Update emissive flag directly via instance attributes
      if (this.handle.setEmissive) {
        this.handle.setEmissive(value)
      }
    }
  }
  
  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get kind() {
          return self.kind
        },
        set kind(value) {
          self.kind = value
        },
        get size() {
          return [...self.size]
        },
        set size(value) {
          self.size = value
        },
        get color() {
          return self.color
        },
        set color(value) {
          self.color = value
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
        get emissive() {
          return self.emissive
        },
        set emissive(value) {
          self.emissive = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}