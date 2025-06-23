import type { AppData, Blueprint, EventCallback, HotReloadable } from '../../types/core'
import { createNode } from '../extras/createNode'
import { createPlayerProxy } from '../extras/createPlayerProxy'
import { LerpQuaternion } from '../extras/LerpQuaternion'
import { LerpVector3 } from '../extras/LerpVector3'
import { Entity } from './Entity'

const hotEventNames = ['fixedUpdate', 'update', 'lateUpdate']

const Modes = {
  ACTIVE: 'active',
  MOVING: 'moving',
  LOADING: 'loading',
  CRASHED: 'crashed',
}

interface EventQueueItem {
  version: number;
  name: string;
  data: any;
  networkId: string;
}

export class App extends Entity implements HotReloadable {
  isApp: boolean;
  n: number;
  worldNodes: Set<any>;
  hotEvents: number;
  worldListeners: Map<EventCallback, string>;
  listeners: Record<string, Set<EventCallback>>;
  eventQueue: EventQueueItem[];
  snaps: any[];
  root: any;
  fields: any[];
  target: any;
  projectLimit: number;
  keepActive: boolean;
  playerProxies: Map<string, any>;
  hitResultsPool: any[];
  hitResults: any[];
  deadHook: { dead: boolean };
  building?: boolean;
  blueprint?: Blueprint;
  mode?: string;
  abortController?: AbortController;
  script?: any;
  networkPos?: LerpVector3;
  networkQuat?: LerpQuaternion;
  networkSca?: LerpVector3;
  control?: any;
  onFields?: (fields: any[]) => void;
  destroyed?: boolean;
  worldProxy?: any;
  appProxy?: any;
  
  declare data: AppData;
  
  constructor(world: any, data: AppData, local?: boolean) {
    super(world, data, local)
    this.isApp = true
    this.n = 0
    this.worldNodes = new Set()
    this.hotEvents = 0
    this.worldListeners = new Map()
    this.listeners = {}
    this.eventQueue = []
    this.snaps = []
    this.root = createNode('group')
    this.fields = []
    this.target = null
    this.projectLimit = Infinity
    this.keepActive = false
    this.playerProxies = new Map()
    this.hitResultsPool = []
    this.hitResults = []
    this.deadHook = { dead: false }
    this.build()
  }

  createNode(name: string, data?: any): any {
    const node = createNode(name, data)
    return node
  }

