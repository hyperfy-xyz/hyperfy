/// <reference path="../../types/physx.d.ts" />

import * as THREE from '../extras/three.js';
import { extendThreePhysX } from '../extras/extendThreePhysX.js';
import { System } from './System.js';
import { Layers } from '../extras/Layers.js';
import { loadPhysX } from '../loadPhysX.js';
import type { World, Physics as IPhysics, RigidBody, Collider, PhysicsMaterial, Vector3, Quaternion } from '../../types/index.js';

// Hit result interfaces
interface RaycastHit {
  handle?: PhysicsHandle;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number | null;
}

interface SweepHit {
  actor: any;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number | null;
}

interface OverlapHit {
  actor: any;
  handle: PhysicsHandle | null;
  proxy?: {
    get tag(): string | null;
    get playerId(): string | null;
  };
}

// Physics handle for tracking actors
interface PhysicsHandle {
  actor?: any;
  tag?: string;
  playerId?: string;
  controller?: boolean;
  onInterpolate?: (position: THREE.Vector3, quaternion: THREE.Quaternion) => void;
  onContactStart?: (event: ContactEvent) => void;
  onContactEnd?: (event: ContactEvent) => void;
  onTriggerEnter?: (event: TriggerEvent) => void;
  onTriggerLeave?: (event: TriggerEvent) => void;
  contactedHandles: Set<PhysicsHandle>;
  triggeredHandles: Set<PhysicsHandle>;
  interpolation?: {
    prev: { position: THREE.Vector3; quaternion: THREE.Quaternion };
    next: { position: THREE.Vector3; quaternion: THREE.Quaternion };
    curr: { position: THREE.Vector3; quaternion: THREE.Quaternion };
    skip?: boolean;
  };
}

interface ContactEvent {
  tag: string | null;
  playerId: string | null;
  contacts?: Array<{
    position: THREE.Vector3;
    normal: THREE.Vector3;
    impulse: THREE.Vector3;
  }>;
}

interface TriggerEvent {
  tag: string | null;
  playerId: string | null;
}

// Static hit objects
const _raycastHit: RaycastHit = {
  handle: undefined,
  point: new THREE.Vector3(),
  normal: new THREE.Vector3(),
  distance: null,
};

const _sweepHit: SweepHit = {
  actor: null,
  point: new THREE.Vector3(),
  normal: new THREE.Vector3(),
  distance: null,
};

const overlapHitPool: OverlapHit[] = [];
const overlapHits: OverlapHit[] = [];

/**
 * Physics System
 *
 * - Runs on both the server and client.
 * - Allows inserting colliders etc into the world.
 * - Simulates physics and handles fixed timestep interpolation.
 *
 */
export class Physics extends System implements IPhysics {
  scene: any = null;
  version: any;
  allocator: any;
  errorCb: any;
  foundation: any;
  tolerances: any;
  cookingParams: any;
  physics: any;
  defaultMaterial: any;
  callbackQueue: any[] = [];
  getContactCallback: any;
  contactCallbacks: any[] = [];
  queueContactCallback: any;
  processContactCallbacks: any;
  getTriggerCallback: any;
  triggerCallbacks: any[] = [];
  queueTriggerCallback: any;
  processTriggerCallbacks: any;
  handles: Map<number, PhysicsHandle> = new Map();
  active: Set<PhysicsHandle> = new Set();
  materials: Record<string, any> = {};
  raycastResult: any;
  sweepPose: any;
  sweepResult: any;
  overlapPose: any;
  overlapResult: any;
  queryFilterData: any;
  _pv1: any;
  _pv2: any;
  transform: any;
  controllerManager: any;
  controllerFilters: any;
  ignoreSetGlobalPose = false;

  constructor(world: World) {
    super(world);
  }

