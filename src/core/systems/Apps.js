import moment from 'moment'
import { isArray, isEqual, isFunction, isNumber } from 'lodash-es'
import * as THREE from '../extras/three'

import { System } from './System'
import { getRef } from '../nodes/Node'
import { Layers } from '../extras/Layers'
import { ControlPriorities } from '../extras/ControlPriorities'
import { warn } from '../extras/warn'

const internalEvents = ['fixedUpdate', 'updated', 'lateUpdate', 'destroy', 'enter', 'leave', 'chat', 'health']

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
    this.initWorldApi()
    this.initAppApi()
  }

  initWorldApi() {
    const self = this
    const world = this.world
    this.worldApi = {
      getNetworkId(entity) {
        return world.network.id
      },
      getIsServer(entity) {
        return world.network.isServer
      },
      getIsClient(entity) {
        return world.network.isClient
      },
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
        if (maxDistance !== undefined && !isNumber(maxDistance)) throw new Error('[raycast] maxDistance must be number')
        if (layerMask !== undefined && layerMask !== null && !isNumber(layerMask))
          throw new Error('[raycast] layerMask must be number')
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
    }
  }

  initAppApi() {
    const world = this.world
    this.appApi = {
      getInstanceId(entity) {
        return entity.data.id
      },
      getVersion(entity) {
        return entity.blueprint.version
      },
      getModelUrl(entity) {
        return entity.blueprint.model
      },
      getState(entity) {
        return entity.data.state
      },
      setState(entity, value) {
        entity.data.state = value
      },
      getProps(entity) {
        return entity.blueprint.props
      },
      getConfig(entity) {
        // deprecated. will be removed
        return entity.blueprint.props
      },
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
      get(entity, id) {
        const node = entity.root.get(id)
        if (!node) return null
        return node.getProxy()
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

  augment({ global, world, app }) {
    // todo: globals
    if (world) {
      this.worldApi = {
        ...this.worldApi,
        ...world,
      }
    }
    if (app) {
      this.appApi = {
        ...this.appApi,
        ...app,
      }
    }
  }
}
