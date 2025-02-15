import { App } from '../entities/App'
import { PlayerLocal } from '../entities/PlayerLocal'
import { PlayerRemote } from '../entities/PlayerRemote'
import { System } from './System'

const Types = {
  app: App,
  playerLocal: PlayerLocal,
  playerRemote: PlayerRemote,
}

/**
 * Entities System
 *
 * - Runs on both the server and client.
 * - Supports inserting entities into the world
 * - Executes entity scripts
 *
 */
export class Entities extends System {
  constructor(world) {
    super(world)
    this.items = new Map()
    this.players = new Map()
    this.hot = new Set()
    this.removed = []
  }

  get(id) {
    return this.items.get(id)
  }

  getPlayer(entityId) {
    return this.players.get(entityId)
  }

  add(data, local) {
    let Entity
    if (data.type === 'player') {
      Entity = Types[data.owner === this.world.network.id ? 'playerLocal' : 'playerRemote']
    } else {
      Entity = Types[data.type]
    }
    const entity = new Entity(this.world, data, local)
    this.items.set(entity.data.id, entity)
    if (data.type === 'player') {
      this.players.set(entity.data.id, entity)
    }
    if (data.owner === this.world.network.id) {
      this.player = entity
      this.world.emit('player', entity)
    }
    return entity
  }

  remove(id) {
    const entity = this.items.get(id)
    if (!entity) console.warn(`tried to remove entity that did not exist: ${id}`)
    if (entity.isPlayer) this.players.delete(entity.data.id)
    entity.destroy()
    this.items.delete(id)
    this.removed.push(id)
  }

  setHot(entity, hot) {
    if (hot) {
      this.hot.add(entity)
    } else {
      this.hot.delete(entity)
    }
  }

  fixedUpdate(delta) {
    for (const entity of this.hot) {
      entity.fixedUpdate(delta)
    }
  }

  update(delta) {
    for (const entity of this.hot) {
      entity.update(delta)
    }
  }

  lateUpdate(delta) {
    for (const entity of this.hot) {
      entity.lateUpdate(delta)
    }
  }

  serialize() {
    const data = []
    this.items.forEach(entity => {
      data.push(entity.serialize())
    })
    return data
  }

  deserialize(datas) {
    for (const data of datas) {
      this.add(data)
    }
  }
}
