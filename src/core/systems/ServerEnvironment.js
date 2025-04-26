import { System } from './System'

/**
 * Environment System
 *
 * - Runs on the server
 * - Sets up the environment model
 *
 */
export class ServerEnvironment extends System {
  constructor(world) {
    super(world)
    this.model = null
  }

  async start() {
    this.world.settings.on('change', this.onSettingsChange)
  }

  async updateModel() {
    const url = this.world.settings.model?.url
    if (!url) return
    let glb = this.world.loader.get('model', url)
    if (!glb) glb = await this.world.loader.load('model', url)
    if (this.model) this.model.deactivate()
    this.model = glb.toNodes()
    this.model.activate({ world: this.world, label: 'base' })
  }

  onSettingsChange = changes => {
    if (changes.model) {
      this.updateModel()
    }
  }
}
