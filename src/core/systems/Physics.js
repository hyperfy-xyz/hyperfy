import * as THREE from '../extras/three'
import { extendThreePhysX } from '../extras/extendThreePhysX'
import { System } from './System'
import { Layers } from '../extras/Layers'

const _raycastHit = {
  actor: null,
  point: new THREE.Vector3(),
  normal: new THREE.Vector3(),
  distance: null,
}

const _sweepHit = {
  actor: null,
  point: new THREE.Vector3(),
  normal: new THREE.Vector3(),
  distance: null,
}

const _overlapHit = {
  actor: null,
}

const triggerResult = {
  tag: null,
}

const overlapHitPool = []
const overlapHits = []

/**
 * Physics System
 *
 * - Runs on both the server and client.
 * - Allows inserting colliders etc into the world.
 * - Simulates physics and handles fixed timestep interpolation.
 *
 */
export class Physics extends System {
  constructor(world) {
    super(world)
    this.scene = null
  }

  async init({ loadPhysX }) {
    const info = await loadPhysX()
    this.version = info.version
    this.allocator = info.allocator
    this.errorCb = info.errorCb
    this.foundation = info.foundation

    extendThreePhysX()

    this.tolerances = new PHYSX.PxTolerancesScale()
    this.cookingParams = new PHYSX.PxCookingParams(this.tolerances)
    this.physics = PHYSX.CreatePhysics(this.version, this.foundation, this.tolerances)
    this.defaultMaterial = this.physics.createMaterial(0.2, 0.2, 0.2)

    this.callbackQueue = []

    this.getContactCallback = createPool(() => {
      const contactPool = []
      const contacts = []
      let idx = 0
      return {
        start: false,
        fn0: null,
        event0: {
          tag: null,
          playerId: null,
          contacts,
        },
        fn1: null,
        event1: {
          tag: null,
          playerId: null,
          contacts,
        },
        addContact(position, normal, impulse) {
          if (!contactPool[idx]) {
            contactPool[idx] = {
              position: new THREE.Vector3(),
              normal: new THREE.Vector3(),
              impulse: new THREE.Vector3(),
            }
          }
          const contact = contactPool[idx]
          contact.position.copy(position)
          contact.normal.copy(normal)
          contact.impulse.copy(impulse)
          contacts.push(contact)
          idx++
        },
        init(start) {
          this.start = start
          this.fn0 = null
          this.fn1 = null
          contacts.length = 0
          idx = 0
          return this
        },
        exec() {
          if (this.fn0) {
            try {
              this.fn0(this.event0)
            } catch (err) {
              console.error(err)
            }
          }
          if (this.fn1) {
            try {
              this.fn1(this.event1)
            } catch (err) {
              console.error(err)
            }
          }
          this.release()
        },
      }
    })
    this.contactCallbacks = []
    this.queueContactCallback = cb => {
      this.contactCallbacks.push(cb)
    }
    this.processContactCallbacks = () => {
      for (const cb of this.contactCallbacks) {
        cb.exec()
      }
      this.contactCallbacks.length = 0
    }
    const contactPoints = new PHYSX.PxArray_PxContactPairPoint(64)
    const simulationEventCallback = new PHYSX.PxSimulationEventCallbackImpl()
    simulationEventCallback.onContact = (pairHeader, pairs, count) => {
      pairHeader = PHYSX.wrapPointer(pairHeader, PHYSX.PxContactPairHeader)
      const handle0 = this.handles.get(pairHeader.get_actors(0)?.ptr)
      const handle1 = this.handles.get(pairHeader.get_actors(1)?.ptr)
      if (!handle0 || !handle1) return
      for (let i = 0; i < count; i++) {
        const pair = PHYSX.NativeArrayHelpers.prototype.getContactPairAt(pairs, i)
        if (pair.events.isSet(PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_FOUND)) {
          const contactCallback = this.getContactCallback().init(true)
          this.contactCallbacks.push(contactCallback)
          const pxContactPoints = pair.extractContacts(contactPoints.begin(), 64)
          if (pxContactPoints > 0) {
            for (let j = 0; j < pxContactPoints; j++) {
              const contact = contactPoints.get(j)
              contactCallback.addContact(contact.position, contact.normal, contact.impulse)
            }
          }
          if (!handle0.contactedHandles.has(handle1)) {
            if (handle0.onContactStart) {
              contactCallback.fn0 = handle0.onContactStart
              contactCallback.event0.tag = handle1.tag
              contactCallback.event0.playerId = handle1.playerId
            }
            handle0.contactedHandles.add(handle1)
          }
          if (!handle1.contactedHandles.has(handle0)) {
            if (handle1.onContactStart) {
              contactCallback.fn1 = handle1.onContactStart
              contactCallback.event1.tag = handle0.tag
              contactCallback.event1.playerId = handle0.playerId
            }
            handle1.contactedHandles.add(handle0)
          }
        } else if (pair.events.isSet(PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_LOST)) {
          const contactCallback = this.getContactCallback().init(false)
          this.contactCallbacks.push(contactCallback)
          if (handle0.contactedHandles.has(handle1)) {
            if (handle0.onContactEnd) {
              contactCallback.fn0 = handle0.onContactEnd
              contactCallback.event0.tag = handle1.tag
              contactCallback.event0.playerId = handle1.playerId
            }
            handle0.contactedHandles.delete(handle1)
          }
          if (handle1.contactedHandles.has(handle0)) {
            if (handle1.onContactEnd) {
              contactCallback.fn1 = handle1.onContactEnd
              contactCallback.event1.tag = handle0.tag
              contactCallback.event1.playerId = handle0.playerId
            }
            handle1.contactedHandles.delete(handle0)
          }
        }
      }
    }
    this.getTriggerCallback = createPool(() => {
      return {
        fn: null,
        event: {
          tag: null,
          playerId: null,
        },
        exec() {
          try {
            this.fn(this.event)
          } catch (err) {
            console.error(err)
          }
          this.release()
        },
      }
    })
    this.triggerCallbacks = []
    this.queueTriggerCallback = cb => {
      this.triggerCallbacks.push(cb)
    }
    this.processTriggerCallbacks = () => {
      for (const cb of this.triggerCallbacks) {
        cb.exec()
      }
      this.triggerCallbacks.length = 0
    }
    simulationEventCallback.onTrigger = (pairs, count) => {
      pairs = PHYSX.wrapPointer(pairs, PHYSX.PxTriggerPair)
      for (let i = 0; i < count; i++) {
        const pair = PHYSX.NativeArrayHelpers.prototype.getTriggerPairAt(pairs, i)
        // ignore pairs if a shape was deleted.
        // this prevents an issue where onLeave can get called after rebuilding an object that had entered a trigger
        if (
          pair.flags.isSet(PHYSX.PxTriggerPairFlagEnum.eREMOVED_SHAPE_TRIGGER) ||
          pair.flags.isSet(PHYSX.PxTriggerPairFlagEnum.eREMOVED_SHAPE_OTHER)
        ) {
          continue
        }
        const triggerHandle = this.handles.get(pair.triggerShape.getActor().ptr)
        const otherHandle = this.handles.get(pair.otherShape.getActor().ptr)
        if (!triggerHandle || !otherHandle) continue
        if (pair.status === PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_FOUND) {
          if (!otherHandle.triggeredHandles.has(triggerHandle)) {
            if (triggerHandle.onTriggerEnter) {
              const cb = this.getTriggerCallback()
              cb.fn = triggerHandle.onTriggerEnter
              cb.event.tag = otherHandle.tag
              cb.event.playerId = otherHandle.playerId
              this.triggerCallbacks.push(cb)
            }
            otherHandle.triggeredHandles.add(triggerHandle)
          }
        } else if (pair.status === PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_LOST) {
          if (otherHandle.triggeredHandles.has(triggerHandle)) {
            if (triggerHandle.onTriggerLeave) {
              const cb = this.getTriggerCallback()
              cb.fn = triggerHandle.onTriggerLeave
              cb.event.tag = otherHandle.tag
              cb.event.playerId = otherHandle.playerId
              this.triggerCallbacks.push(cb)
            }
            otherHandle.triggeredHandles.delete(triggerHandle)
          }
        }
      }
    }
    simulationEventCallback.onConstraintBreak = (...args) => {
      console.error('TODO: onContraintBreak', ...args)
    }

    const sceneDesc = new PHYSX.PxSceneDesc(this.tolerances)
    sceneDesc.gravity = new PHYSX.PxVec3(0, -9.81, 0)
    sceneDesc.cpuDispatcher = PHYSX.DefaultCpuDispatcherCreate(0)
    sceneDesc.filterShader = PHYSX.DefaultFilterShader()
    sceneDesc.flags.raise(PHYSX.PxSceneFlagEnum.eENABLE_CCD, true)
    sceneDesc.flags.raise(PHYSX.PxSceneFlagEnum.eENABLE_ACTIVE_ACTORS, true)
    sceneDesc.solverType = PHYSX.PxSolverTypeEnum.eTGS // recommened, default is PGS still
    sceneDesc.simulationEventCallback = simulationEventCallback
    sceneDesc.broadPhaseType = PHYSX.PxBroadPhaseTypeEnum.eGPU
    this.scene = this.physics.createScene(sceneDesc)

    this.handles = new Map()
    this.active = new Set()

    this.raycastResult = new PHYSX.PxRaycastResult()
    this.sweepPose = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
    this.sweepResult = new PHYSX.PxSweepResult()
    this.overlapPose = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
    this.overlapResult = new PHYSX.PxOverlapResult()
    this.queryFilterData = new PHYSX.PxQueryFilterData()

    this._pv1 = new PHYSX.PxVec3()
    this._pv2 = new PHYSX.PxVec3()
    this.transform = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)

