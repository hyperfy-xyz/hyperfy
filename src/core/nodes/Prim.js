import * as THREE from '../extras/three'
import { isBoolean, isNumber, isString, isArray, isObject, isFunction, isEqual } from 'lodash-es'

import { Node, secureRef } from './Node'
import { getTrianglesFromGeometry } from '../extras/getTrianglesFromGeometry'
import { getTextureBytesFromMaterial } from '../extras/getTextureBytesFromMaterial'
import { Layers } from '../extras/Layers'
import { geometryToPxMesh } from '../extras/geometryToPxMesh'

const defaults = {
  type: 'box',
  size: null,
  color: '#ffffff',
  emissive: null,
  emissiveIntensity: 1,
  metalness: 0.2,
  roughness: 0.8,
  opacity: 1,
  transparent: false,
  texture: null,
  castShadow: true,
  receiveShadow: true,
  doubleside: false,
  // physics
  physics: null, // null | 'static' | 'kinematic' | 'dynamic'
  mass: 1,
  linearDamping: 0,
  angularDamping: 0.05,
  staticFriction: 0.6,
  dynamicFriction: 0.6,
  restitution: 0,
  layer: 'environment',
  trigger: false,
  tag: null,
  onContactStart: null,
  onContactEnd: null,
  onTriggerEnter: null,
  onTriggerLeave: null,
}

const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _m1 = new THREE.Matrix4()
const _m2 = new THREE.Matrix4()
const _m3 = new THREE.Matrix4()
const _defaultScale = new THREE.Vector3(1, 1, 1)

const types = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'plane']

const defaultSizes = {
  box: [1, 1, 1], // width, height, depth
  sphere: [0.5], // radius
  cylinder: [0.5, 0.5, 1], // radiusTop, radiusBtm, height
  cone: [0.5, 1], // radius, height
  torus: [0.4, 0.1], // innerRadius, tubeRadius
  plane: [1, 1], // width, height
}

// Geometry cache
let geometryCache = new Map()

const getGeometry = (type, size) => {
  // All primitives of the same type share one unit-sized geometry
  const key = `${type}${size}`
  let geometry = geometryCache.get(key)
  if (!geometry) {
    switch (type) {
      case 'box':
        {
          const [width, height, depth] = size
          geometry = new THREE.BoxGeometry(width, height, depth)
        }
        break
      case 'sphere':
        {
          const [radius] = size
          geometry = new THREE.SphereGeometry(radius, 16, 12)
        }
        break
      case 'cylinder':
        {
          const [radiusTop, radiusBtm, height] = size
          geometry = new THREE.CylinderGeometry(radiusTop, radiusBtm, height, 16)
        }
        break
      case 'cone':
        {
          const [radius, height] = size
          geometry = new THREE.ConeGeometry(radius, height, 16)
        }
        break
      case 'torus':
        {
          const [innerRadius, tubeRadius] = size
          geometry = new THREE.TorusGeometry(innerRadius, tubeRadius, 12, 16)
        }
        break
      case 'plane':
        {
          const [width, height] = size
          geometry = new THREE.PlaneGeometry(width, height)
        }
        break
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1)
    }
    geometryCache.set(key, geometry)
  }
  return geometryCache.get(key)
}

// Material cache - reuse materials with identical properties
const materialCache = new Map()

// Create material with specific properties
const createMaterial = async (props, loader) => {
  // Create a cache key from material properties
  const cacheKey = `${props.color}_${props.emissive}_${props.emissiveIntensity}_${props.metalness}_${props.roughness}_${props.opacity}_${props.transparent}_${props.texture}_${props.doubleside}`

  // Check cache first
  if (materialCache.has(cacheKey)) {
    return materialCache.get(cacheKey)
  }

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(props.color),
    emissive: props.emissive ? new THREE.Color(props.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: props.emissiveIntensity,
    metalness: props.metalness,
    roughness: props.roughness,
    opacity: props.opacity,
    transparent: props.transparent,
    side: props.doubleside ? THREE.DoubleSide : THREE.FrontSide,
  })

  // Load texture if provided
  if (props.texture && loader) {
    try {
      // Check if texture is already loaded
      let texture = loader.get('texture', props.texture)
      if (!texture) {
        // Load the texture
        texture = await loader.load('texture', props.texture)
      }
      if (texture) {
        material.map = texture
        material.needsUpdate = true
      }
    } catch (err) {
      console.warn('[prim] Failed to load texture:', props.texture, err)
    }
  }

  // Cache the material
  materialCache.set(cacheKey, material)

  return material
}