  async build(crashed?: boolean): Promise<void> {
    this.building = true
    const n = ++this.n
    // fetch blueprint
    const blueprint = this.world.blueprints.get(this.data.blueprint)

    if (!blueprint || blueprint.disabled) {
      this.unbuild()
      this.blueprint = blueprint ?? undefined
      this.building = false
      return
    }

    let root
    let script
    // if someone else is uploading glb, show a loading indicator
    if (this.data.uploader && this.data.uploader !== this.world.network?.id) {
      root = createNode('mesh')
      root.type = 'box'
      root.width = 1
      root.height = 1
      root.depth = 1
    }
    // otherwise we can load the model and script
    else {
      try {
        if (blueprint.model) {
          const type = blueprint.model.endsWith('vrm') ? 'avatar' : 'model'
          let glb = this.world.loader?.get(type, blueprint.model)
          if (!glb) glb = await this.world.loader?.load(type, blueprint.model)
          root = glb?.toNodes()
        }
      } catch (err) {
        console.error(err)
        crashed = true
        // no model, will use crash block below
      }
      // fetch script (if any)
      if (blueprint.script) {
        try {
          script = this.world.loader?.get('script', blueprint.script)
          if (!script) script = await this.world.loader?.load('script', blueprint.script)
        } catch (err) {
          console.error(err)
          crashed = true
        }
      }
    }
    // if script crashed (or failed to load model), show crash-block
    if (crashed || !root) {
      let glb = this.world.loader?.get('model', 'asset://crash-block.glb')
      if (!glb) glb = await this.world.loader?.load('model', 'asset://crash-block.glb')
      root = glb?.toNodes()
    }
    // if a new build happened while we were fetching, stop here
    if (this.n !== n) return
    // unbuild any previous version
    this.unbuild()
    // mode
    this.mode = Modes.ACTIVE
    if (this.data.mover) this.mode = Modes.MOVING
    if (this.data.uploader && this.data.uploader !== this.world.network?.id) this.mode = Modes.LOADING
    // setup
    this.blueprint = blueprint
    this.root = root
    this.root.position.fromArray(this.data.position)
    this.root.quaternion.fromArray(this.data.quaternion)
    this.root.scale.fromArray(this.data.scale || [1, 1, 1])
    // activate
    this.root.activate({ world: this.world, entity: this, moving: !!this.data.mover })
    // execute script
    const runScript =
      (this.mode === Modes.ACTIVE && script && !crashed) || (this.mode === Modes.MOVING && this.keepActive)
    if (runScript) {
      this.abortController = new AbortController()
      this.script = script
      this.keepActive = false // allow script to re-enable
      try {
        this.script.exec(this.getWorldProxy(), this.getAppProxy(), this.fetch, blueprint.props || {}, this.setTimeout)
      } catch (err) {
        console.error('script crashed')
        console.error(err)
        return this.crash()
      }
    }
    // if moving we need updates
    if (this.mode === Modes.MOVING) {
      this.world.setHot(this, true)
      // and we need a list of any snap points
      this.snaps = []
      this.root.traverse((node: any) => {
        if (node.name === 'snap') {
          this.snaps.push(node.worldPosition)
        }
      })
    }
    // if remote is moving, set up to receive network updates
    this.networkPos = new LerpVector3(root.position, this.world.networkRate)
    this.networkQuat = new LerpQuaternion(root.quaternion, this.world.networkRate)
    this.networkSca = new LerpVector3(root.scale, this.world.networkRate)
    // execute any events we collected while building
    while (this.eventQueue.length) {
      const event = this.eventQueue[0]
      if (!event || !this.blueprint || event.version > this.blueprint.version) break // ignore future versions
      this.eventQueue.shift()
      this.emit(event.name, event.data, event.networkId)
    }
    // finished!
    this.building = false
  }

  unbuild() {
    // notify any running script
    this.emit('destroy')
    // cancel any control
    this.control?.release()
    this.control = null
    // cancel any effects
    this.playerProxies.forEach(player => {
      player.cancelEffect()
    })
    // deactivate local node
    this.root?.deactivate()
    // deactivate world nodes
    const worldNodesArray = Array.from(this.worldNodes)
    for (const node of worldNodesArray) {
      node.deactivate()
    }
    this.worldNodes.clear()
    // clear script event listeners
    this.clearEventListeners()
    this.hotEvents = 0
    // cancel update tracking
    this.world.setHot(this, false)
    // abort fetch's etc
    this.abortController?.abort()
    this.abortController = undefined
    // mark dead and re-create hook (timers, async etc)
    this.deadHook.dead = true
    this.deadHook = { dead: false }
    // clear fields
    this.onFields?.([])
  }

  fixedUpdate(delta: number): void {
    // if someone else is moving the app, interpolate updates
    if (this.data.mover && this.data.mover !== this.world.network?.id) {
      this.networkPos!.update(delta)
      this.networkQuat!.update(delta)
      this.networkSca!.update(delta)
    }
    // script fixedUpdate()
    if (this.mode === Modes.ACTIVE && this.script) {
      try {
        this.emit('fixedUpdate', delta)
      } catch (err) {
        console.error('script fixedUpdate crashed', this)
        console.error(err)
        this.crash()
        return
      }
    }
  }

