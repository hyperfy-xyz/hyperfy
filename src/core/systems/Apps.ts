import * as moment from 'moment'
import type { Entity, World } from '../../types/index.js'
import { ControlPriorities } from '../extras/ControlPriorities.js'
import { Layers } from '../extras/Layers.js'
import * as THREE from '../extras/three.js'
import { warn } from '../extras/warn.js'
import { getRef } from '../nodes/Node.js'
import { System } from './System.js'

// Helper functions to replace lodash
function isArray(value: any): value is any[] {
  return Array.isArray(value)
}

function isFunction(value: any): value is Function {
  return typeof value === 'function'
}

function isNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value)
}

const internalEvents = [
  'fixedUpdate',
  'updated',
  'lateUpdate',
  'destroy',
  'enter',
  'leave',
  'chat',
  'command',
  'health',
]

interface WorldHooks {
  getters: Record<string, (entity: Entity) => any>
  setters: Record<string, (entity: Entity, value: any) => void>
  methods: Record<string, (entity: Entity, ...args: any[]) => any>
}

interface AppHooks {
  getters: Record<string, (entity: Entity) => any>
  setters: Record<string, (entity: Entity, value: any) => void>
  methods: Record<string, (entity: Entity, ...args: any[]) => any>
}

interface RaycastHit {
  point: THREE.Vector3
  normal: THREE.Vector3
  distance: number
  tag: string | null
  playerId: string | null
}

/**
 * Apps System
 *
 * - Runs on both the server and client.
 * - A single place to manage app runtime methods used by all apps
 *
 */
export class Apps extends System {
  worldGetters: Record<string, (entity: Entity) => any>
  worldSetters: Record<string, (entity: Entity, value: any) => void>
  worldMethods: Record<string, (entity: Entity, ...args: any[]) => any>
  appGetters: Record<string, (entity: Entity) => any>
  appSetters: Record<string, (entity: Entity, value: any) => void>
  appMethods: Record<string, (entity: Entity, ...args: any[]) => any>
  private raycastHit: RaycastHit | null = null
  
  constructor(world: World) {
    super(world)
    this.worldGetters = {}
    this.worldSetters = {}
    this.worldMethods = {}
    this.appGetters = {}
    this.appSetters = {}
    this.appMethods = {}
    this.initWorldHooks()
    this.initAppHooks()
  }

