import { System } from './System'

/**
 * Environment System
 *
 * - Runs on the server
 * - Currently not in use
 *
 */
export class ServerEnvironment extends System {
  constructor(world) {
    super(world)
    this.model = null
  }
}