  update(delta: number): void {
    // if someone else is moving the app, interpolate updates
    if (this.data.mover && this.data.mover !== this.world.network?.id) {
      this.networkPos!.update(delta)
      this.networkQuat!.update(delta)
      this.networkSca!.update(delta)
    }
    // script update()
    if (this.mode === Modes.ACTIVE && this.script) {
      try {
        this.emit('update', delta)
      } catch (err) {
        console.error('script update() crashed', this)
        console.error(err)
        this.crash()
        return
      }
    }
  }

  lateUpdate(delta: number): void {
    if (this.mode === Modes.ACTIVE && this.script) {
      try {
        this.emit('lateUpdate', delta)
      } catch (err) {
        console.error('script lateUpdate() crashed', this)
        console.error(err)
        this.crash()
        return
      }
    }
  }

  onUploaded() {
    this.data.uploader = undefined
    this.world.network?.send('entityModified', { id: this.data.id, uploader: null })
  }

  override modify(data: Partial<AppData>) {
    let rebuild
    if (data.hasOwnProperty('blueprint')) {
      this.data.blueprint = data.blueprint!
      rebuild = true
    }
    if (data.hasOwnProperty('uploader')) {
      this.data.uploader = data.uploader
      rebuild = true
    }
    if (data.hasOwnProperty('mover')) {
      this.data.mover = data.mover
      rebuild = true
    }
    if (data.hasOwnProperty('position')) {
      this.data.position = data.position!
      if (this.data.mover) {
        this.networkPos!.pushArray(data.position!)
      } else {
        rebuild = true
      }
    }
    if (data.hasOwnProperty('quaternion')) {
      this.data.quaternion = data.quaternion!
      if (this.data.mover) {
        this.networkQuat!.pushArray(data.quaternion!)
      } else {
        rebuild = true
      }
    }
    if (data.hasOwnProperty('scale')) {
      this.data.scale = data.scale
      if (this.data.mover) {
        this.networkSca!.pushArray(data.scale!)
      } else {
        rebuild = true
      }
    }
    if (data.hasOwnProperty('pinned')) {
      this.data.pinned = data.pinned
    }
    if (data.hasOwnProperty('state')) {
      this.data.state = data.state
      rebuild = true
    }
    if (rebuild) {
      this.build()
    }
  }

  crash() {
    this.build(true)
  }

  override destroy(local?: boolean) {
    if (this.destroyed) return
    this.destroyed = true

    this.unbuild()

    this.world.entities.remove(this.data.id)
    // if removed locally we need to broadcast to server/clients
    if (local) {
      this.world.network?.send('entityRemoved', this.data.id)
    }
  }

  on(name: string, callback: EventCallback) {
    if (!this.listeners[name]) {
      this.listeners[name] = new Set()
    }
    if (this.listeners[name].has(callback)) return
    this.listeners[name].add(callback)
    if (hotEventNames.includes(name)) {
      this.hotEvents++
      this.world.setHot(this, this.hotEvents > 0)
    }
  }

  off(name: string, callback: EventCallback) {
    if (!this.listeners[name]) return
    if (!this.listeners[name].has(callback)) return
    this.listeners[name].delete(callback)
    if (hotEventNames.includes(name)) {
      this.hotEvents--
      this.world.setHot(this, this.hotEvents > 0)
    }
  }

  emit(name: string, a1?: any, a2?: any) {
    if (!this.listeners[name]) return
    const callbacks = Array.from(this.listeners[name])
    for (const callback of callbacks) {
      callback(a1, a2)
    }
  }

  onWorldEvent(name: string, callback: EventCallback) {
    this.worldListeners.set(callback, name)
    this.world.events.on(name, callback)
  }

  offWorldEvent(name: string, callback: EventCallback) {
    this.worldListeners.delete(callback)
    this.world.events.off(name, callback)
  }

  clearEventListeners() {
    // local
    this.listeners = {}
    // world
    const worldListenersArray = Array.from(this.worldListeners)
    for (const [callback, name] of worldListenersArray) {
      this.world.events.off(name, callback)
    }
    this.worldListeners.clear()
  }