    this.setupControllerManager()
  }

  setupControllerManager() {
    this.controllerManager = PHYSX.PxTopLevelFunctions.prototype.CreateControllerManager(this.scene) // prettier-ignore
    this.controllerFilters = new PHYSX.PxControllerFilters()
    this.controllerFilters.mFilterData = new PHYSX.PxFilterData(Layers.player.group, Layers.player.mask, 0, 0) // prettier-ignore
    const filterCallback = new PHYSX.PxQueryFilterCallbackImpl()
    filterCallback.simplePreFilter = (filterDataPtr, shapePtr, actor) => {
      const filterData = PHYSX.wrapPointer(filterDataPtr, PHYSX.PxFilterData)
      const shape = PHYSX.wrapPointer(shapePtr, PHYSX.PxShape)
      const shapeFilterData = shape.getQueryFilterData()
      // if (0 == (filterData.word0 & shapeFilterData.word1) && 0 == (shapeFilterData.word0 & filterData.word1)) {
      //   return PHYSX.PxQueryHitType.eBLOCK
      //   return PHYSX.PxQueryHitType.eNONE
      // }
      if (filterData.word0 & shapeFilterData.word1 && shapeFilterData.word0 & filterData.word1) {
        return PHYSX.PxQueryHitType.eBLOCK
      }
      return PHYSX.PxQueryHitType.eNONE
    }
    this.controllerFilters.mFilterCallback = filterCallback
    const cctFilterCallback = new PHYSX.PxControllerFilterCallbackImpl()
    cctFilterCallback.filter = (aPtr, bPtr) => {
      // const a = PHYSX.wrapPointer(aPtr, PHYSX.PxCapsuleController)
      // const b = PHYSX.wrapPointer(bPtr, PHYSX.PxCapsuleController)
      return true // for now ALL cct's collide
    }
    this.controllerFilters.mCCTFilterCallback = cctFilterCallback
  }

  start() {
    // ground
    const size = 1000
    const geometry = new PHYSX.PxBoxGeometry(size / 2, 1 / 2, size / 2)
    const material = this.physics.createMaterial(0.6, 0.6, 0)
    const flags = new PHYSX.PxShapeFlags(PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE | PHYSX.PxShapeFlagEnum.eSIMULATION_SHAPE) // prettier-ignore
    const shape = this.physics.createShape(geometry, material, true, flags)
    const layer = Layers.environment
    const filterData = new PHYSX.PxFilterData(layer.group, layer.mask, 0, 0) // prettier-ignore
    shape.setQueryFilterData(filterData)
    shape.setSimulationFilterData(filterData)
    const transform = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
    transform.p.y = -0.5
    const body = this.physics.createRigidStatic(transform)
    body.attachShape(shape)
    this.scene.addActor(body)
  }

  addActor(actor, handle) {
    handle.actor = actor
    handle.contactedHandles = new Set()
    handle.triggeredHandles = new Set()
    if (handle.onInterpolate) {
      handle.interpolation = {
        prev: {
          position: new THREE.Vector3(),
          quaternion: new THREE.Quaternion(),
        },
        next: {
          position: new THREE.Vector3(),
          quaternion: new THREE.Quaternion(),
        },
        curr: {
          position: new THREE.Vector3(),
          quaternion: new THREE.Quaternion(),
        },
      }
      const pose = actor.getGlobalPose()
      handle.interpolation.prev.position.copy(pose.p)
      handle.interpolation.prev.quaternion.copy(pose.q)
      handle.interpolation.next.position.copy(pose.p)
      handle.interpolation.next.quaternion.copy(pose.q)
      handle.interpolation.curr.position.copy(pose.p)
      handle.interpolation.curr.quaternion.copy(pose.q)
    }
    this.handles.set(actor.ptr, handle)
    if (!handle.controller) {
      this.scene.addActor(actor)
    }
    return {
      move: matrix => {
        if (this.ignoreSetGlobalPose) {
          const isDynamic = !actor.getRigidBodyFlags?.().isSet(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC)
          if (isDynamic) return
          return
        }
        matrix.toPxTransform(this.transform)
        actor.setGlobalPose(this.transform)
      },
      snap: pose => {
        actor.setGlobalPose(pose)
        handle.interpolation.prev.position.copy(pose.p)
        handle.interpolation.prev.quaternion.copy(pose.q)
        handle.interpolation.next.position.copy(pose.p)
        handle.interpolation.next.quaternion.copy(pose.q)
        handle.interpolation.curr.position.copy(pose.p)
        handle.interpolation.curr.quaternion.copy(pose.q)
        handle.interpolation.skip = true
      },
      destroy: () => {
        // end any contacts
        if (handle.contactedHandles.size) {
          const cb = this.getContactCallback().init(false)
          for (const otherHandle of handle.contactedHandles) {
            if (otherHandle.onContactEnd) {
              cb.fn0 = otherHandle.onContactEnd
              cb.event0.tag = handle.tag
              cb.event0.playerId = handle.playerId
              cb.exec()
            }
            otherHandle.contactedHandles.delete(handle)
          }
        }
        // end any triggers
        if (handle.triggeredHandles.size) {
          const cb = this.getTriggerCallback()
          for (const triggerHandle of handle.triggeredHandles) {
            if (triggerHandle.onTriggerLeave) {
              cb.fn = triggerHandle.onTriggerLeave
              cb.event.tag = handle.tag
              cb.event.playerId = handle.playerId
              cb.exec()
            }
          }
        }
        // remove from scene
        if (!handle.controller) {
          this.scene.removeActor(actor)
        }
        // delete data
        this.handles.delete(actor.ptr)
      },
    }
  }

  preFixedUpdate(willFixedUpdate) {
    if (willFixedUpdate) {
      // if physics will step, clear active actors so we can repopulate.
      this.active.clear()
    }
  }

  postFixedUpdate(delta) {
    this.scene.simulate(delta)
    this.scene.fetchResults(true)
    this.processContactCallbacks()
    this.processTriggerCallbacks()
    const activeActors = PHYSX.SupportFunctions.prototype.PxScene_getActiveActors(this.scene)
    const size = activeActors.size()
    for (let i = 0; i < size; i++) {
      const actorPtr = activeActors.get(i).ptr
      const handle = this.handles.get(actorPtr)
      if (!handle) {
        // todo: addBot vrms do this
        // console.warn('active actor not found?', actorPtr)
        continue
      }
      const lerp = handle.interpolation
      if (!lerp) continue
      lerp.prev.position.copy(lerp.next.position)
      lerp.prev.quaternion.copy(lerp.next.quaternion)
      const pose = handle.actor.getGlobalPose()
      lerp.next.position.copy(pose.p)
      lerp.next.quaternion.copy(pose.q)
      this.active.add(handle)
    }
  }

  preUpdate(alpha) {
    for (const handle of this.active) {
      const lerp = handle.interpolation
      if (lerp.skip) {
        lerp.skip = false
        continue
      }
      lerp.curr.position.lerpVectors(lerp.prev.position, lerp.next.position, alpha)
      lerp.curr.quaternion.slerpQuaternions(lerp.prev.quaternion, lerp.next.quaternion, alpha)
      handle.onInterpolate(lerp.curr.position, lerp.curr.quaternion)
    }
    // finalize any physics updates immediately
    // but don't listen to any loopback commits from those actor moves
    this.ignoreSetGlobalPose = true
    this.world.stage.clean()
    this.ignoreSetGlobalPose = false
  }

  raycast(origin, direction, maxDistance = Infinity, layerMask) {
    origin = origin.toPxVec3(this._pv1)
    direction = direction.toPxVec3(this._pv2)
    // this.queryFilterData.flags |= PHYSX.PxQueryFlagEnum.ePREFILTER | PHYSX.PxQueryFlagEnum.ePOSTFILTER // prettier-ignore
    this.queryFilterData.data.word0 = layerMask // what to hit, eg Layers.player.group | Layers.environment.group
    this.queryFilterData.data.word1 = 0
    const didHit = this.scene.raycast(
      origin,
      direction,
      maxDistance,
      this.raycastResult,
      PHYSX.PxHitFlagEnum.eNORMAL,
      this.queryFilterData
    )
    if (didHit) {
      const numHits = this.raycastResult.getNbAnyHits()
      let hit
      for (let n = 0; n < numHits; n++) {
        const nHit = this.raycastResult.getAnyHit(n)
        if (!hit || hit.distance > nHit.distance) {
          hit = nHit
        }
      }
      _raycastHit.handle = this.handles.get(hit.actor.ptr)
      _raycastHit.point.set(hit.position.x, hit.position.y, hit.position.z)
      _raycastHit.normal.set(hit.normal.x, hit.normal.y, hit.normal.z)
      _raycastHit.distance = hit.distance
      return _raycastHit
    }
    // TODO: this.raycastResult.destroy() on this.destroy()
  }

  sweep(geometry, origin, direction, maxDistance, layerMask) {
    origin.toPxVec3(this.sweepPose.p)
    direction = direction.toPxVec3(this._pv2)
    this.queryFilterData.data.word0 = layerMask
    this.queryFilterData.data.word1 = 0
    const didHit = this.scene.sweep(
      geometry,
      this.sweepPose,
      direction,
      maxDistance,
      this.sweepResult,
      PHYSX.PxHitFlagEnum.eDEFAULT,
      this.queryFilterData
    )
    if (didHit) {
      const numHits = this.sweepResult.getNbAnyHits()
      let hit
      for (let n = 0; n < numHits; n++) {
        const nHit = this.sweepResult.getAnyHit(n)
        if (!hit || hit.distance > nHit.distance) {
          hit = nHit
        }
      }
      _sweepHit.actor = hit.actor
      _sweepHit.point.set(hit.position.x, hit.position.y, hit.position.z)
      _sweepHit.normal.set(hit.normal.x, hit.normal.y, hit.normal.z)
      _sweepHit.distance = hit.distance
      return _sweepHit
    }
    // TODO: this.sweepResult.destroy() on this.destroy()
  }

  // overlap(geometry, origin, layerMask) {
  //   origin.toPxVec3(this.overlapPose.p)
  //   this.queryFilterData.data.word0 = layerMask
  //   this.queryFilterData.data.word1 = 0
  //   const didHit = this.scene.overlap(geometry, this.overlapPose, this.overlapResult, this.queryFilterData)
  //   if (didHit) {
  //     // const hit = this.overlapResult.getAnyHit(0)
  //     _overlapHit.actor = hit.actor
  //     return _overlapHit
  //   }
  //   // TODO: this.overlapResult.destroy() on this.destroy()
  // }

  overlapSphere(radius, origin, layerMask) {
    origin.toPxVec3(this.overlapPose.p)
    const geometry = getSphereGeometry(radius)
    this.queryFilterData.data.word0 = layerMask // what to hit, eg Layers.player.group | Layers.environment.group
    this.queryFilterData.data.word1 = 0
    const didHit = this.scene.overlap(geometry, this.overlapPose, this.overlapResult, this.queryFilterData)
    if (!didHit) return []
    overlapHits.length = 0
    const numHits = this.overlapResult.getNbAnyHits()
    for (let n = 0; n < numHits; n++) {
      const nHit = this.overlapResult.getAnyHit(n)
      const hit = getOrCreateOverlapHit(n)
      hit.actor = nHit.actor
      hit.handle = this.handles.get(nHit.actor.ptr)
      overlapHits.push(hit)
    }
    return overlapHits
  }
}

function createPool(factory) {
  const pool = []
  return () => {
    if (pool.length) {
      return pool.pop()
    }
    const item = factory()
    item.release = () => pool.push(item)
    return item
  }
}

const spheres = new Map()
function getSphereGeometry(radius) {
  let sphere = spheres.get(radius)
  if (!sphere) {
    sphere = new PHYSX.PxSphereGeometry(radius)
    spheres.set(radius, sphere)
  }
  return sphere
}

function getOrCreateOverlapHit(idx) {
  let hit = overlapHitPool[idx]
  if (!hit) {
    hit = {
      actor: null,
      handle: null,
      proxy: {
        get tag() {
          return hit.handle?.tag || null
        },
        get playerId() {
          return hit.handle?.playerId || null
        },
      },
    }
    overlapHitPool.push(hit)
  }
  return hit
}
