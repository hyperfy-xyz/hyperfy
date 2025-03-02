import EventEmitter from 'eventemitter3'

/**
 * System Class
 *
 * - The base class all systems inherit from
 * - Includes lifecycle methods for startup and simulation etc
 *
 */
export class System extends EventEmitter {
  constructor(world) {
    super()
    this.world = world
  }

  async init() {
    // runs once when world is initialized, used to asynchronously allow systems to set themselves up
  }

  start() {
    // runs once after all systems are initialized, and before the world begins simulating
  }

  preTick() {
    // runs right at the beginning of the tick, eg
    // - begin performance monitoring
  }

  preFixedUpdate(willFixedStep) {
    // runs before any fixed updates, eg
    // - prepare physics
    // - read input telemetry on client
  }

  fixedUpdate(delta) {
    // runs at a fixed timestep using an accumulator, eg
    // - physics based changes like applying forces
  }

  postFixedUpdate() {
    // runs after every fixed update, eg
    // - step physics simulation
  }

  preUpdate(alpha) {
    // runs before update, eg
    // - physics interpolation for remaining delta
  }

  update(delta) {
    // runs in non-fixed time steps (refresh rate), eg
    // - regular entity updates
    // - interpolation or animations
  }

  postUpdate() {
    // runs after every update, eg
    // - cleaning dirty node matrices
  }

  lateUpdate(delta) {
    // runs late, ie after matrices have all been updated, eg
    // - attaching things to other things at the correct place
  }

  postLateUpdate() {
    // runs after every late update, eg
    // - cleaning dirty node matrices
  }

  commit() {
    // runs at the very end of a tick, eg
    // - clearing or finalizing input telemetry
    // - rendering to the viewport on the client
  }

  postTick() {
    // runs at the very end of a tick, eg
    // - end performance monitoring
  }

  destroy() {
    // runs when the world is destroyed, eg
    // - stop animating, disconnect connections, cleanup
  }
}
