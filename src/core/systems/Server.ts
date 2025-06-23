import { System } from './System'

const TICK_RATE = 1 / 30

/**
 * Server System
 *
 * - Runs on the server
 * - Ticks!
 *
 */
export class Server extends System {
  private timerId: NodeJS.Timeout | null
  
  constructor(world: any) {
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
