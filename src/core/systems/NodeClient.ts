import { num } from '../utils'
import { System } from './System'
import type { World } from '../../types'

const TICK_RATE = 1 / 30

/**
 * Node Client System
 *
 * - Runs on node
 * - Ticks!
 *
 */
export class NodeClient extends System {
  timerId: NodeJS.Timeout | null
  
  constructor(world: World) {
    super(world)
    this.timerId = null
  }

  start() {
    this.tick()
  }

  tick = () => {
    const time = performance.now()
    this.world.tick(time)
    this.timerId = setTimeout(this.tick, TICK_RATE * 1000)
  }

  destroy() {
    if (this.timerId) {
      clearTimeout(this.timerId)
    }
  }
}