export class Prim extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'prim'

    this.type = data.type
    this.size = data.size
    this.color = data.color
    this.emissive = data.emissive
    this.emissiveIntensity = data.emissiveIntensity
    this.metalness = data.metalness
    this.roughness = data.roughness
    this.opacity = data.opacity
    this.transparent = data.transparent
    this.texture = data.texture
    this.castShadow = data.castShadow
    this.receiveShadow = data.receiveShadow
    this.doubleside = data.doubleside
    // Physics properties
    this.physics = data.physics
    this.mass = data.mass
    this.linearDamping = data.linearDamping
    this.angularDamping = data.angularDamping
    this.staticFriction = data.staticFriction
    this.dynamicFriction = data.dynamicFriction
    this.restitution = data.restitution
    this.layer = data.layer
    this.trigger = data.trigger
    this.tag = data.tag
    this.onContactStart = data.onContactStart
    this.onContactEnd = data.onContactEnd
    this.onTriggerEnter = data.onTriggerEnter
    this.onTriggerLeave = data.onTriggerLeave

    // Physics state
    this.shapes = new Set()
    this._tm = null
    this.tempVec3 = new THREE.Vector3()
    this.tempQuat = new THREE.Quaternion()
  }

  async mount() {
    this.needsRebuild = false

    // Get unit-sized geometry for this type
    const geometry = getGeometry(this._type, this._size)

    // Get loader if available (client-side only)
    const loader = this.ctx.world.loader || null

    // Create material with current properties
    const material = await createMaterial(
      {
        color: this._color,
        emissive: this._emissive,
        emissiveIntensity: this._emissiveIntensity,
        metalness: this._metalness,
        roughness: this._roughness,
        opacity: this._opacity,
        transparent: this._transparent,
        texture: this._texture,
        doubleside: this._doubleside,
      },
      loader
    )

    // Create mesh
    this.handle = this.ctx.world.stage.insertPrimitive({
      geometry,
      material,
      castShadow: this._castShadow,
      receiveShadow: this._receiveShadow,
      matrix: this.matrixWorld,
      node: this,
    })

    // Create physics if enabled
    if (this._physics && !this.ctx.moving) {
      this.mountPhysics()
    }
  }

  mountPhysics() {
    if (!PHYSX) return

    const type = this._physics // 'static' | 'kinematic' | 'dynamic'
    const mass = this._mass
    const linearDamping = this._linearDamping
    const angularDamping = this._angularDamping
    const trigger = this._trigger

    // Create transform
    this.matrixWorld.decompose(_v1, _q1, _v2)
    if (!this._tm) this._tm = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
    _v1.toPxTransform(this._tm)
    _q1.toPxTransform(this._tm)

    // Create actor
    if (type === 'static') {
      this.actor = this.ctx.world.physics.physics.createRigidStatic(this._tm)
    } else if (type === 'kinematic') {
      this.actor = this.ctx.world.physics.physics.createRigidDynamic(this._tm)
      this.actor.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, true)
      PHYSX.PxRigidBodyExt.prototype.setMassAndUpdateInertia(this.actor, mass)
    } else if (type === 'dynamic') {
      this.actor = this.ctx.world.physics.physics.createRigidDynamic(this._tm)
      PHYSX.PxRigidBodyExt.prototype.setMassAndUpdateInertia(this.actor, mass)
      this.actor.setLinearDamping(linearDamping)
      this.actor.setAngularDamping(angularDamping)
    }

    // Create collider shape
    let pxGeometry = null
    let pmesh = null

    if (this._type === 'box') {
      const [width, height, depth] = this._size
      pxGeometry = new PHYSX.PxBoxGeometry((width / 2) * _v2.x, (height / 2) * _v2.y, (depth / 2) * _v2.z)
    } else if (this._type === 'sphere' && isUniformScale(_v2)) {
      const [radius] = this._size
      pxGeometry = new PHYSX.PxSphereGeometry(radius * _v2.x)
    } else {
      // Use convex mesh for cylinder, cone, torus, and plane
      const threeGeometry = getGeometry(this._type, this._size)

      // Create convex mesh
      pmesh = geometryToPxMesh(this.ctx.world, threeGeometry, true)
      if (pmesh && pmesh.value) {
        const scale = new PHYSX.PxMeshScale(new PHYSX.PxVec3(_v2.x, _v2.y, _v2.z), new PHYSX.PxQuat(0, 0, 0, 1))
        pxGeometry = new PHYSX.PxConvexMeshGeometry(pmesh.value, scale)
        this.pmesh = pmesh // Store for cleanup
      } else {
        // TODO: think we can remove this? why would this happen?
        console.warn(`[prim] Failed to create convex mesh for ${this._type}, falling back to box`)
        const boxSize = this.getColliderSize()
        pxGeometry = new PHYSX.PxBoxGeometry(boxSize[0] / 2, boxSize[1] / 2, boxSize[2] / 2)
      }
    }

    // Get material
    const staticFriction = this._staticFriction
    const dynamicFriction = this._dynamicFriction
    const restitution = this._restitution
    const material = this.ctx.world.physics.getMaterial(staticFriction, dynamicFriction, restitution)

    // Create shape flags
    const flags = new PHYSX.PxShapeFlags()
    if (trigger) {
      flags.raise(PHYSX.PxShapeFlagEnum.eTRIGGER_SHAPE)
    } else {
      flags.raise(PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE | PHYSX.PxShapeFlagEnum.eSIMULATION_SHAPE)
    }

    // Create shape
    this.shape = this.ctx.world.physics.physics.createShape(pxGeometry, material, true, flags)

    // Set filter data
    const layerName = this._layer
    const layer = Layers[layerName]
    let pairFlags = PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_FOUND | PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_LOST
    if (!trigger) {
      pairFlags |= PHYSX.PxPairFlagEnum.eNOTIFY_CONTACT_POINTS
    }
    const filterData = new PHYSX.PxFilterData(layer.group, layer.mask, pairFlags, 0)
    this.shape.setQueryFilterData(filterData)
    this.shape.setSimulationFilterData(filterData)

    // const position = _v1.copy(this.position).multiply(this.parent.scale)
    // const pose = new PHYSX.PxTransform()
    // position.toPxTransform(pose)
    // this.quaternion.toPxTransform(pose)
    // this.shape.setLocalPose(pose)

    // Attach shape to actor
    this.actor.attachShape(this.shape)
    this.shapes.add(this.shape)

    // Add to physics world
    const self = this
    const playerId = this.ctx.entity?.isPlayer ? this.ctx.entity.data.id : null
    this.actorHandle = this.ctx.world.physics.addActor(this.actor, {
      onInterpolate: type === 'kinematic' || type === 'dynamic' ? this.onInterpolate : null,
      node: this,
      get tag() {
        return self._tag
      },
      get playerId() {
        return playerId
      },
      get onContactStart() {
        return self._onContactStart
      },
      get onContactEnd() {
        return self._onContactEnd
      },
      get onTriggerEnter() {
        return self._onTriggerEnter
      },
      get onTriggerLeave() {
        return self._onTriggerLeave
      },
    })

    // Clean up
    PHYSX.destroy(pxGeometry)
  }

  unmountPhysics() {
    if (this.actor) {
      this.actorHandle?.destroy()
      this.actorHandle = null
      this.shapes.clear()
      this.shape?.release()
      this.shape = null
      this.actor.release()
      this.actor = null
    }
    if (this.pmesh) {
      this.pmesh.release()
      this.pmesh = null
    }
  }

  onInterpolate = (position, quaternion) => {
    if (this.parent) {
      _m1.compose(position, quaternion, _defaultScale)
      _m2.copy(this.parent.matrixWorld).invert()
      _m3.multiplyMatrices(_m2, _m1)
      _m3.decompose(this.position, this.quaternion, _v1)
    } else {
      this.position.copy(position)
      this.quaternion.copy(quaternion)
    }
  }

  getColliderSize() {
    // Returns appropriate collider dimensions
    switch (this._type) {
      case 'cylinder':
        return [this.scale.x * 2, this.scale.y, this.scale.z * 2]
      case 'cone':
        return [this.scale.x * 2, this.scale.y, this.scale.z * 2]
      case 'torus':
        const diameter = (this.scale.x + this.scale.x * 0.3) * 2
        return [diameter, this.scale.x * 0.3 * 2, diameter]
      default:
        return [this.scale.x, this.scale.y, this.scale.z]
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
      if (this.actorHandle) {
        this.actorHandle.move(this.matrixWorld)
      }
    }
  }

  unmount() {
    this.handle?.destroy()
    this.handle = null
    this.unmountPhysics()
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._type = source._type
    this._size = source._size
    this._color = source._color
    this._emissive = source._emissive
    this._emissiveIntensity = source._emissiveIntensity
    this._metalness = source._metalness
    this._roughness = source._roughness
    this._opacity = source._opacity
    this._transparent = source._transparent
    this._texture = source._texture
    this._castShadow = source._castShadow
    this._receiveShadow = source._receiveShadow
    this._doubleside = source._doubleside
    // Physics properties
    this._physics = source._physics
    this._mass = source._mass
    this._linearDamping = source._linearDamping
    this._angularDamping = source._angularDamping
    this._staticFriction = source._staticFriction
    this._dynamicFriction = source._dynamicFriction
    this._restitution = source._restitution
    this._layer = source._layer
    this._trigger = source._trigger
    this._tag = source._tag
    this._onContactStart = source._onContactStart
    this._onContactEnd = source._onContactEnd
    this._onTriggerEnter = source._onTriggerEnter
    this._onTriggerLeave = source._onTriggerLeave
    return this
  }

  applyStats(stats) {
    const geometry = getGeometry(this._type)
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

  get type() {
    return this._type
  }

  set type(value = defaults.type) {
    if (!isString(value) || !types.includes(value)) {
      throw new Error('[prim] type invalid')
    }
    if (this._type === value) return
    this._type = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get size() {
    return this._size
  }

  set size(value) {
    if (value === null || value === undefined) {
      value = defaultSizes[this._type].slice()
    }
    if (!isArray(value)) {
      throw new Error('[prim] size must be an array')
    }
    if (isEqual(this._size, value)) return
    this._size = value
    if (this.handle) {
      this.needsRebuild = true
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
    if (this._color === value) return
    this._color = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get emissive() {
    return this._emissive
  }

  set emissive(value = defaults.emissive) {
    if (value !== null && !isString(value)) {
      throw new Error('[prim] emissive must be string or null')
    }
    if (this._emissive === value) return
    this._emissive = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
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

  get emissiveIntensity() {
    return this._emissiveIntensity
  }

  set emissiveIntensity(value = defaults.emissiveIntensity) {
    if (!isNumber(value) || value < 0) {
      throw new Error('[prim] emissiveIntensity must be positive number')
    }
    if (this._emissiveIntensity === value) return
    this._emissiveIntensity = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get metalness() {
    return this._metalness
  }

  set metalness(value = defaults.metalness) {
    if (!isNumber(value) || value < 0 || value > 1) {
      throw new Error('[prim] metalness must be number between 0 and 1')
    }
    if (this._metalness === value) return
    this._metalness = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get roughness() {
    return this._roughness
  }

  set roughness(value = defaults.roughness) {
    if (!isNumber(value) || value < 0 || value > 1) {
      throw new Error('[prim] roughness must be number between 0 and 1')
    }
    if (this._roughness === value) return
    this._roughness = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get opacity() {
    return this._opacity
  }

  set opacity(value = defaults.opacity) {
    if (!isNumber(value) || value < 0 || value > 1) {
      throw new Error('[prim] opacity must be number between 0 and 1')
    }
    if (this._opacity === value) return
    this._opacity = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get transparent() {
    return this._transparent
  }

  set transparent(value = defaults.transparent) {
    if (!isBoolean(value)) {
      throw new Error('[prim] transparent must be boolean')
    }
    if (this._transparent === value) return
    this._transparent = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get texture() {
    return this._texture
  }

  set texture(value = defaults.texture) {
    if (value !== null && !isString(value)) {
      throw new Error('[prim] texture must be string or null')
    }
    if (this._texture === value) return
    this._texture = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get physics() {
    return this._physics
  }

  set physics(value = defaults.physics) {
    if (value !== null && value !== 'static' && value !== 'kinematic' && value !== 'dynamic') {
      throw new Error('[prim] physics must be null, "static", "kinematic", or "dynamic"')
    }
    if (this._physics === value) return
    this._physics = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get mass() {
    return this._mass
  }

  set mass(value = defaults.mass) {
    if (!isNumber(value) || value <= 0) {
      throw new Error('[prim] mass must be positive number')
    }
    if (this._mass === value) return
    this._mass = value
    if (this.handle && this._physics) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get linearDamping() {
    return this._linearDamping
  }

  set linearDamping(value = defaults.linearDamping) {
    if (!isNumber(value) || value < 0) {
      throw new Error('[prim] linearDamping must be non-negative number')
    }
    if (this._linearDamping === value) return
    this._linearDamping = value
    if (this.handle && this._physics) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get angularDamping() {
    return this._angularDamping
  }

  set angularDamping(value = defaults.angularDamping) {
    if (!isNumber(value) || value < 0) {
      throw new Error('[prim] angularDamping must be non-negative number')
    }
    if (this._angularDamping === value) return
    this._angularDamping = value
    if (this.handle && this._physics) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get staticFriction() {
    return this._staticFriction
  }

  set staticFriction(value = defaults.staticFriction) {
    if (!isNumber(value) || value < 0 || value > 1) {
      throw new Error('[prim] staticFriction must be number between 0 and 1')
    }
    if (this._staticFriction === value) return
    this._staticFriction = value
    if (this.handle && this._physics) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get dynamicFriction() {
    return this._dynamicFriction
  }

  set dynamicFriction(value = defaults.dynamicFriction) {
    if (!isNumber(value) || value < 0 || value > 1) {
      throw new Error('[prim] dynamicFriction must be number between 0 and 1')
    }
    if (this._dynamicFriction === value) return
    this._dynamicFriction = value
    if (this.handle && this._physics) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get restitution() {
    return this._restitution
  }

  set restitution(value = defaults.restitution) {
    if (!isNumber(value) || value < 0 || value > 1) {
      throw new Error('[prim] restitution must be number between 0 and 1')
    }
    if (this._restitution === value) return
    this._restitution = value
    if (this.handle && this._physics) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get layer() {
    return this._layer
  }

  set layer(value = defaults.layer) {
    if (!isString(value)) {
      throw new Error('[prim] layer must be string')
    }
    if (this._layer === value) return
    this._layer = value
    if (this.handle && this._physics) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get trigger() {
    return this._trigger
  }

  set trigger(value = defaults.trigger) {
    if (!isBoolean(value)) {
      throw new Error('[prim] trigger must be boolean')
    }
    if (this._trigger === value) return
    this._trigger = value
    if (this.handle && this._physics) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get tag() {
    return this._tag
  }

  set tag(value = defaults.tag) {
    if (value !== null && !isString(value)) {
      throw new Error('[prim] tag must be string or null')
    }
    if (this._tag === value) return
    this._tag = value
    // Tag can be updated without rebuild since it uses getter
  }

  get onContactStart() {
    return this._onContactStart
  }

  set onContactStart(value = defaults.onContactStart) {
    if (value !== null && typeof value !== 'function') {
      throw new Error('[prim] onContactStart must be function or null')
    }
    this._onContactStart = value
    // Callbacks can be updated without rebuild since they use getters
  }

  get onContactEnd() {
    return this._onContactEnd
  }

  set onContactEnd(value = defaults.onContactEnd) {
    if (value !== null && typeof value !== 'function') {
      throw new Error('[prim] onContactEnd must be function or null')
    }
    this._onContactEnd = value
    // Callbacks can be updated without rebuild since they use getters
  }

  get onTriggerEnter() {
    return this._onTriggerEnter
  }

  set onTriggerEnter(value = defaults.onTriggerEnter) {
    if (value !== null && typeof value !== 'function') {
      throw new Error('[prim] onTriggerEnter must be function or null')
    }
    this._onTriggerEnter = value
    // Callbacks can be updated without rebuild since they use getters
  }

  get onTriggerLeave() {
    return this._onTriggerLeave
  }

  set onTriggerLeave(value = defaults.onTriggerLeave) {
    if (value !== null && typeof value !== 'function') {
      throw new Error('[prim] onTriggerLeave must be function or null')
    }
    this._onTriggerLeave = value
    // Callbacks can be updated without rebuild since they use getters
  }

  get doubleside() {
    return this._doubleside
  }

  set doubleside(value = defaults.doubleside) {
    if (!isBoolean(value)) {
      throw new Error('[prim] doubleside must be boolean')
    }
    if (this._doubleside === value) return
    this._doubleside = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
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
        get size() {
          return self.size
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
        get emissive() {
          return self.emissive
        },
        set emissive(value) {
          self.emissive = value
        },
        get emissiveIntensity() {
          return self.emissiveIntensity
        },
        set emissiveIntensity(value) {
          self.emissiveIntensity = value
        },
        get metalness() {
          return self.metalness
        },
        set metalness(value) {
          self.metalness = value
        },
        get roughness() {
          return self.roughness
        },
        set roughness(value) {
          self.roughness = value
        },
        get opacity() {
          return self.opacity
        },
        set opacity(value) {
          self.opacity = value
        },
        get transparent() {
          return self.transparent
        },
        set transparent(value) {
          self.transparent = value
        },
        get texture() {
          return self.texture
        },
        set texture(value) {
          self.texture = value
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
        get physics() {
          return self.physics
        },
        set physics(value) {
          self.physics = value
        },
        get mass() {
          return self.mass
        },
        set mass(value) {
          self.mass = value
        },
        get linearDamping() {
          return self.linearDamping
        },
        set linearDamping(value) {
          self.linearDamping = value
        },
        get angularDamping() {
          return self.angularDamping
        },
        set angularDamping(value) {
          self.angularDamping = value
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
        get layer() {
          return self.layer
        },
        set layer(value) {
          self.layer = value
        },
        get trigger() {
          return self.trigger
        },
        set trigger(value) {
          self.trigger = value
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
        get onTriggerEnter() {
          return self.onTriggerEnter
        },
        set onTriggerEnter(value) {
          self.onTriggerEnter = value
        },
        get onTriggerLeave() {
          return self.onTriggerLeave
        },
        set onTriggerLeave(value) {
          self.onTriggerLeave = value
        },
        get doubleside() {
          return self.doubleside
        },
        set doubleside(value) {
          self.doubleside = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

function isUniformScale(vec3) {
  return vec3.x === vec3.y && vec3.y === vec3.z
}