  async init(): Promise<void> {
    const info = await loadPhysX();
    this.version = info.version;
    this.allocator = info.allocator;
    this.errorCb = info.errorCb;
    this.foundation = info.foundation;

    extendThreePhysX();

    this.tolerances = new PHYSX.PxTolerancesScale();
    this.cookingParams = new PHYSX.PxCookingParams(this.tolerances);
    this.physics = PHYSX.CreatePhysics(this.version, this.foundation, this.tolerances);
    this.defaultMaterial = this.physics.createMaterial(0.2, 0.2, 0.2);

    this.setupCallbacks();
    this.setupScene();
    this.setupQueryObjects();
    this.setupControllerManager();
  }

  private setupCallbacks(): void {
    // Contact callbacks
    this.getContactCallback = createPool(() => {
      const contactPool: any[] = [];
      const contacts: any[] = [];
      let idx = 0;
      return {
        start: false,
        fn0: null as any,
        event0: {
          tag: null,
          playerId: null,
          contacts,
        },
        fn1: null as any,
        event1: {
          tag: null,
          playerId: null,
          contacts,
        },
        addContact(position: any, normal: any, impulse: any) {
          if (!contactPool[idx]) {
            contactPool[idx] = {
              position: new THREE.Vector3(),
              normal: new THREE.Vector3(),
              impulse: new THREE.Vector3(),
            };
          }
          const contact = contactPool[idx];
          contact.position.copy(position);
          contact.normal.copy(normal);
          contact.impulse.copy(impulse);
          contacts.push(contact);
          idx++;
        },
        init(start: boolean) {
          this.start = start;
          this.fn0 = null;
          this.fn1 = null;
          contacts.length = 0;
          idx = 0;
          return this;
        },
        exec() {
          if (this.fn0) {
            try {
              this.fn0(this.event0);
            } catch (err) {
              console.error(err);
            }
          }
          if (this.fn1) {
            try {
              this.fn1(this.event1);
            } catch (err) {
              console.error(err);
            }
          }
          this.release();
        },
        release: () => {}, // Set by pool
      };
    });

    this.queueContactCallback = (cb: any) => {
      this.contactCallbacks.push(cb);
    };

    this.processContactCallbacks = () => {
      for (const cb of this.contactCallbacks) {
        cb.exec();
      }
      this.contactCallbacks.length = 0;
    };

    // Trigger callbacks
    this.getTriggerCallback = createPool(() => {
      return {
        fn: null as any,
        event: {
          tag: null,
          playerId: null,
        },
        exec() {
          try {
            this.fn(this.event);
          } catch (err) {
            console.error(err);
          }
          this.release();
        },
        release: () => {}, // Set by pool
      };
    });

    this.queueTriggerCallback = (cb: any) => {
      this.triggerCallbacks.push(cb);
    };

    this.processTriggerCallbacks = () => {
      for (const cb of this.triggerCallbacks) {
        cb.exec();
      }
      this.triggerCallbacks.length = 0;
    };
  }

