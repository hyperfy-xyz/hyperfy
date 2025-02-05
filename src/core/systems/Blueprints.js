import { isEqual, merge } from 'lodash-es'
import { System } from './System'

/**
 * Blueprints System
 *
 * - Runs on both the server and client.
 * - A central registry for app blueprints
 *
 */
export class Blueprints extends System {
  constructor(world) {
    super(world)
    this.items = new Map()
  }

  get(id) {
    return this.items.get(id)
  }

  add(data, local) {
    this.items.set(data.id, data)
    if (local) {
      this.world.network.send('blueprintAdded', data)
    }
  }

  modify(data) {
    const blueprint = this.items.get(data.id)
    const modified = {
      ...blueprint,
      ...data,
    }
    const changed = !isEqual(blueprint, modified)
    if (!changed) return
    this.items.set(blueprint.id, modified)
    for (const [_, entity] of this.world.entities.items) {
      if (entity.blueprint === blueprint) {
        entity.data.state = {}
        entity.build()
      }
    }
    this.emit('modify', modified)
  }

  serialize() {
    const datas = []
    this.items.forEach(data => {
      datas.push(data)
    })
    return datas
  }

  deserialize(datas) {
    const preloads = []
    for (const data of datas) {
      this.add(data)
      if (data.preload) {
        if (data.model) {
          const type = data.model.endsWith('.vrm') ? 'avatar' : 'model'
          preloads.push({ type, url: data.model })
        }
        if (data.script) {
          preloads.push({ type: 'script', url: data.script })
        }
        for (const value of Object.values(data.props || {})) {
          if (value === undefined || value === null || !value?.url || !value?.type) continue
          preloads.push({ type: value.type, url: value.url })
        }
      }
    }
    this.world.loader.preload(preloads)
  }
}