  private initWorldHooks(): void {
    const self = this
    const world = this.world
    const allowLoaders = ['avatar', 'model']
    this.worldGetters = {
      networkId(_entity: Entity): string | number {
        return (world as any).network?.id
      },
      isServer(_entity: Entity): boolean {
        return (world as any).network?.isServer || false
      },
      isClient(_entity: Entity): boolean {
        return (world as any).network?.isClient || false
      },
    }
    this.worldSetters = {
      // ...
    }
    this.worldMethods = {
      add(entity: Entity, pNode: any): void {
        const node = getRef(pNode)
        if (!node) return
        if (node.parent) {
          node.parent.remove(node)
        }
        (entity as any).worldNodes?.add(node)
        node.activate({ world, entity })
      },
      remove(entity: Entity, pNode: any): void {
        const node = getRef(pNode)
        if (!node) return
        if (node.parent) return // its not in world
        if (!(entity as any).worldNodes?.has(node)) return
        (entity as any).worldNodes.delete(node)
        node.deactivate()
      },
      attach(entity: Entity, pNode: any): void {
        const node = getRef(pNode)
        if (!node) return
        const parent = node.parent
        if (!parent) return
        const finalMatrix = new THREE.Matrix4()
        finalMatrix.copy(node.matrix)
        let currentParent = node.parent
        while (currentParent) {
          finalMatrix.premultiply(currentParent.matrix)
          currentParent = currentParent.parent
        }
        parent.remove(node)
        finalMatrix.decompose(node.position, node.quaternion, node.scale)
        node.activate({ world, entity })
        (entity as any).worldNodes?.add(node)
      },
      on(entity: Entity, name: string, callback: (...args: any[]) => void): void {
        (entity as any).onWorldEvent?.(name, callback)
      },
      off(entity: Entity, name: string, callback: (...args: any[]) => void): void {
        (entity as any).offWorldEvent?.(name, callback)
      },
      emit(_entity: Entity, name: string, data?: any): void {
        if (internalEvents.includes(name)) {
          return console.error(`apps cannot emit internal events (${name})`)
        }
        warn('world.emit() is deprecated, use app.emit() instead')
        world.events.emit(name, data)
      },
      getTime(_entity: Entity): number {
        return (world as any).network?.getTime() || 0
      },
      getTimestamp(_entity: Entity, format?: string): string {
        if (!format) return moment.default().toISOString()
        return moment.default().format(format)
      },
      chat(_entity: Entity, msg: any, broadcast?: boolean): void {
        if (!msg) return
        (world as any).chat?.add(msg, broadcast)
      },
      getPlayer(entity: Entity, playerId: string): any {
        return (entity as any).getPlayerProxy?.(playerId)
      },
      getPlayers(entity: Entity): any[] {
        // tip: probably dont wanna call this every frame
        const players: any[] = []
        const entitiesAny = world.entities as any
        entitiesAny.players?.forEach((player: any) => {
          players.push((entity as any).getPlayerProxy?.(player.data.id))
        })
        return players
      },
      createLayerMask(_entity: Entity, ...groups: string[]): number {
        let mask = 0
        for (const group of groups) {
          if (!(Layers as any)[group]) throw new Error(`[createLayerMask] invalid group: ${group}`)
          mask |= (Layers as any)[group].group
        }
        return mask
      },
      raycast(_entity: Entity, origin: THREE.Vector3, direction: THREE.Vector3, maxDistance?: number, layerMask?: number): RaycastHit | null {
        if (!origin?.isVector3) throw new Error('[raycast] origin must be Vector3')
        if (!direction?.isVector3) throw new Error('[raycast] direction must be Vector3')
        if (maxDistance !== undefined && maxDistance !== null && !isNumber(maxDistance)) {
          throw new Error('[raycast] maxDistance must be number')
        }
        if (layerMask !== undefined && layerMask !== null && !isNumber(layerMask)) {
          throw new Error('[raycast] layerMask must be number')
        }
        const hit = (world as any).physics?.raycast(origin, direction, maxDistance, layerMask)
        if (!hit) return null
        if (!self.raycastHit) {
          self.raycastHit = {
            point: new THREE.Vector3(),
            normal: new THREE.Vector3(),
            distance: 0,
            tag: null,
            playerId: null,
          }
        }
        self.raycastHit.point.copy(hit.point)
        self.raycastHit.normal.copy(hit.normal)
        self.raycastHit.distance = hit.distance
        self.raycastHit.tag = hit.handle?.tag || null
        self.raycastHit.playerId = hit.handle?.playerId || null
        return self.raycastHit
      },
      overlapSphere(_entity: Entity, radius: number, origin: THREE.Vector3, layerMask?: number): any[] {
        const hits = (world as any).physics?.overlapSphere(radius, origin, layerMask) || []
        return hits.map((hit: any) => {
          return hit.proxy
        })
      },
      get(_entity: Entity, key: string): any {
        return (world as any).storage?.get(key)
      },
      set(_entity: Entity, key: string, value: any): void {
        (world as any).storage?.set(key, value)
      },
      open(_entity: Entity, url: string, newWindow: boolean = false): void {
        if (!url) {
          console.error('[world.open] URL is required')
          return
        }

        if ((world as any).network?.isClient) {
          try {
            const resolvedUrl = (world as any).resolveURL?.(url) || url

            setTimeout(() => {
              if (newWindow) {
                window.open(resolvedUrl, '_blank')
              } else {
                window.location.href = resolvedUrl
              }
            }, 0)

            console.log(`[world.open] Redirecting to: ${resolvedUrl} ${newWindow ? '(new window)' : ''}`)
          } catch (e) {
            console.error('[world.open] Failed to open URL:', e)
          }
        } else {
          console.warn('[world.open] URL redirection only works on client side')
        }
      },
      load(entity: Entity, type: string, url: string): Promise<any> {
        return new Promise(async (resolve, reject) => {
          const hook = (entity as any).getDeadHook?.()
          try {
            if (!allowLoaders.includes(type)) {
              return reject(new Error(`cannot load type: ${type}`))
            }
            let glb = (world as any).loader?.get(type, url)
            if (!glb) glb = await (world as any).loader?.load(type, url)
            if (hook?.dead) return
            const root = glb.toNodes()
            resolve(type === 'avatar' ? root.children[0] : root)
          } catch (err) {
            if (hook?.dead) return
            reject(err)
          }
        })
      },
    }
  }

