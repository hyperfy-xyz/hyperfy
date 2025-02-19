import { System } from './System'

/**
 * Anchor System
 *
 * - Runs on both the server and client.
 * - Keeps track of anchors for easy access by player entities
 *
 */
export class Anchors extends System {
  constructor(world) {
    super(world)
    this.matrices = new Map()
  }

  get(id) {
    return this.matrices.get(id)
  }

  add(id, matrix) {
    this.matrices.set(id, matrix)
  }

  remove(id) {
    this.matrices.delete(id)
  }
}
