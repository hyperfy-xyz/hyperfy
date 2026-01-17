import { System } from './System'

export class Collections extends System {
  constructor(world) {
    super(world)
    this.collections = []
  }

  init({ collections }) {
    try {
      if (!collections) {
        console.log('[collections] No collections data in options, skipping')
        return
      }

      this.deserialize(collections)
      console.log('[collections] ✓ System ready')

    } catch (error) {
      console.error('[collections] Initialization failed:', error)
      throw error
    }
  }

  get(id) {
    return this.collections.find(coll => coll.id === id)
  }

  deserialize(data) {
    if (!Array.isArray(data)) {
      throw new Error('Collections data must be an array')
    }

    if (data.length === 0) {
      throw new Error('No collections in deserialized data')
    }

    this.collections = data
    console.log(`[collections] deserialized ${data.length} collection(s)`)
  }

  serialize() {
    return this.collections
  }

  destroy() {
    this.collections = []
  }
}
