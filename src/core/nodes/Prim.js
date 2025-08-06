import * as THREE from '../extras/three'
import { isBoolean, isNumber, isString, isArray, isObject, isFunction } from 'lodash-es'

import { Node, secureRef } from './Node'
import { getTrianglesFromGeometry } from '../extras/getTrianglesFromGeometry'
import { getTextureBytesFromMaterial } from '../extras/getTextureBytesFromMaterial'
import { Layers } from '../extras/Layers'
import { geometryToPxMesh } from '../extras/geometryToPxMesh'

const defaults = {
  type: 'box',
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
  // Physics properties
  physics: null, // null | 'static' | 'kinematic' | 'dynamic'
  physicsMass: 1,
  physicsLinearDamping: 0,
  physicsAngularDamping: 0.05,
  physicsStaticFriction: 0.6,
  physicsDynamicFriction: 0.6,
  physicsRestitution: 0,
  physicsLayer: 'environment',
  physicsTrigger: false,
  physicsTag: null,
  physicsOnContactStart: null,
  physicsOnContactEnd: null,
  physicsOnTriggerEnter: null,
  physicsOnTriggerLeave: null,
}

const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _m1 = new THREE.Matrix4()
const _m2 = new THREE.Matrix4()
const _m3 = new THREE.Matrix4()
const _defaultScale = new THREE.Vector3(1, 1, 1)

const types = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'plane']

// Geometry cache
let geometryCache = new Map()

const getGeometry = type => {
  // All primitives of the same type share one unit-sized geometry
  if (!geometryCache.has(type)) {
    let geometry

    switch (type) {
      case 'box':
        geometry = new THREE.BoxGeometry(1, 1, 1)
        // Translate geometry so bottom is at y=0
        geometry.translate(0, 0.5, 0)
        break
      case 'sphere':
        geometry = new THREE.SphereGeometry(1, 16, 12)
        // Translate geometry so bottom is at y=0
        geometry.translate(0, 1, 0)
        break
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(1, 1, 1, 16)
        // Translate geometry so bottom is at y=0
        geometry.translate(0, 0.5, 0)
        break
      case 'cone':
        geometry = new THREE.ConeGeometry(1, 1, 16)
        // Translate geometry so bottom is at y=0
        geometry.translate(0, 0.5, 0)
        break
      case 'torus':
        geometry = new THREE.TorusGeometry(1, 0.3, 12, 16) // Default tube ratio
        // Translate geometry so bottom is at y=0
        // Bottom of torus is at -(majorRadius + tubeRadius) = -(1 + 0.3) = -1.3
        geometry.translate(0, 1.3, 0)
        break
      case 'plane':
        geometry = new THREE.PlaneGeometry(1, 1)
        // Keep plane centered
        break
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1)
        geometry.translate(0, 0.5, 0)
    }

    geometryCache.set(type, geometry)
  }

  return geometryCache.get(type)
}

// Material cache - reuse materials with identical properties
const materialCache = new Map()

