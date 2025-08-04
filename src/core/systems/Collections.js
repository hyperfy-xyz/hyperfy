import { System } from './System'

export class Collections extends System {
  constructor(world) {
    super(world)
    this.collections = []
  }

  init({ collections }) {
    if (collections) {
      this.deserialize(collections)
    }
  }

  get(id) {
    return this.collections.find(coll => coll.id === id)
  }

  deserialize(data) {
    this.collections = data
  }

  serialize() {
    return this.collections
  }

  destroy() {
    this.collections = []
  }
}
