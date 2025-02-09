import { System } from './System'
import { SnapOctree } from '../extras/SnapOctree'

/**
 * Snaps System
 *
 * - Runs on the client
 * - Registers snap points
 * - Allows snap point queries
 *
 */

export class Snaps extends System {
  constructor(world) {
    super(world)
    this.octree = new SnapOctree({
      center: new THREE.Vector3(0, 0, 0),
      size: 10,
    })
  }

  create(position, active) {
    const point = {
      position,
      active,
    }
    this.octree.insert(point)
    const handle = {
      move: () => {
        this.octree.move(point)
      },
      destroy: () => {
        this.octree.remove(point)
      },
    }
    return handle
  }
}
