/**
 * Idle Behavior
 *
 * - Mob does nothing
 * - Default state
 *
 */
export class Idle {
  constructor(options = {}) {
    this.options = {
      ...options,
    }
  }

  onEnter() {
    if (!this.controller) return
    const mob = this.controller.mob
    mob.degen.idle()
  }

  update(delta) {
    // Do nothing while idle
    // Other systems can switch to different behaviors as needed
  }

  onExit() {
    // Cleanup if needed
  }
}
