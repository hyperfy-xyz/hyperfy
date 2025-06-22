// Core type definitions used throughout the codebase

import * as THREE from 'three';
import type { World, Entity, Component, System } from './index';

// Extend existing types with additional properties
declare module './index' {
  interface World {
    // Client-specific properties
    ui?: any;
    loader?: any;
    network?: any;
    target?: any;

    // Server-specific properties
    db?: any;
    storage?: any;
    server?: any;
    monitor?: any;
    livekit?: any;
    environment?: any;
  }
  
  interface Entity {
    // Additional entity properties
    data?: any;
    root?: THREE.Object3D;
    blueprint?: any;
    isApp?: boolean;
    build?: () => Node;
    modify?: (data: any) => void;
    chat?: (text: string) => void;
    isDead?: boolean;
    on?: (event: string, callback: Function) => void;
    off?: (event: string, callback: Function) => void;
  }
}

// Three.js extensions
declare module 'three' {
  interface Object3D {
    ctx?: {
      entity?: Entity;
    };
  }
  
  interface Material {
    // needsUpdate is already defined in Three.js types
  }
}

// Global types
declare global {
  interface Window {
    world?: World;
    preview?: any;
  }
  
  const world: World;
  // __dirname and __filename are already defined in node types
  const PHYSX: any;
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

// Component props types
export interface BaseComponentProps {
  world: World;
  children?: React.ReactNode;
}

export interface EntityComponentProps extends BaseComponentProps {
  entity: Entity;
}

// Network types
export interface NetworkMessage {
  type: string;
  data: any;
  from?: string;
  to?: string;
  timestamp?: number;
}

// Storage types
export interface StorageData {
  [key: string]: any;
}

// Blueprint types
export interface Blueprint {
  id: string;
  name?: string;
  version: number;
  disabled?: boolean;
  model?: string;
  script?: string;
  components?: ComponentDefinition[];
  props?: any;
}

export interface ComponentDefinition {
  type: string;
  data: any;
}

// Script types
export interface ScriptResult {
  code: string;
  exec: (world?: any, app?: any, fetch?: any, props?: any, setTimeout?: any) => any;
}

// Material types
export interface MaterialProxy {
  color?: string;
  textureX?: number;
  textureY?: number;
  [key: string]: any;
}

export interface MaterialWrapper {
  raw: THREE.Material;
  proxy: MaterialProxy;
}

// Loader types
export interface LoaderAsset {
  url: string;
  type: string;
  data?: any;
  getStats?: () => AssetStats;
}

export interface AssetStats {
  geometries: { size: number };
  triangles: number;
  textureBytes: number;
  fileBytes: number;
}

// UI State types
export interface UIState {
  visible: boolean;
  menu?: any;
  app?: Entity;
  code?: boolean;
  [key: string]: any;
}

// Core Entity Types
export interface EntityData {
  id: string;
  type: string;
  name?: string;
  position: number[];
  quaternion: number[];
  scale?: number[];
  health?: number;
  avatar?: string;
  sessionAvatar?: string;
  roles?: string[];
  emote?: string;
  effect?: {
    anchorId?: string;
    freeze?: boolean;
    snare?: number;
    turn?: boolean;
    emote?: string;
    duration?: number;
    cancellable?: boolean;
  };
  blueprint?: string;
  uploader?: string;
  mover?: string;
  pinned?: boolean;
  state?: any;
}

// App Entity Types
export interface AppData extends EntityData {
  blueprint: string;
  uploader?: string;
  mover?: string;
  pinned?: boolean;
  state?: any;
}

// Layer Types
export interface Layer {
  group: number;
  mask: number;
}

export interface Layers {
  camera: Layer;
  player: Layer;
  environment: Layer;
  prop: Layer;
  tool: Layer;
  [key: string]: Layer;
}

// Control Types
export interface Control {
  screen: { width: number; height: number };
  camera: {
    write: boolean;
    position: any; // THREE.Vector3
    quaternion: any; // THREE.Quaternion
    zoom: number;
  };
  pointer: {
    locked: boolean;
    delta: { x: number; y: number };
  };
  scrollDelta: { value: number };
  space: { down: boolean; pressed: boolean };
  touchA: { down: boolean; pressed: boolean };
  keyW: { down: boolean };
  keyS: { down: boolean };
  keyA: { down: boolean };
  keyD: { down: boolean };
  keyC: { down: boolean };
  arrowUp: { down: boolean };
  arrowDown: { down: boolean };
  arrowLeft: { down: boolean };
  arrowRight: { down: boolean };
  shiftLeft: { down: boolean };
  shiftRight: { down: boolean };
  xrLeftStick: { value: { x: number; z: number } };
  xrRightStick: { value: { x: number } };
  xrRightBtn1: { down: boolean; pressed: boolean };
  setActions?: (actions: any[]) => void;
  release?: () => void;
}

// Touch Types
export interface Touch {
  position: { x: number; y: number; clone: () => { x: number; y: number } };
  delta: { x: number; y: number };
}

// Network Types
export interface NetworkData {
  id?: string;
  p?: number[];
  q?: number[];
  e?: string;
  t?: boolean;
  ef?: any;
  name?: string;
  health?: number;
  avatar?: string;
  sessionAvatar?: string;
  roles?: string[];
}

// Event Listener Types
export type EventCallback = (data?: any, networkId?: string) => void;

// Hot Reloadable Interface
export interface HotReloadable {
  fixedUpdate?(delta: number): void;
  update?(delta: number): void;
  lateUpdate?(delta: number): void;
  postLateUpdate?(delta: number): void;
}

// Vector3 Enhanced Extensions
declare module 'three' {
  interface Vector3 {
    toPxVec3?(pxVec3?: any): any;
    toPxExtVec3?(pxExtVec3?: any): any;
    toPxTransform?(pxTransform: any): void;
    fromPxVec3?(pxVec3: any): this;
    fromArray(array: number[], offset?: number): this;
  }
  
  interface Quaternion {
    toPxTransform?(pxTransform: any): void;
    fromArray(array: number[], offset?: number): this;
  }
  
  interface Matrix4 {
    toPxTransform?(pxTransform: any): void;
  }
}

export {}; // Make this a module 