import { System } from './System'

/**
 * Environment System
 *
 * - Runs on the server
 * - Sets up the environment model
 *
 */
export class ServerEnvironment extends System {
  private model: any
  
  constructor(world: any) {
    super(world)
    this.model = null
  }

  async start() {
    const settings = this.world.settings as any
    if (settings.on) {
      settings.on('change', this.onSettingsChange)
    }
    // Load initial environment model
    await this.updateModel()
  }

  async updateModel() {
    const settings = this.world.settings as any
    const url = settings.model?.url
    if (!url) return
    const world = this.world as any
    let glb = world.loader.get('model', url)
    if (!glb) glb = await world.loader.load('model', url)
    if (this.model) this.model.deactivate()
    this.model = glb.toNodes()
    this.model.activate({ world: this.world, label: 'base' })
  }

  onSettingsChange = (changes: any) => {
    if (changes.model) {
      this.updateModel()
    }
  }
}
