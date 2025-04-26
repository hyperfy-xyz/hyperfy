import { Node } from './Node'

export class Anchor extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'anchor'
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    return this
  }

  mount() {
    this.anchorId = `${this.ctx?.entity?.data.id || ''}:${this.id}`
    this.ctx.world.anchors.add(this.anchorId, this.matrixWorld)
  }

  unmount() {
    this.ctx.world.anchors.remove(this.anchorId)
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get anchorId() {
          return self.anchorId
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}