  private setupScene(): void {
    const contactPoints = new PHYSX.PxArray_PxContactPairPoint(64);
    const simulationEventCallback = new PHYSX.PxSimulationEventCallbackImpl();
    
    // Contact callback
    simulationEventCallback.onContact = (pairHeader: any, pairs: any, count: number) => {
      pairHeader = PHYSX.wrapPointer(pairHeader, PHYSX.PxContactPairHeader);
      const handle0 = this.handles.get(pairHeader.get_actors(0)?.ptr);
      const handle1 = this.handles.get(pairHeader.get_actors(1)?.ptr);
      if (!handle0 || !handle1) return;
      
      for (let i = 0; i < count; i++) {
        const pair = PHYSX.NativeArrayHelpers.prototype.getContactPairAt(pairs, i);
        if (pair.events.isSet(PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_FOUND)) {
          const contactCallback = this.getContactCallback().init(true);
          this.contactCallbacks.push(contactCallback);
          const pxContactPoints = pair.extractContacts(contactPoints.begin(), 64);
          if (pxContactPoints > 0) {
            for (let j = 0; j < pxContactPoints; j++) {
              const contact = contactPoints.get(j);
              contactCallback.addContact(contact.position, contact.normal, contact.impulse);
            }
          }
          if (!handle0.contactedHandles.has(handle1)) {
            if (handle0.onContactStart) {
              contactCallback.fn0 = handle0.onContactStart;
              contactCallback.event0.tag = handle1.tag;
              contactCallback.event0.playerId = handle1.playerId;
            }
            handle0.contactedHandles.add(handle1);
          }
          if (!handle1.contactedHandles.has(handle0)) {
            if (handle1.onContactStart) {
              contactCallback.fn1 = handle1.onContactStart;
              contactCallback.event1.tag = handle0.tag;
              contactCallback.event1.playerId = handle0.playerId;
            }
            handle1.contactedHandles.add(handle0);
          }
        } else if (pair.events.isSet(PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_LOST)) {
          const contactCallback = this.getContactCallback().init(false);
          this.contactCallbacks.push(contactCallback);
          if (handle0.contactedHandles.has(handle1)) {
            if (handle0.onContactEnd) {
              contactCallback.fn0 = handle0.onContactEnd;
              contactCallback.event0.tag = handle1.tag;
              contactCallback.event0.playerId = handle1.playerId;
            }
            handle0.contactedHandles.delete(handle1);
          }
          if (handle1.contactedHandles.has(handle0)) {
            if (handle1.onContactEnd) {
              contactCallback.fn1 = handle1.onContactEnd;
              contactCallback.event1.tag = handle0.tag;
              contactCallback.event1.playerId = handle0.playerId;
            }
            handle1.contactedHandles.delete(handle0);
          }
        }
      }
    };

    // Trigger callback
    simulationEventCallback.onTrigger = (pairs: any, count: number) => {
      pairs = PHYSX.wrapPointer(pairs, PHYSX.PxTriggerPair);
      for (let i = 0; i < count; i++) {
        const pair = PHYSX.NativeArrayHelpers.prototype.getTriggerPairAt(pairs, i);
        // Ignore pairs if a shape was deleted
        if (
          pair.flags.isSet(PHYSX.PxTriggerPairFlagEnum.eREMOVED_SHAPE_TRIGGER) ||
          pair.flags.isSet(PHYSX.PxTriggerPairFlagEnum.eREMOVED_SHAPE_OTHER)
        ) {
          continue;
        }
        const triggerHandle = this.handles.get(pair.triggerShape.getActor().ptr);
        const otherHandle = this.handles.get(pair.otherShape.getActor().ptr);
        if (!triggerHandle || !otherHandle) continue;
        
        if (pair.status === PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_FOUND) {
          if (!otherHandle.triggeredHandles.has(triggerHandle)) {
            if (triggerHandle.onTriggerEnter) {
              const cb = this.getTriggerCallback();
              cb.fn = triggerHandle.onTriggerEnter;
              cb.event.tag = otherHandle.tag;
              cb.event.playerId = otherHandle.playerId;
              this.triggerCallbacks.push(cb);
            }
            otherHandle.triggeredHandles.add(triggerHandle);
          }
        } else if (pair.status === PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_LOST) {
          if (otherHandle.triggeredHandles.has(triggerHandle)) {
            if (triggerHandle.onTriggerLeave) {
              const cb = this.getTriggerCallback();
              cb.fn = triggerHandle.onTriggerLeave;
              cb.event.tag = otherHandle.tag;
              cb.event.playerId = otherHandle.playerId;
              this.triggerCallbacks.push(cb);
            }
            otherHandle.triggeredHandles.delete(triggerHandle);
          }
        }
      }
    };

    simulationEventCallback.onConstraintBreak = (...args: any[]) => {
      console.error('TODO: onConstraintBreak', ...args);
    };

    // Create scene
    const sceneDesc = new PHYSX.PxSceneDesc(this.tolerances);
    sceneDesc.gravity = new PHYSX.PxVec3(0, -9.81, 0);
    sceneDesc.cpuDispatcher = PHYSX.DefaultCpuDispatcherCreate(0);
    sceneDesc.filterShader = PHYSX.DefaultFilterShader();
    sceneDesc.flags.raise(PHYSX.PxSceneFlagEnum.eENABLE_CCD, true);
    sceneDesc.flags.raise(PHYSX.PxSceneFlagEnum.eENABLE_ACTIVE_ACTORS, true);
    sceneDesc.solverType = PHYSX.PxSolverTypeEnum.eTGS;
    sceneDesc.simulationEventCallback = simulationEventCallback;
    sceneDesc.broadPhaseType = PHYSX.PxBroadPhaseTypeEnum.eGPU;
    this.scene = this.physics.createScene(sceneDesc);
  }