  override onEvent(version: number, name: string, data: any, networkId: string) {
    if (this.building || !this.blueprint || version > this.blueprint.version) {
      this.eventQueue.push({ version, name, data, networkId })
    } else {
      this.emit(name, data, networkId)
    }
  }

  fetch = async (url: string, options: RequestInit = {}): Promise<any> => {
    try {
      const resp = await fetch(url, {
        ...options,
        signal: this.abortController?.signal,
      })
      const secureResp = {
        ok: resp.ok,
        status: resp.status,
        statusText: resp.statusText,
        headers: Object.fromEntries(resp.headers.entries()),
        json: async () => await resp.json(),
        text: async () => await resp.text(),
        blob: async () => await resp.blob(),
        arrayBuffer: async () => await resp.arrayBuffer(),
      }
      return secureResp
    } catch (err) {
      console.error(err)
      // this.crash()
      return undefined
    }
  }

  setTimeout = (fn: () => void, ms: number) => {
    const hook = this.getDeadHook()
    const timerId = setTimeout(() => {
      if (hook.dead) return
      fn()
    }, ms)
    return timerId
  }

  getDeadHook = () => {
    return this.deadHook
  }

  getNodes() {
    // note: this is currently just used in the nodes tab in the app inspector
    // to get a clean hierarchy
    if (!this.blueprint?.model) return
    const type = this.blueprint.model.endsWith('vrm') ? 'avatar' : 'model'
    let glb = this.world.loader?.get(type, this.blueprint.model)
    if (!glb) return
    return glb.toNodes()
  }

  getPlayerProxy(playerId?: string) {
    if (playerId === undefined) playerId = this.world.entities.player?.data.id
    if (!playerId) return null
    let proxy = this.playerProxies.get(playerId)
    if (!proxy || proxy.destroyed) {
      const player = this.world.entities.getPlayer(playerId)
      if (!player) return null
      proxy = createPlayerProxy(this, player)
      this.playerProxies.set(playerId, proxy)
    }
    return proxy
  }

  getWorldProxy() {
    if (!this.worldProxy) {
      const entity = this
      const getters = this.world.apps.worldGetters
      const setters = this.world.apps.worldSetters
      const methods = this.world.apps.worldMethods
      this.worldProxy = new Proxy(
        {},
        {
          get: (_target, prop) => {
            // getters
            if (getters && prop in getters) {
              return getters[prop as string](entity)
            }
            // methods
            if (methods && prop in methods) {
              const method = methods[prop as string]
              return (...args: any[]) => {
                return method(entity, ...args)
              }
            }
            return undefined
          },
          set: (_target, prop, value) => {
            // setters
            if (setters && prop in setters) {
              setters[prop as string](entity, value)
              return true
            }
            return true
          },
        }
      )
    }
    return this.worldProxy
  }

  getAppProxy() {
    if (!this.appProxy) {
      const entity = this
      const getters = this.world.apps.appGetters
      const setters = this.world.apps.appSetters
      const methods = this.world.apps.appMethods
      this.appProxy = new Proxy(
        {},
        {
          get: (_target, prop) => {
            // getters
            if (getters && prop in getters) {
              return getters[prop as string](entity)
            }
            // methods
            if (methods && prop in methods) {
              const method = methods[prop as string]
              return (...args: any[]) => {
                return method(entity, ...args)
              }
            }
            // root node props
            return entity.root.getProxy()[prop]
          },
          set: (_target, prop, value) => {
            // setters
            if (setters && prop in setters) {
              setters[prop as string](entity, value)
              return true
            }
            // root node props
            if (prop in entity.root.getProxy()) {
              entity.root.getProxy()[prop] = value
              return true
            }
            return true
          },
        }
      )
    }
    return this.appProxy
  }
}
