import { num } from '../utils'
import { System } from './System'

const TICK_RATE = 1 / 30

/**
 * Node Client System
 *
 * - Runs on node
 * - Ticks!
 *
 */
export class NodeClient extends System {
  constructor(world) {
    super(world)
  }

  start() {
    this.tick()
  }

  tick = () => {
    const time = performance.now()
    this.world.tick(time)
    setTimeout(this.tick, TICK_RATE * 1000)
  }
}
