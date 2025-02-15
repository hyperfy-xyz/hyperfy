import { System } from './System'

const BATCH_SIZE = 1000

/**
 * LOD System
 *
 * - Runs on both the server and client.
 * - Uses a cursor to iterate and switch a maximum of X lods per frame
 *
 */
export class LODs extends System {
  constructor(world) {
    super(world)
    this.nodes = []
    this.cursor = 0
  }

  register(node) {
    this.nodes.push(node)
  }

  unregister(node) {
    const idx = this.nodes.indexOf(node)
    if (idx === -1) return
    this.nodes.splice(idx, 1)
  }

  update(delta) {
    // check if lods need to switch (batched over multiple frames)
    const size = Math.min(this.nodes.length, BATCH_SIZE)
    for (let i = 0; i < size; i++) {
      const idx = (this.cursor + i) % this.nodes.length
      const node = this.nodes[idx]
      if (!node) continue
      node.check()
    }
    if (size) {
      this.cursor = (this.cursor + size) % this.nodes.length
    }
  }
}
