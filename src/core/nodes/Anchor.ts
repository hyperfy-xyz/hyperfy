import { Node } from './Node'

export class Anchor extends Node {
  anchorId?: string;
  
  constructor(data = {}) {
    super(data)
    this.name = 'anchor'
  }

  override copy(source: any, recursive: boolean) {
    super.copy(source, recursive)
    return this
  }

  override mount() {
    this.anchorId = `${this.ctx?.entity?.data.id || ''}:${this.id}`
    this.ctx.world.anchors.add(this.anchorId, this.matrixWorld)
  }

  override unmount() {
    this.ctx.world.anchors.remove(this.anchorId)
  }

  override getProxy() {
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
