// Type definitions for Hyperfy client components

import { ReactNode } from 'react'
import * as THREE from 'three'

// Core types
export interface World {
  ui: UIState
  entities: EntityManager
  blueprints: BlueprintManager
  collections: CollectionManager
  settings: WorldSettings
  prefs: WorldPreferences
  network: NetworkManager
  loader: LoaderManager
  builder: BuilderManager
  graphics: GraphicsSystem
  controls: ControlsSystem
  target: TargetSystem
  rig: THREE.Object3D
  livekit: LiveKitManager
  xr: XRManager
  chat: ChatSystem
  toast: (message: string) => void
  emit: (event: string, data?: any) => void
  on: (event: string, handler: Function) => void
  off: (event: string, handler: Function) => void
  resolveURL: (url: string) => string
}

export interface UIState {
  active: boolean
  pane: string | null
  app: AppEntity | null
  reticleSuppressors: number
  state: {
    app: AppEntity | null
    active: boolean
    pane: string | null
  }
  togglePane: (pane: string) => void
  toggleVisible: () => void
  setApp: (app: AppEntity | null) => void
  toggleCode: () => void
  toggleApps: () => void
}

export interface EntityManager {
  items: Map<string, Entity>
  player: PlayerEntity
  add: (data: EntityData, broadcast?: boolean) => Entity
}

export interface Entity {
  id: string
  data: EntityData
  isApp?: boolean
  isPlayer?: boolean
  root: THREE.Object3D
  blueprint?: Blueprint
  modify: (changes: Partial<EntityData>) => void
  destroy: (broadcast?: boolean) => void
}

export interface EntityData {
  id: string
  type: string
  name?: string
  blueprint?: string
  position?: number[]
  quaternion?: number[]
  scale?: number[]
  mover?: string
  uploader?: string | null
  pinned?: boolean
  state?: Record<string, any>
  roles?: string[]
}

export interface AppEntity extends Entity {
  isApp: true
  blueprint: Blueprint
  fields: Field[]
  script?: { code: string }
  onFields?: (fields: Field[]) => void
  getNodes: () => any
  world: World
}

export interface PlayerEntity extends Entity {
  isPlayer: true
  data: EntityData & {
    name: string
    roles: string[]
  }
  setName: (name: string) => void
}

export interface BlueprintManager {
  items: Map<string, Blueprint>
  get: (id: string) => Blueprint | undefined
  add: (blueprint: Blueprint, broadcast?: boolean) => void
  modify: (changes: Partial<Blueprint> & { id: string }) => void
  on: (event: string, handler: Function) => void
  off: (event: string, handler: Function) => void
}

export interface Blueprint {
  id: string
  version: number
  name: string
  desc?: string
  author?: string
  url?: string
  model?: string
  script?: string
  image?: FileInfo
  props?: Record<string, any>
  frozen?: boolean
  disabled?: boolean
  preload?: boolean
  locked?: boolean
  unique?: boolean
  public?: boolean
}

export interface FileInfo {
  type: string
  name: string
  url: string
}

export interface CollectionManager {
  get: (name: string) => Collection | undefined
}

export interface Collection {
  blueprints: Blueprint[]
}

export interface WorldSettings {
  title: string
  desc: string
  image?: FileInfo
  model?: FileInfo
  avatar?: FileInfo
  playerLimit: number
  public: boolean
  on: (event: 'change', handler: (changes: any) => void) => void
  off: (event: 'change', handler: (changes: any) => void) => void
  set: (key: string, value: any, broadcast?: boolean) => void
}

export interface WorldPreferences {
  dpr: number
  shadows: string
  postprocessing: boolean
  bloom: boolean
  music: number
  sfx: number
  voice: number
  ui: number
  actions: boolean
  stats: boolean
  touchAction?: boolean
  on: (event: string, handler: Function) => void
  off: (event: string, handler: Function) => void
  setDPR: (value: number) => void
  setShadows: (value: string) => void
  setPostprocessing: (value: boolean) => void
  setBloom: (value: boolean) => void
  setMusic: (value: number) => void
  setSFX: (value: number) => void
  setVoice: (value: number) => void
  setUI: (value: number) => void
  setActions: (value: boolean) => void
  setStats: (value: boolean) => void
}

export interface NetworkManager {
  id: string
  send: (event: string, data?: any) => void
  upload: (file: File) => Promise<void>
}

export interface LoaderManager {
  get: (type: string, url: string) => any
  insert: (type: string, url: string, file: File) => void
  loadFile: (url: string) => Promise<File>
  getFile: (url: string, name?: string) => File | undefined
}

export interface BuilderManager {
  enabled: boolean
  toggle: (enabled?: boolean) => void
  select: (entity: Entity) => void
  getSpawnTransform: (snap?: boolean) => { position: number[]; quaternion: number[] }
  control: {
    pointer: {
      lock: () => void
    }
  }
}

export interface GraphicsSystem {
  width: number
  height: number
}

export interface ControlsSystem {
  pointer: {
    locked: boolean
  }
  actions: Action[]
  bind: (options: { priority: number }) => any
  action: { onPress: () => void }
  jump: { onPress: () => void }
}

export interface Action {
  id: string
  type: string
  label: string
  btn?: string
}

export interface TargetSystem {
  show: (position: THREE.Vector3) => void
  hide: () => void
}

export interface LiveKitManager {
  status: LiveKitStatus
  available: boolean
  setMicrophoneEnabled: () => void
  on: (event: string, handler: Function) => void
  off: (event: string, handler: Function) => void
}

export interface LiveKitStatus {
  available: boolean
  connected: boolean
  mic: boolean
}

export interface XRManager {
  supportsVR: boolean
  enter: () => void
}

export interface ChatSystem {
  send: (message: string) => void
  command: (command: string) => void
  add: (data: any, broadcast?: boolean) => void
  subscribe: (callback: (messages: any[]) => void) => () => void
}

// Field types
export interface Field {
  key: string
  type: string
  label: string
  hint?: string
  placeholder?: string
  hidden?: boolean
  when?: Array<{ op: string; key: string; value: any }>
  // Type-specific properties
  dp?: number
  min?: number
  max?: number
  step?: number
  bigStep?: number
  kind?: string
  options?: Array<{ label: string; value: any }>
  trueLabel?: string
  falseLabel?: string
  instant?: boolean
  x?: string
  y?: string
  xRange?: number
  yMin?: number
  yMax?: number
  onClick?: () => void
  buttons?: Array<{ label: string; onClick: () => void }>
}

// Component prop types
export interface HintContextType {
  hint: string | null
  setHint: (hint: string | null) => void
}

export interface PermissionsInfo {
  isAdmin: boolean
  isBuilder: boolean
}

// Event handler types
export type PointerEventHandler = (event: React.PointerEvent) => void
export type ChangeEventHandler<T> = (value: T) => void

// Option types
export interface SelectOption {
  label: string
  value: any
} 