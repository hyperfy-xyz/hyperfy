import * as THREE from 'three';

// Core World Types
export interface WorldOptions {
  storage?: any;
  assetsDir?: string;
  assetsUrl?: string;
  physics?: boolean;
  renderer?: 'webgl' | 'webgl2' | 'headless';
  networkRate?: number;
  maxDeltaTime?: number;
  fixedDeltaTime?: number;
}

export interface World {
  audio: any;
  controls: any;
  prefs: any;
  frame: number;
  time: number;
  accumulator: number;
  systems: System[];
  networkRate: number;
  assetsUrl: string | null;
  assetsDir: string | null;
  hot: Set<HotReloadable>;
  rig: any; // THREE.Object3D
  camera: any; // THREE.PerspectiveCamera
  
  // Systems
  settings: Settings;
  collections: Collections;
  apps: Apps;
  anchors: Anchors;
  events: Events;
  scripts: Scripts;
  chat: Chat;
  blueprints: Blueprints;
  entities: Entities;
  physics: Physics;
  stage: Stage;
  
  // Additional properties
  builder?: {
    enabled: boolean;
  };
  xr?: {
    session?: XRSession;
    camera: any;
  };
  ui?: {
    toggleCode(): void;
    suppressReticle?(): () => void;
  };
  loader?: {
    get(type: string, url: string): any;
    load(type: string, url: string): Promise<any>;
    insert(type: string, url: string, data: any): void;
    getFile?(url: string): any;
    preload?(type: string, url: string): void;
    execPreload?(): void;
    preloader?: Promise<void>;
  };
  network?: {
    isClient: boolean;
    isServer: boolean;
    id: string;
    send(type: string, data: any): void;
    upload(file: File): Promise<void>;
  };
  
  // Methods
  register(key: string, SystemClass: SystemConstructor): System;
  init(options: WorldOptions): Promise<void>;
  start(): void;
  tick(time: number): void;
  destroy(): void;
  resolveURL(url: string, allowLocal?: boolean): string;
  setHot(item: HotReloadable, hot: boolean): void;
  setupMaterial(material: any): void;
  inject(runtime: any): void;
  
  // Add graphics property
  graphics?: {
    renderer: {
      xr: {
        setSession: (session: XRSession) => void;
        getCamera: () => THREE.Camera;
        getControllerGrip: (index: number) => THREE.Object3D;
      };
    };
  };
  
  // Add emit and on methods
  emit?: (event: string, ...args: any[]) => boolean;
  on?: <T extends string | symbol>(event: T, fn: (...args: any[]) => void, context?: any) => any;
  off?: <T extends string | symbol>(event: T, fn?: (...args: any[]) => void, context?: any, once?: boolean) => any;
}

// System Types
export interface System {
  world: World;
  
  // Lifecycle
  init(options: WorldOptions): Promise<void>;
  start(): void;
  destroy(): void;
  
  // Update cycle
  preTick(): void;
  preFixedUpdate(willFixedStep: boolean): void;
  fixedUpdate(delta: number): void;
  postFixedUpdate(delta: number): void;
  preUpdate(alpha: number): void;
  update(delta: number): void;
  postUpdate(delta: number): void;
  lateUpdate(delta: number): void;
  postLateUpdate(delta: number): void;
  commit(): void;
  postTick(): void;
}

export interface SystemConstructor {
  new (world: World): System;
}

// Entity Component System Types
export interface Entity {
  id: string;
  name: string;
  type: string;
  world: World;
  node: any; // Three.js Object3D
  components: Map<string, Component>;
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  velocity?: Vector3;
  isPlayer: boolean;
  
  // Component management
  addComponent(type: string, data?: any): Component;
  removeComponent(type: string): void;
  getComponent<T extends Component>(type: string): T | null;
  hasComponent(type: string): boolean;
  
  // Physics
  applyForce(force: Vector3): void;
  applyImpulse(impulse: Vector3): void;
  setVelocity(velocity: Vector3): void;
  getVelocity(): Vector3;
  
  // Lifecycle
  fixedUpdate?(delta: number): void;
  update?(delta: number): void;
  lateUpdate?(delta: number): void;
  
  // Event handling
  on?(event: string, callback: Function): void;
  off?(event: string, callback: Function): void;
  
  // Serialization
  serialize(): any;
  destroy(local?: boolean): void;
}

export interface Component {
  type: string;
  entity: Entity;
  data: any;
  
  init?(): void;
  update?(delta: number): void;
  fixedUpdate?(delta: number): void;
  lateUpdate?(delta: number): void;
  destroy?(): void;
}

// Math Types
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Matrix4 {
  elements: number[];
}

// Physics Types
export interface PhysicsOptions {
  gravity?: Vector3;
  timestep?: number;
  maxSubsteps?: number;
}

export interface RigidBody {
  type: 'static' | 'dynamic' | 'kinematic';
  mass: number;
  position: Vector3;
  rotation: Quaternion;
  velocity: Vector3;
  angularVelocity: Vector3;
  
  applyForce(force: Vector3, point?: Vector3): void;
  applyImpulse(impulse: Vector3, point?: Vector3): void;
  setLinearVelocity(velocity: Vector3): void;
  setAngularVelocity(velocity: Vector3): void;
}

export interface Collider {
  type: 'box' | 'sphere' | 'capsule' | 'mesh';
  isTrigger: boolean;
  material?: PhysicsMaterial;
  
