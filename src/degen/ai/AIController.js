/**
 * AIController - Base AI controller for mob entities
 *
 * - Manages AI behavior state machine
 * - Coordinates sensors and behaviors
 * - Runs only on server
 *
 */
export class AIController {
  constructor(mob, options = {}) {
    this.mob = mob
    this.world = mob.world
    this.behaviors = new Map()
    this.sensors = new Map()
    this.currentBehavior = null
    this.enabled = true

    // Default options
    this.options = {
      updateRate: 0.1, // Update AI every 100ms (10Hz)
      ...options,
    }

    this.lastUpdate = 0

    // Bind to mob's aiUpdate event
    this.mob.on('aiUpdate', this.onUpdate.bind(this))
  }

  /**
   * Register a behavior
   * @param {string} name - Behavior name
   * @param {Object} behavior - Behavior instance
   */
  registerBehavior(name, behavior) {
    behavior.controller = this
    this.behaviors.set(name, behavior)
  }

  /**
   * Register a sensor
   * @param {string} name - Sensor name
   * @param {Object} sensor - Sensor instance
   */
  registerSensor(name, sensor) {
    sensor.controller = this
    this.sensors.set(name, sensor)
  }

  /**
   * Switch to a different behavior
   * @param {string} name - Behavior name
   */
  setBehavior(name) {
    const behavior = this.behaviors.get(name)
    if (!behavior) {
      console.warn(`[AIController] behavior not found: ${name}`)
      return
    }

    // Exit current behavior
    if (this.currentBehavior) {
      this.currentBehavior.onExit?.()
    }

    // Enter new behavior
    this.currentBehavior = behavior
    this.currentBehavior.onEnter?.()
    this.mob.aiState.mode = name
  }

  /**
   * Update AI (called from mob's aiUpdate event)
   * @param {number} delta - Time since last frame
   */
  onUpdate(delta) {
    if (!this.enabled) return
    if (!this.world.network.isServer) return

    // Rate limiting
    this.lastUpdate += delta
    if (this.lastUpdate < this.options.updateRate) return
    this.lastUpdate = 0

    // Update sensors
    for (const sensor of this.sensors.values()) {
      sensor.update?.(delta)
    }

    // Update current behavior
    if (this.currentBehavior) {
      this.currentBehavior.update?.(delta)
    }
  }

  /**
   * Enable AI
   */
  enable() {
    this.enabled = true
  }

  /**
   * Disable AI
   */
  disable() {
    this.enabled = false
  }

  /**
   * Destroy controller
   */
  destroy() {
    this.enabled = false
    this.currentBehavior?.onExit?.()
    this.behaviors.clear()
    this.sensors.clear()
  }
}
