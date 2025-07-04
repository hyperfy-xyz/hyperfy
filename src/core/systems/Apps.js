import moment from 'moment'
import { isArray, isEqual, isFunction, isNumber } from 'lodash-es'
import * as THREE from '../extras/three'

import { System } from './System'
import { getRef } from '../nodes/Node'
import { Layers } from '../extras/Layers'
import { ControlPriorities } from '../extras/ControlPriorities'
import { warn } from '../extras/warn'

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

/**
 * Apps System
 *
 * - Runs on both the server and client.
 * - A single place to manage app runtime methods used by all apps
 *
 */
export class Apps extends System {
  constructor(world) {
    super(world)
    this.initWorldHooks()
    this.initAppHooks()
  }

  initWorldHooks() {
    const self = this
    const world = this.world
    const allowLoaders = ['avatar', 'model']
    this.worldGetters = {
      networkId(entity) {
        return world.network.id
      },
      isServer(entity) {
        return world.network.isServer
      },
      isClient(entity) {
        return world.network.isClient
      },
    }
    this.worldSetters = {
      // ...
    }
    this.worldMethods = {
      add(entity, pNode) {
        const node = getRef(pNode)
        if (!node) return
        if (node.parent) {
          node.parent.remove(node)
        }
        entity.worldNodes.add(node)
        node.activate({ world, entity })
      },
      remove(entity, pNode) {
        const node = getRef(pNode)
        if (!node) return
        if (node.parent) return // its not in world
        if (!entity.worldNodes.has(node)) return
        entity.worldNodes.delete(node)
        node.deactivate()
      },
      attach(entity, pNode) {
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
        entity.worldNodes.add(node)
      },
      on(entity, name, callback) {
        entity.onWorldEvent(name, callback)
      },
      off(entity, name, callback) {
        entity.offWorldEvent(name, callback)
      },
      emit(entity, name, data) {
        if (internalEvents.includes(name)) {
          return console.error(`apps cannot emit internal events (${name})`)
        }
        warn('world.emit() is deprecated, use app.emit() instead')
        world.events.emit(name, data)
      },
      getTime(entity) {
        return world.network.getTime()
      },
      getTimestamp(entity, format) {
        if (!format) return moment().toISOString()
        return moment().format(format)
      },
      chat(entity, msg, broadcast) {
        if (!msg) return
        world.chat.add(msg, broadcast)
      },
      getPlayer(entity, playerId) {
        return entity.getPlayerProxy(playerId)
      },
      getPlayers(entity) {
        // tip: probably dont wanna call this every frame
        const players = []
        world.entities.players.forEach(player => {
          players.push(entity.getPlayerProxy(player.data.id))
        })
        return players
      },
      createLayerMask(entity, ...groups) {
        let mask = 0
        for (const group of groups) {
          if (!Layers[group]) throw new Error(`[createLayerMask] invalid group: ${group}`)
          mask |= Layers[group].group
        }
        return mask
      },
      raycast(entity, origin, direction, maxDistance, layerMask) {
        if (!origin?.isVector3) throw new Error('[raycast] origin must be Vector3')
        if (!direction?.isVector3) throw new Error('[raycast] direction must be Vector3')
        if (maxDistance !== undefined && maxDistance !== null && !isNumber(maxDistance)) {
          throw new Error('[raycast] maxDistance must be number')
        }
        if (layerMask !== undefined && layerMask !== null && !isNumber(layerMask)) {
          throw new Error('[raycast] layerMask must be number')
        }
        const hit = world.physics.raycast(origin, direction, maxDistance, layerMask)
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
        self.raycastHit.tag = hit.handle?.tag
        self.raycastHit.playerId = hit.handle?.playerId
        return self.raycastHit
      },
      overlapSphere(entity, radius, origin, layerMask) {
        const hits = world.physics.overlapSphere(radius, origin, layerMask)
        return hits.map(hit => {
          return hit.proxy
        })
      },
      get(entity, key) {
        return world.storage?.get(key)
      },
      set(entity, key, value) {
        world.storage?.set(key, value)
      },
      open(entity, url, newWindow = false) {
        if (!url) {
          console.error('[world.open] URL is required')
          return
        }

        if (world.network.isClient) {
          try {
            const resolvedUrl = world.resolveURL(url)

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
      load(entity, type, url) {
        return new Promise(async (resolve, reject) => {
          const hook = entity.getDeadHook()
          try {
            if (!allowLoaders.includes(type)) {
              return reject(new Error(`cannot load type: ${type}`))
            }
            let glb = world.loader.get(type, url)
            if (!glb) glb = await world.loader.load(type, url)
            if (hook.dead) return
            const root = glb.toNodes()
            resolve(type === 'avatar' ? root.children[0] : root)
          } catch (err) {
            if (hook.dead) return
            reject(err)
          }
        })
      },
      spawnMesh(entity, opts = {}) {
        const node = entity.createNode('mesh', opts)
        self.worldMethods.add(entity, node)
        
        // Optionally add rigidbody with matching collider
        if (opts.rigidbody) {
          const rbOpts = typeof opts.rigidbody === 'object' ? opts.rigidbody : {}
          
          // Create rigidbody as a parent
          const rigidbody = entity.createNode('rigidbody', {
            type: rbOpts.type || 'dynamic',
            mass: rbOpts.mass || 1,
            linearDamping: rbOpts.linearDamping || 0,
            angularDamping: rbOpts.angularDamping || 0.05,
            tag: rbOpts.tag,
            onContactStart: rbOpts.onContactStart,
            onContactEnd: rbOpts.onContactEnd,
            onTriggerEnter: rbOpts.onTriggerEnter,
            onTriggerLeave: rbOpts.onTriggerLeave
          })
          
          // Create matching collider
          const colliderOpts = {
            type: opts.type, // Use same type as mesh
            trigger: rbOpts.trigger || false,
            convex: rbOpts.convex || false,
            layer: rbOpts.layer || 'prop'
          }
          
          // Set dimensions based on primitive type
          if (opts.type === 'box') {
            colliderOpts.width = opts.width || 1
            colliderOpts.height = opts.height || 1
            colliderOpts.depth = opts.depth || 1
          } else if (opts.type === 'sphere') {
            colliderOpts.radius = opts.radius || 0.5
          } else if (opts.type === 'cylinder' || opts.type === 'cone') {
            // For cylinder/cone, use box approximation or custom geometry
            // Box approximation based on dimensions
            colliderOpts.type = 'box'
            colliderOpts.width = (opts.radiusBottom || opts.radius || 0.5) * 2
            colliderOpts.height = opts.height || 1
            colliderOpts.depth = (opts.radiusBottom || opts.radius || 0.5) * 2
          }
          
          const collider = entity.createNode('collider', colliderOpts)
          rigidbody.add(collider)
          
          // Copy mesh position to rigidbody and clear mesh position
          rigidbody.position.copy(node.position)
          rigidbody.rotation.copy(node.rotation)
          rigidbody.scale.copy(node.scale)
          node.position.set(0, 0, 0)
          node.rotation.set(0, 0, 0)
          node.scale.set(1, 1, 1)
          
          // Add mesh as child of rigidbody
          rigidbody.add(node)
          self.worldMethods.add(entity, rigidbody)
          
          // Get proxies
          const rbProxy = rigidbody.getProxy()
          const meshProxy = node.getProxy()
          
          // Add material property that forwards to the mesh child
          Object.defineProperty(rbProxy, 'material', {
            get() {
              // Return the mesh proxy's material
              return meshProxy.material
            },
            configurable: true
          })
          
          // Return the enhanced rigidbody proxy
          return rbProxy
        }
        
        return node.getProxy()
      },
      box(entity, dims = {}) {
        return self.worldMethods.spawnMesh(entity, { type: 'box', ...dims })
      },
      sphere(entity, dims = {}) {
        return self.worldMethods.spawnMesh(entity, { type: 'sphere', ...dims })
      },
      cylinder(entity, dims = {}) {
        return self.worldMethods.spawnMesh(entity, { type: 'cylinder', ...dims })
      },
      cone(entity, dims = {}) {
        return self.worldMethods.spawnMesh(entity, { type: 'cone', ...dims })
      },
    }
  }

  initAppHooks() {
    const world = this.world
    this.appGetters = {
      instanceId(entity) {
        return entity.data.id
      },
      version(entity) {
        return entity.blueprint.version
      },
      modelUrl(entity) {
        return entity.blueprint.model
      },
      state(entity) {
        return entity.data.state
      },
      props(entity) {
        return entity.blueprint.props
      },
      config(entity) {
        // deprecated. will be removed
        return entity.blueprint.props
      },
      keepActive(entity) {
        return entity.keepActive
      },
    }
    this.appSetters = {
      state(entity, value) {
        entity.data.state = value
      },
      keepActive(entity, value) {
        entity.keepActive = value
      },
    }
    this.appMethods = {
      on(entity, name, callback) {
        entity.on(name, callback)
      },
      off(entity, name, callback) {
        entity.off(name, callback)
      },
      send(entity, name, data, ignoreSocketId) {
        if (internalEvents.includes(name)) {
          return console.error(`apps cannot send internal events (${name})`)
        }
        // NOTE: on the client ignoreSocketId is a no-op because it can only send events to the server
        const event = [entity.data.id, entity.blueprint.version, name, data]
        world.network.send('entityEvent', event, ignoreSocketId)
      },
      sendTo(entity, playerId, name, data) {
        if (internalEvents.includes(name)) {
          return console.error(`apps cannot send internal events (${name})`)
        }
        if (!world.network.isServer) {
          throw new Error('sendTo can only be called on the server')
        }
        const player = world.entities.get(playerId)
        if (!player) return
        const event = [entity.data.id, entity.blueprint.version, name, data]
        world.network.sendTo(playerId, 'entityEvent', event)
      },
      emit(entity, name, data) {
        if (internalEvents.includes(name)) {
          return console.error(`apps cannot emit internal events (${name})`)
        }
        world.events.emit(name, data)
      },
      create(entity, name, data) {
        const node = entity.createNode(name, data)
        return node.getProxy()
      },
      control(entity, options) {
        entity.control?.release()
        // TODO: only allow on user interaction
        // TODO: show UI with a button to release()
        entity.control = world.controls.bind({
          ...options,
          priority: ControlPriorities.APP,
          object: entity,
        })
        return entity.control
      },
      configure(entity, fnOrArray) {
        if (isArray(fnOrArray)) {
          entity.fields = fnOrArray
        } else if (isFunction(fnOrArray)) {
          entity.fields = fnOrArray() // deprecated
        }
        if (!isArray(entity.fields)) {
          entity.fields = []
        }
        // apply any initial values
        const props = entity.blueprint.props
        for (const field of entity.fields) {
          if (field.initial !== undefined && props[field.key] === undefined) {
            props[field.key] = field.initial
          }
        }
        entity.onFields?.(entity.fields)
      },
    }
  }

  inject({ world, app }) {
    if (world) {
      for (const key in world) {
        const value = world[key]
        const isFunction = typeof value === 'function'
        if (isFunction) {
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
        const value = app[key]
        const isFunction = typeof value === 'function'
        if (isFunction) {
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