  onCollisionEnter?: (other: Collider) => void;
  onCollisionStay?: (other: Collider) => void;
  onCollisionExit?: (other: Collider) => void;
  onTriggerEnter?: (other: Collider) => void;
  onTriggerStay?: (other: Collider) => void;
  onTriggerExit?: (other: Collider) => void;
}

export interface PhysicsMaterial {
  friction: number;
  restitution: number;
}

// Network Types
export interface NetworkPacket {
  type: string;
  data: any;
  timestamp: number;
  reliable?: boolean;
}

export interface NetworkConnection {
  id: string;
  latency: number;
  
  send(packet: NetworkPacket): void;
  disconnect(): void;
}

// Player Types
export interface Player extends Entity {
  connection?: NetworkConnection;
  input: PlayerInput;
  stats: PlayerStats;
  avatar?: any; // Avatar node
  
  spawn(position: Vector3): void;
  respawn(): void;
  damage(amount: number, source?: Entity): void;
  heal(amount: number): void;
}

export interface PlayerInput {
  movement: Vector3;
  rotation: Quaternion;
  actions: Set<string>;
  mouse: { x: number; y: number };
}

export interface PlayerStats {
  health: number;
  maxHealth: number;
  score: number;
  kills: number;
  deaths: number;
}

// Node Types
export interface Node {
  id: string;
  type: string;
  parent: Node | null;
  children: Node[];
  transform: Transform;
  visible: boolean;
  
  add(child: Node): void;
  remove(child: Node): void;
  traverse(callback: (node: Node) => void): void;
  getWorldPosition(): Vector3;
  getWorldRotation(): Quaternion;
  getWorldScale(): Vector3;
}

export interface Transform {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  matrix: Matrix4;
  worldMatrix: Matrix4;
}

// Asset Types
export interface Asset {
  id: string;
  url: string;
  type: 'model' | 'texture' | 'audio' | 'video' | 'script';
  data?: any;
  loaded: boolean;
  loading: boolean;
  error?: Error;
}

// Event Types
export interface GameEvent {
  type: string;
  data: any;
  timestamp: number;
  source?: Entity;
  target?: Entity;
}

// Hot Reloadable
export interface HotReloadable {
  fixedUpdate?(delta: number): void;
  update?(delta: number): void;
  lateUpdate?(delta: number): void;
  postLateUpdate?(delta: number): void;
}

// System Interfaces
export interface Settings extends System {
  get(key: string): any;
  set(key: string, value: any): void;
  public?: boolean;
  model?: {
    url: string;
  } | string | null;
  on?(event: string, handler: Function): void;
}

export interface Collections extends System {
  items: Map<string, any>;
}

export interface Apps extends System {
  apps: Map<string, any>;
  inject(runtime: any): void;
  worldGetters?: Map<string, any>;
  worldSetters?: Map<string, any>;
  worldMethods?: Map<string, any>;
  appGetters?: Map<string, any>;
  appSetters?: Map<string, any>;
  appMethods?: Map<string, any>;
}

export interface Anchors extends System {
  anchors: Map<string, any>;
  get(id: string): any;
}

export interface Events extends System {
  emit(event: string, data?: any): void;
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler?: (data: any) => void): void;
}

export interface Scripts extends System {
  evaluate(code: any): unknown;
  scripts: Map<string, any>;
}

export interface Chat extends System {
  messages: ChatMessage[];
  send(message: string, from?: Entity): void;
}

export interface ChatMessage {
  id: string;
  text: string;
  from?: Entity;
  timestamp: number;
}

export interface Blueprints extends System {
  blueprints: Map<string, Blueprint>;
  create(blueprintId: string, options?: any): Entity;
  get(id: string): Blueprint | null;
  modify(data: any): void;
}

export interface Blueprint {
  id: string;
  name: string;
  version: number;
  components: ComponentDefinition[];
  disabled?: boolean;
  model?: string;
  script?: string;
  props?: any;
}

export interface ComponentDefinition {
  type: string;
  data: any;
}

export interface Entities extends System {
  items: Map<string, Entity>;
  players: Map<string, Player>;
  player?: Player;
  apps: Map<string, Entity>;
  
  // Add methods
  getLocalPlayer(): Player | null;
  getPlayer(id: string): Player | null;
  
  create(name: string, options?: any): Entity;
  destroyEntity(entityId: string): void;
  get(entityId: string): Entity | null;
  has(entityId: string): boolean;
  remove(entityId: string): void;
  set(entityId: string, entity: Entity): void;
  
  // Additional methods
  getAll(): Entity[];
  getAllPlayers(): Player[];
  getRemovedIds(): string[];
  setHot(entity: Entity, hot: boolean): void;
  add(data: any, local?: boolean): Entity;
}

export interface Physics extends System {
  world: any; // PhysX world
  physics?: any; // PhysX physics object
  
  raycast(origin: Vector3, direction: Vector3, maxDistance?: number, layerMask?: number): RaycastHit | null;
  sphereCast(origin: Vector3, radius: number, direction: Vector3, maxDistance?: number, layerMask?: number): RaycastHit | null;
  overlapSphere(position: Vector3, radius: number): Collider[];
  sweep(geometry: any, origin: Vector3, direction: Vector3, maxDistance: number, layerMask: number): any;
  addActor(actor: any, handle: any): any;
}

export interface RaycastHit {
  point: Vector3;
  normal: Vector3;
  distance: number;
  collider: Collider;
  entity?: Entity;
  handle?: any;
}

export interface Stage extends System {
  octree: any;
  scene: any; // THREE.Scene
  environment: any;
  clean(): void;
} 