// Create material with specific properties
const createMaterial = async (props, loader) => {
  // Create a cache key from material properties
  const cacheKey = `${props.color || '#ffffff'}_${props.emissive || 'null'}_${props.emissiveIntensity || 1}_${props.metalness !== undefined ? props.metalness : 0.2}_${props.roughness !== undefined ? props.roughness : 0.8}_${props.opacity !== undefined ? props.opacity : 1}_${props.transparent || false}_${props.texture || 'null'}_${props.doubleside || false}`

  // Check cache first
  if (materialCache.has(cacheKey)) {
    return materialCache.get(cacheKey)
  }

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(props.color || '#ffffff'),
    emissive: props.emissive ? new THREE.Color(props.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: props.emissiveIntensity || 1,
    metalness: props.metalness !== undefined ? props.metalness : 0.2,
    roughness: props.roughness !== undefined ? props.roughness : 0.8,
    opacity: props.opacity !== undefined ? props.opacity : 1,
    transparent: props.transparent || false,
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
    this.color = data.color !== undefined ? data.color : defaults.color
    this.emissive = data.emissive !== undefined ? data.emissive : defaults.emissive
    this.emissiveIntensity = data.emissiveIntensity !== undefined ? data.emissiveIntensity : defaults.emissiveIntensity
    this.metalness = data.metalness !== undefined ? data.metalness : defaults.metalness
    this.roughness = data.roughness !== undefined ? data.roughness : defaults.roughness
    this.opacity = data.opacity !== undefined ? data.opacity : defaults.opacity
    this.transparent = data.transparent !== undefined ? data.transparent : defaults.transparent
    this.texture = data.texture !== undefined ? data.texture : defaults.texture
    this.castShadow = data.castShadow
    this.receiveShadow = data.receiveShadow
    this.doubleside = data.doubleside
    // Physics properties
    this.physics = data.physics
    this.physicsMass = data.physicsMass
    this.physicsLinearDamping = data.physicsLinearDamping
    this.physicsAngularDamping = data.physicsAngularDamping
    this.physicsStaticFriction = data.physicsStaticFriction
    this.physicsDynamicFriction = data.physicsDynamicFriction
    this.physicsRestitution = data.physicsRestitution
    this.physicsLayer = data.physicsLayer
    this.physicsTrigger = data.physicsTrigger
    this.physicsTag = data.physicsTag
    this.physicsOnContactStart = data.physicsOnContactStart
    this.physicsOnContactEnd = data.physicsOnContactEnd
    this.physicsOnTriggerEnter = data.physicsOnTriggerEnter
    this.physicsOnTriggerLeave = data.physicsOnTriggerLeave

    // Physics state
    this.shapes = new Set()
    this._tm = null
    this.tempVec3 = new THREE.Vector3()
    this.tempQuat = new THREE.Quaternion()
  }

  async mount() {
    this.needsRebuild = false

    // Get unit-sized geometry for this type
    const geometry = getGeometry(this._type)

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
    const mass = this._physicsMass
    const linearDamping = this._physicsLinearDamping
    const angularDamping = this._physicsAngularDamping
    const trigger = this._physicsTrigger

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
    const offset = this.getColliderOffset()
    let pxGeometry = null
    let meshHandle = null

    if (this._type === 'box') {
      pxGeometry = new PHYSX.PxBoxGeometry(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2)
    } else if (this._type === 'sphere') {
      pxGeometry = new PHYSX.PxSphereGeometry(this.scale.x)
    } else {
      // Use convex mesh for cylinder, cone, torus, and plane
      const threeGeometry = getGeometry(this._type)

      // Create a scaled version of the geometry for physics
      const scaledGeometry = threeGeometry.clone()
      scaledGeometry.scale(this.scale.x, this.scale.y, this.scale.z)

      // Create convex mesh
      meshHandle = geometryToPxMesh(this.ctx.world, scaledGeometry, true)
      if (meshHandle && meshHandle.value) {
        pxGeometry = new PHYSX.PxConvexMeshGeometry(meshHandle.value)
        this.meshHandle = meshHandle // Store for cleanup
      } else {
        console.warn(`[prim] Failed to create convex mesh for ${this._type}, falling back to box`)
        const boxSize = this.getColliderSize()
        pxGeometry = new PHYSX.PxBoxGeometry(boxSize[0] / 2, boxSize[1] / 2, boxSize[2] / 2)
      }
    }

    // Get material
    const staticFriction = this._physicsStaticFriction
    const dynamicFriction = this._physicsDynamicFriction
    const restitution = this._physicsRestitution
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
    const layerName = this._physicsLayer
    const layer = Layers[layerName]
    let pairFlags = PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_FOUND | PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_LOST
    if (!trigger) {
      pairFlags |= PHYSX.PxPairFlagEnum.eNOTIFY_CONTACT_POINTS
    }
    const filterData = new PHYSX.PxFilterData(layer.group, layer.mask, pairFlags, 0)
    this.shape.setQueryFilterData(filterData)
    this.shape.setSimulationFilterData(filterData)

    // Set local pose with offset (only for box and sphere)
    if (this._type === 'box' || this._type === 'sphere') {
      const pose = new PHYSX.PxTransform()
      _v1.set(offset[0], offset[1], offset[2])
      _v1.toPxTransform(pose)
      _q1.set(0, 0, 0, 1).toPxTransform(pose)
      this.shape.setLocalPose(pose)
    }

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
        return self._physicsTag
      },
      get playerId() {
        return playerId
      },
      get onContactStart() {
        return self._physicsOnContactStart
      },
      get onContactEnd() {
        return self._physicsOnContactEnd
      },
      get onTriggerEnter() {
        return self._physicsOnTriggerEnter
      },
      get onTriggerLeave() {
        return self._physicsOnTriggerLeave
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
    if (this.meshHandle) {
      this.meshHandle.release()
      this.meshHandle = null
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

  getColliderOffset() {
    // Returns the offset needed for colliders to match the visual geometry
    switch (this._type) {
      case 'box':
        return [0, this.scale.y * 0.5, 0]
      case 'sphere':
        return [0, this.scale.x, 0]
      case 'cylinder':
        return [0, this.scale.y * 0.5, 0]
      case 'cone':
        return [0, this.scale.y * 0.5, 0]
      case 'torus':
        const majorRadius = this.scale.x
        const tubeRadius = this.scale.x * 0.3 // Standard tube ratio
        return [0, majorRadius + tubeRadius, 0]
      case 'plane':
        return [0, 0, 0]
      default:
        return [0, 0, 0]
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
    this._color = source._color
    this._emissive = source._emissive
    this._castShadow = source._castShadow
    this._receiveShadow = source._receiveShadow
    this._doubleside = source._doubleside
    // Physics properties
    this._physics = source._physics
    this._physicsMass = source._physicsMass
    this._physicsLinearDamping = source._physicsLinearDamping
    this._physicsAngularDamping = source._physicsAngularDamping
    this._physicsStaticFriction = source._physicsStaticFriction
    this._physicsDynamicFriction = source._physicsDynamicFriction
    this._physicsRestitution = source._physicsRestitution
    this._physicsLayer = source._physicsLayer
    this._physicsTrigger = source._physicsTrigger
    this._physicsTag = source._physicsTag
    this._physicsOnContactStart = source._physicsOnContactStart
    this._physicsOnContactEnd = source._physicsOnContactEnd
    this._physicsOnTriggerEnter = source._physicsOnTriggerEnter
    this._physicsOnTriggerLeave = source._physicsOnTriggerLeave
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

  get physicsMass() {
    return this._physicsMass
  }

  set physicsMass(value = defaults.physicsMass) {
    if (!isNumber(value) || value <= 0) {
      throw new Error('[prim] physicsMass must be positive number')
    }
    if (this._physicsMass === value) return
    this._physicsMass = value
    if (this.handle && this._physics) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get physicsLinearDamping() {
    return this._physicsLinearDamping
  }

  set physicsLinearDamping(value = defaults.physicsLinearDamping) {
    if (!isNumber(value) || value < 0) {
      throw new Error('[prim] physicsLinearDamping must be non-negative number')
    }
    if (this._physicsLinearDamping === value) return
    this._physicsLinearDamping = value
    if (this.handle && this._physics) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get physicsAngularDamping() {
    return this._physicsAngularDamping
  }

  set physicsAngularDamping(value = defaults.physicsAngularDamping) {
    if (!isNumber(value) || value < 0) {
      throw new Error('[prim] physicsAngularDamping must be non-negative number')
    }
    if (this._physicsAngularDamping === value) return
    this._physicsAngularDamping = value
    if (this.handle && this._physics) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get physicsStaticFriction() {
    return this._physicsStaticFriction
  }

  set physicsStaticFriction(value = defaults.physicsStaticFriction) {
    if (!isNumber(value) || value < 0 || value > 1) {
      throw new Error('[prim] physicsStaticFriction must be number between 0 and 1')
    }
    if (this._physicsStaticFriction === value) return
    this._physicsStaticFriction = value
    if (this.handle && this._physics) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get physicsDynamicFriction() {
    return this._physicsDynamicFriction
  }

  set physicsDynamicFriction(value = defaults.physicsDynamicFriction) {
    if (!isNumber(value) || value < 0 || value > 1) {
      throw new Error('[prim] physicsDynamicFriction must be number between 0 and 1')
    }
    if (this._physicsDynamicFriction === value) return
    this._physicsDynamicFriction = value
    if (this.handle && this._physics) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get physicsRestitution() {
    return this._physicsRestitution
  }

  set physicsRestitution(value = defaults.physicsRestitution) {
    if (!isNumber(value) || value < 0 || value > 1) {
      throw new Error('[prim] physicsRestitution must be number between 0 and 1')
    }
    if (this._physicsRestitution === value) return
    this._physicsRestitution = value
    if (this.handle && this._physics) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get physicsLayer() {
    return this._physicsLayer
  }

  set physicsLayer(value = defaults.physicsLayer) {
    if (!isString(value)) {
      throw new Error('[prim] physicsLayer must be string')
    }
    if (this._physicsLayer === value) return
    this._physicsLayer = value
    if (this.handle && this._physics) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get physicsTrigger() {
    return this._physicsTrigger
  }

  set physicsTrigger(value = defaults.physicsTrigger) {
    if (!isBoolean(value)) {
      throw new Error('[prim] physicsTrigger must be boolean')
    }
    if (this._physicsTrigger === value) return
    this._physicsTrigger = value
    if (this.handle && this._physics) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get physicsTag() {
    return this._physicsTag
  }

  set physicsTag(value = defaults.physicsTag) {
    if (value !== null && !isString(value)) {
      throw new Error('[prim] physicsTag must be string or null')
    }
    if (this._physicsTag === value) return
    this._physicsTag = value
    // Tag can be updated without rebuild since it uses getter
  }

  get physicsOnContactStart() {
    return this._physicsOnContactStart
  }

  set physicsOnContactStart(value = defaults.physicsOnContactStart) {
    if (value !== null && typeof value !== 'function') {
      throw new Error('[prim] physicsOnContactStart must be function or null')
    }
    this._physicsOnContactStart = value
    // Callbacks can be updated without rebuild since they use getters
  }

  get physicsOnContactEnd() {
    return this._physicsOnContactEnd
  }

  set physicsOnContactEnd(value = defaults.physicsOnContactEnd) {
    if (value !== null && typeof value !== 'function') {
      throw new Error('[prim] physicsOnContactEnd must be function or null')
    }
    this._physicsOnContactEnd = value
    // Callbacks can be updated without rebuild since they use getters
  }

  get physicsOnTriggerEnter() {
    return this._physicsOnTriggerEnter
  }

  set physicsOnTriggerEnter(value = defaults.physicsOnTriggerEnter) {
    if (value !== null && typeof value !== 'function') {
      throw new Error('[prim] physicsOnTriggerEnter must be function or null')
    }
    this._physicsOnTriggerEnter = value
    // Callbacks can be updated without rebuild since they use getters
  }

  get physicsOnTriggerLeave() {
    return this._physicsOnTriggerLeave
  }

  set physicsOnTriggerLeave(value = defaults.physicsOnTriggerLeave) {
    if (value !== null && typeof value !== 'function') {
      throw new Error('[prim] physicsOnTriggerLeave must be function or null')
    }
    this._physicsOnTriggerLeave = value
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
        get physicsMass() {
          return self.physicsMass
        },
        set physicsMass(value) {
          self.physicsMass = value
        },
        get physicsLinearDamping() {
          return self.physicsLinearDamping
        },
        set physicsLinearDamping(value) {
          self.physicsLinearDamping = value
        },
        get physicsAngularDamping() {
          return self.physicsAngularDamping
        },
        set physicsAngularDamping(value) {
          self.physicsAngularDamping = value
        },
        get physicsStaticFriction() {
          return self.physicsStaticFriction
        },
        set physicsStaticFriction(value) {
          self.physicsStaticFriction = value
        },
        get physicsDynamicFriction() {
          return self.physicsDynamicFriction
        },
        set physicsDynamicFriction(value) {
          self.physicsDynamicFriction = value
        },
        get physicsRestitution() {
          return self.physicsRestitution
        },
        set physicsRestitution(value) {
          self.physicsRestitution = value
        },
        get physicsLayer() {
          return self.physicsLayer
        },
        set physicsLayer(value) {
          self.physicsLayer = value
        },
        get physicsTrigger() {
          return self.physicsTrigger
        },
        set physicsTrigger(value) {
          self.physicsTrigger = value
        },
        get physicsTag() {
          return self.physicsTag
        },
        set physicsTag(value) {
          self.physicsTag = value
        },
        get physicsOnContactStart() {
          return self.physicsOnContactStart
        },
        set physicsOnContactStart(value) {
          self.physicsOnContactStart = value
        },
        get physicsOnContactEnd() {
          return self.physicsOnContactEnd
        },
        set physicsOnContactEnd(value) {
          self.physicsOnContactEnd = value
        },
        get physicsOnTriggerEnter() {
          return self.physicsOnTriggerEnter
        },
        set physicsOnTriggerEnter(value) {
          self.physicsOnTriggerEnter = value
        },
        get physicsOnTriggerLeave() {
          return self.physicsOnTriggerLeave
        },
        set physicsOnTriggerLeave(value) {
          self.physicsOnTriggerLeave = value
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
