import { Node } from './Node'

export class StaticMesh extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'staticmesh'

    this.mesh = data.mesh
  }

  mount() {
    if (this.ctx.world.network.isClient) {
      this.ctx.world.stage.scene.add(this.mesh)
    }
  }

  unmount() {
    if (this.ctx.world.network.isClient) {
      this.ctx.world.stage.scene.remove(this.mesh)
    }
  }
}