  private setupQueryObjects(): void {
    this.raycastResult = new PHYSX.PxRaycastResult();
    this.sweepPose = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity);
    this.sweepResult = new PHYSX.PxSweepResult();
    this.overlapPose = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity);
    this.overlapResult = new PHYSX.PxOverlapResult();
    this.queryFilterData = new PHYSX.PxQueryFilterData();

    this._pv1 = new PHYSX.PxVec3();
    this._pv2 = new PHYSX.PxVec3();
    this.transform = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity);
  }

  private setupControllerManager(): void {
    this.controllerManager = PHYSX.PxTopLevelFunctions.prototype.CreateControllerManager(this.scene);
    this.controllerFilters = new PHYSX.PxControllerFilters();
    this.controllerFilters.mFilterData = new PHYSX.PxFilterData(Layers.player!.group, Layers.player!.mask, 0, 0);
    
    const filterCallback = new PHYSX.PxQueryFilterCallbackImpl();
    filterCallback.simplePreFilter = (filterDataPtr: any, shapePtr: any, actor: any) => {
      const filterData = PHYSX.wrapPointer(filterDataPtr, PHYSX.PxFilterData);
      const shape = PHYSX.wrapPointer(shapePtr, PHYSX.PxShape);
      const shapeFilterData = shape.getQueryFilterData();
      if (filterData.word0 & shapeFilterData.word1 && shapeFilterData.word0 & filterData.word1) {
        return PHYSX.PxQueryHitType.eBLOCK;
      }
      return PHYSX.PxQueryHitType.eNONE;
    };
    this.controllerFilters.mFilterCallback = filterCallback;
    
    const cctFilterCallback = new PHYSX.PxControllerFilterCallbackImpl();
    cctFilterCallback.filter = (aPtr: any, bPtr: any) => {
      return true; // For now ALL CCTs collide
    };
    this.controllerFilters.mCCTFilterCallback = cctFilterCallback;
  }

  override start(): void {
    // Create ground plane
    const size = 1000;
    const geometry = new PHYSX.PxBoxGeometry(size / 2, 1 / 2, size / 2);
    const material = this.physics.createMaterial(0.6, 0.6, 0);
    const flags = new PHYSX.PxShapeFlags(PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE | PHYSX.PxShapeFlagEnum.eSIMULATION_SHAPE);
    const shape = this.physics.createShape(geometry, material, true, flags);
    const layer = Layers.environment!;
    const filterData = new PHYSX.PxFilterData(layer.group, layer.mask, 0, 0);
    shape.setQueryFilterData(filterData);
    shape.setSimulationFilterData(filterData);
    const transform = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity);
    transform.p.y = -0.5;
    const body = this.physics.createRigidStatic(transform);
    body.attachShape(shape);
    this.scene.addActor(body);
  }

  addActor(actor: any, handle: PhysicsHandle): any {
    handle.actor = actor;
    handle.contactedHandles = new Set();
    handle.triggeredHandles = new Set();
    
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
      };
      const pose = actor.getGlobalPose();
      handle.interpolation.prev.position.copy(pose.p);
      handle.interpolation.prev.quaternion.copy(pose.q);
      handle.interpolation.next.position.copy(pose.p);
      handle.interpolation.next.quaternion.copy(pose.q);
      handle.interpolation.curr.position.copy(pose.p);
      handle.interpolation.curr.quaternion.copy(pose.q);
    }
    
    this.handles.set(actor.ptr, handle);
    if (!handle.controller) {
      this.scene.addActor(actor);
    }
    
    return {
      move: (matrix: any) => {
        if (this.ignoreSetGlobalPose) {
          const isDynamic = !actor.getRigidBodyFlags?.().isSet(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC);
          if (isDynamic) return;
          return;
        }
        // Use the extension method if available, otherwise fall back to manual conversion
        if (typeof matrix.toPxTransform === 'function') {
          matrix.toPxTransform(this.transform);
        } else {
          // Manual conversion from Matrix4 to PxTransform
          const position = new THREE.Vector3();
          const quaternion = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, quaternion, scale);
          this.transform.p.x = position.x;
          this.transform.p.y = position.y;
          this.transform.p.z = position.z;
          this.transform.q.x = quaternion.x;
          this.transform.q.y = quaternion.y;
          this.transform.q.z = quaternion.z;
          this.transform.q.w = quaternion.w;
        }
        actor.setGlobalPose(this.transform);
      },
      snap: (pose: any) => {
        actor.setGlobalPose(pose);
        if (handle.interpolation) {
          handle.interpolation.prev.position.copy(pose.p);
          handle.interpolation.prev.quaternion.copy(pose.q);
          handle.interpolation.next.position.copy(pose.p);
          handle.interpolation.next.quaternion.copy(pose.q);
          handle.interpolation.curr.position.copy(pose.p);
          handle.interpolation.curr.quaternion.copy(pose.q);
          handle.interpolation.skip = true;
        }
      },
      destroy: () => {
        // End any contacts
        if (handle.contactedHandles.size) {
          const cb = this.getContactCallback().init(false);
          for (const otherHandle of handle.contactedHandles) {
            if (otherHandle.onContactEnd) {
              cb.fn0 = otherHandle.onContactEnd;
              cb.event0.tag = handle.tag;
              cb.event0.playerId = handle.playerId;
              cb.exec();
            }
            otherHandle.contactedHandles.delete(handle);
          }
        }
        // End any triggers
        if (handle.triggeredHandles.size) {
          const cb = this.getTriggerCallback();
          for (const triggerHandle of handle.triggeredHandles) {
            if (triggerHandle.onTriggerLeave) {
              cb.fn = triggerHandle.onTriggerLeave;
              cb.event.tag = handle.tag;
              cb.event.playerId = handle.playerId;
              cb.exec();
            }
          }
        }
        // Remove from scene
        if (!handle.controller) {
          this.scene.removeActor(actor);
        }
        // Delete data
        this.handles.delete(actor.ptr);
      },
    };
  }

  override preFixedUpdate(willFixedUpdate: boolean): void {
    if (willFixedUpdate) {
      // If physics will step, clear active actors so we can repopulate
      this.active.clear();
    }
  }

  override postFixedUpdate(delta: number): void {
    this.scene.simulate(delta);
    this.scene.fetchResults(true);
    this.processContactCallbacks();
    this.processTriggerCallbacks();
    
    const activeActors = PHYSX.SupportFunctions.prototype.PxScene_getActiveActors(this.scene);
    const size = activeActors.size();
    for (let i = 0; i < size; i++) {
      const actorPtr = activeActors.get(i).ptr;
      const handle = this.handles.get(actorPtr);
      if (!handle) {
        continue;
      }
      const lerp = handle.interpolation;
      if (!lerp) continue;
      lerp.prev.position.copy(lerp.next.position);
      lerp.prev.quaternion.copy(lerp.next.quaternion);
      const pose = handle.actor.getGlobalPose();
      lerp.next.position.copy(pose.p);
      lerp.next.quaternion.copy(pose.q);
      this.active.add(handle);
    }
  }

  override preUpdate(alpha: number): void {
    for (const handle of this.active) {
      const lerp = handle.interpolation;
      if (!lerp) continue;
      if (lerp.skip) {
        lerp.skip = false;
        continue;
      }
      lerp.curr.position.lerpVectors(lerp.prev.position, lerp.next.position, alpha);
      lerp.curr.quaternion.slerpQuaternions(lerp.prev.quaternion, lerp.next.quaternion, alpha);
      handle.onInterpolate!(lerp.curr.position, lerp.curr.quaternion);
    }
    // Finalize any physics updates immediately
    // but don't listen to any loopback commits from those actor moves
    this.ignoreSetGlobalPose = true;
    this.world.stage?.clean();
    this.ignoreSetGlobalPose = false;
  }

  // Internal raycast method with layer mask support
  private _raycast(origin: any, direction: any, maxDistance: number = Infinity, layerMask: number = 0xFFFFFFFF): RaycastHit | null {
    origin = origin.toPxVec3(this._pv1);
    direction = direction.toPxVec3(this._pv2);
    this.queryFilterData.data.word0 = layerMask;
    this.queryFilterData.data.word1 = 0;
    
    const didHit = this.scene.raycast(
      origin,
      direction,
      maxDistance,
      this.raycastResult,
      PHYSX.PxHitFlagEnum.eNORMAL,
      this.queryFilterData
    );
    
    if (didHit) {
      const numHits = this.raycastResult.getNbAnyHits();
      let hit: any = null;
      for (let n = 0; n < numHits; n++) {
        const nHit = this.raycastResult.getAnyHit(n);
        if (!hit || hit.distance > nHit.distance) {
          hit = nHit;
        }
      }
      _raycastHit.handle = this.handles.get(hit.actor.ptr);
      _raycastHit.point.set(hit.position.x, hit.position.y, hit.position.z);
      _raycastHit.normal.set(hit.normal.x, hit.normal.y, hit.normal.z);
      _raycastHit.distance = hit.distance;
      return _raycastHit;
    }
    return null;
  }

  // Interface-compliant raycast method
  raycast(origin: Vector3, direction: Vector3, maxDistance?: number): import('../../types/index.js').RaycastHit | null {
    const hit = this._raycast(origin, direction, maxDistance || Infinity);
    if (!hit) return null;
    
    // Convert internal RaycastHit to interface-compliant RaycastHit
    return {
      point: hit.point,
      normal: hit.normal,
      distance: hit.distance || 0,
      collider: {} as import('../../types/index.js').Collider, // Placeholder as we don't have proper Collider objects
      entity: hit.handle ? undefined : undefined, // Optional entity
    };
  }

  // Extended raycast with layer mask (not in interface)
  raycastWithMask(origin: any, direction: any, maxDistance: number, layerMask: number): RaycastHit | null {
    return this._raycast(origin, direction, maxDistance, layerMask);
  }

  sweep(geometry: any, origin: any, direction: any, maxDistance: number, layerMask: number): SweepHit | null {
    origin.toPxVec3(this.sweepPose.p);
    direction = direction.toPxVec3(this._pv2);
    this.queryFilterData.data.word0 = layerMask;
    this.queryFilterData.data.word1 = 0;
    
    const didHit = this.scene.sweep(
      geometry,
      this.sweepPose,
      direction,
      maxDistance,
      this.sweepResult,
      PHYSX.PxHitFlagEnum.eDEFAULT,
      this.queryFilterData
    );
    
    if (didHit) {
      const numHits = this.sweepResult.getNbAnyHits();
      let hit: any = null;
      for (let n = 0; n < numHits; n++) {
        const nHit = this.sweepResult.getAnyHit(n);
        if (!hit || hit.distance > nHit.distance) {
          hit = nHit;
        }
      }
      _sweepHit.actor = hit.actor;
      _sweepHit.point.set(hit.position.x, hit.position.y, hit.position.z);
      _sweepHit.normal.set(hit.normal.x, hit.normal.y, hit.normal.z);
      _sweepHit.distance = hit.distance;
      return _sweepHit;
    }
    return null;
  }

  // Internal overlap sphere method with layer mask support
  private _overlapSphere(radius: number, origin: any, layerMask: number = 0xFFFFFFFF): OverlapHit[] {
    origin.toPxVec3(this.overlapPose.p);
    const geometry = getSphereGeometry(radius);
    this.queryFilterData.data.word0 = layerMask;
    this.queryFilterData.data.word1 = 0;
    
    const didHit = this.scene.overlap(geometry, this.overlapPose, this.overlapResult, this.queryFilterData);
    if (!didHit) return [];
    
    overlapHits.length = 0;
    const numHits = this.overlapResult.getNbAnyHits();
    for (let n = 0; n < numHits; n++) {
      const nHit = this.overlapResult.getAnyHit(n);
      const hit = getOrCreateOverlapHit(n);
      hit.actor = nHit.actor;
      hit.handle = this.handles.get(nHit.actor.ptr) || null;
      overlapHits.push(hit);
    }
    return overlapHits;
  }

  // Interface-compliant overlapSphere method
  overlapSphere(position: Vector3, radius: number): Collider[] {
    // Note: This returns empty array as we don't have Collider objects in this implementation
    // The actual physics implementation uses OverlapHit objects instead
    return [];
  }

  // Extended overlap sphere with layer mask (not in interface)
  overlapSphereWithMask(radius: number, origin: any, layerMask: number): OverlapHit[] {
    return this._overlapSphere(radius, origin, layerMask);
  }

  getMaterial(staticFriction: number, dynamicFriction: number, restitution: number): any {
    // Cache and re-use materials as PhysX has a limit of 64k
    const id = `${staticFriction}${dynamicFriction}${restitution}`;
    let material = this.materials[id];
    if (!material) {
      material = this.physics.createMaterial(staticFriction, dynamicFriction, restitution);
      this.materials[id] = material;
    }
    return material;
  }

  // IPhysics interface methods
  createRigidBody(type: 'static' | 'dynamic' | 'kinematic', position?: Vector3, rotation?: Quaternion): RigidBody {
    throw new Error('Not implemented - use addActor instead');
  }

  createCollider(geometry: any, material?: PhysicsMaterial, isTrigger?: boolean): Collider {
    throw new Error('Not implemented - use PhysX geometry directly');
  }

  createMaterial(staticFriction?: number, dynamicFriction?: number, restitution?: number): PhysicsMaterial {
    return this.getMaterial(staticFriction || 0.5, dynamicFriction || 0.5, restitution || 0.5);
  }

  sphereCast(origin: Vector3, radius: number, direction: Vector3, maxDistance?: number, layerMask?: number): any {
    const geometry = getSphereGeometry(radius);
    return this.sweep(geometry, origin, direction, maxDistance || 1000, layerMask || 0xFFFFFFFF);
  }

  simulate(deltaTime: number): void {
    // Handled in postFixedUpdate
  }
}

// Helper functions
function createPool<T>(factory: () => T & { release: () => void }): () => T {
  const pool: T[] = [];
  return () => {
    if (pool.length) {
      return pool.pop()!;
    }
    const item = factory();
    item.release = () => pool.push(item);
    return item;
  };
}

const spheres = new Map<number, any>();
function getSphereGeometry(radius: number): any {
  let sphere = spheres.get(radius);
  if (!sphere) {
    sphere = new PHYSX.PxSphereGeometry(radius);
    spheres.set(radius, sphere);
  }
  return sphere;
}

function getOrCreateOverlapHit(idx: number): OverlapHit {
  let hit = overlapHitPool[idx];
  if (!hit) {
    hit = {
      actor: null,
      handle: null,
      proxy: {
        get tag() {
          return hit.handle?.tag || null;
        },
        get playerId() {
          return hit.handle?.playerId || null;
        },
      },
    };
    overlapHitPool.push(hit);
  }
  return hit;
}
