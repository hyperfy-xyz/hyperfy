/**
 * Patrol Behavior
 *
 * - Mob moves between waypoints in a patrol pattern
 * - Can loop or stop at the end
 *
 */
export class Patrol {
  constructor(waypoints = [], options = {}) {
    this.waypoints = waypoints
    this.options = {
      speed: 2,
      loop: true,
      waypointRadius: 0.5, // Distance to consider waypoint reached
      ...options,
    }
    this.waypointIndex = 0
  }

  onEnter() {
    if (!this.controller) return
    this.waypointIndex = 0
  }

  update(delta) {
    if (!this.controller) return
    if (this.waypoints.length === 0) return

    const mob = this.controller.mob

    // Get current waypoint
    const currentWaypoint = this.waypoints[this.waypointIndex]

    // Move to waypoint using degen API
    mob.degen.moveTo(currentWaypoint, this.options.speed)

    // Check if reached waypoint
    const currentPos = mob.root.position
    const waypointPos = Array.isArray(currentWaypoint)
      ? { x: currentWaypoint[0], y: currentWaypoint[1], z: currentWaypoint[2] }
      : currentWaypoint

    const distance = Math.sqrt(
      Math.pow(currentPos.x - waypointPos.x, 2) +
        Math.pow(currentPos.y - waypointPos.y, 2) +
        Math.pow(currentPos.z - waypointPos.z, 2)
    )

    if (distance < this.options.waypointRadius) {
      this.waypointIndex++

      // Handle end of waypoints
      if (this.waypointIndex >= this.waypoints.length) {
        if (this.options.loop) {
          this.waypointIndex = 0
        } else {
          // Switch to idle
          this.controller.setBehavior('idle')
        }
      }
    }
  }

  onExit() {
    // Cleanup if needed
  }

  /**
   * Set new waypoints
   */
  setWaypoints(waypoints) {
    this.waypoints = waypoints
    this.waypointIndex = 0
  }
}