  private initAppHooks(): void {
    const world = this.world
    this.appGetters = {
      instanceId(entity: Entity): string {
        return (entity as any).data?.id
      },
      version(entity: Entity): number {
        return (entity as any).blueprint?.version || 0
      },
      modelUrl(entity: Entity): string | null {
        return (entity as any).blueprint?.model || null
      },
      state(entity: Entity): any {
        return (entity as any).data?.state
      },
      props(entity: Entity): any {
        return (entity as any).blueprint?.props
      },
      config(entity: Entity): any {
        // deprecated. will be removed
        return (entity as any).blueprint?.props
      },
      keepActive(entity: Entity): boolean {
        return (entity as any).keepActive || false
      },
    }
    this.appSetters = {
      state(entity: Entity, value: any): void {
        if ((entity as any).data) {
          (entity as any).data.state = value
        }
      },
      keepActive(entity: Entity, value: boolean): void {
        (entity as any).keepActive = value
      },
    }
    this.appMethods = {
      on(entity: Entity, name: string, callback: (...args: any[]) => void): void {
        (entity as any).on?.(name, callback)
      },
      off(entity: Entity, name: string, callback: (...args: any[]) => void): void {
        (entity as any).off?.(name, callback)
      },
      send(entity: Entity, name: string, data?: any, ignoreSocketId?: string): void {
        if (internalEvents.includes(name)) {
          return console.error(`apps cannot send internal events (${name})`)
        }
        // NOTE: on the client ignoreSocketId is a no-op because it can only send events to the server
        const eventData: [string | undefined, number | undefined, string, any] = [
          (entity as any).data?.id, 
          (entity as any).blueprint?.version, 
          name, 
          data
        ]
        ;(world as any).network?.send('entityEvent', eventData, ignoreSocketId)
      },
      sendTo(entity: Entity, playerId: string, name: string, data?: any): void {
        if (internalEvents.includes(name)) {
          return console.error(`apps cannot send internal events (${name})`)
        }
        if (!(world as any).network?.isServer) {
          throw new Error('sendTo can only be called on the server')
        }
        const player = world.entities.get(playerId)
        if (!player) return
        const eventData: [string | undefined, number | undefined, string, any] = [
          (entity as any).data?.id, 
          (entity as any).blueprint?.version, 
          name, 
          data
        ]
        ;(world as any).network?.sendTo(playerId, 'entityEvent', eventData)
      },
      emit(_entity: Entity, name: string, data?: any): void {
        if (internalEvents.includes(name)) {
          return console.error(`apps cannot emit internal events (${name})`)
        }
        world.events.emit(name, data)
      },
      create(entity: Entity, name: string, data?: any): any {
        const node = (entity as any).createNode?.(name, data)
        return node?.getProxy?.()
      },
      control(entity: Entity, options: any): any {
        const entityAny = entity as any;
        if (entityAny.control) {
          entityAny.control.release()
        }
        // TODO: only allow on user interaction
        // TODO: show UI with a button to release()
        const worldAny = world as any;
        entityAny.control = worldAny.controls?.bind({
          ...options,
          priority: ControlPriorities.APP,
          object: entity,
        })
        return entityAny.control
      },
      configure(entity: Entity, fnOrArray: any[] | (() => any[])): void {
        if (isArray(fnOrArray)) {
          (entity as any).fields = fnOrArray
        } else if (isFunction(fnOrArray)) {
          (entity as any).fields = fnOrArray() // deprecated
        }
        if (!isArray((entity as any).fields)) {
          (entity as any).fields = []
        }
        // apply any initial values
        const props = (entity as any).blueprint?.props
        for (const field of (entity as any).fields) {
          if (field.initial !== undefined && props[field.key] === undefined) {
            props[field.key] = field.initial
          }
        }
        (entity as any).onFields?.((entity as any).fields)
      },
    }
  }

  inject({ world, app }: { world?: WorldHooks; app?: AppHooks }): void {
    if (world) {
      for (const key in world) {
        const value = (world as any)[key]
        const isFn = typeof value === 'function'
        if (isFn) {
          this.worldMethods[key] = value
          continue
        }
        if (value.get) {
          this.worldGetters[key] = value.get
        }
        if (value.set) {
          this.worldSetters[key] = value.set
        }
      }
    }
    if (app) {
      for (const key in app) {
        const value = (app as any)[key]
        const isFn = typeof value === 'function'
        if (isFn) {
          this.appMethods[key] = value
          continue
        }
        if (value.get) {
          this.appGetters[key] = value.get
        }
        if (value.set) {
          this.appSetters[key] = value.set
        }
      }
    }
  }
}
