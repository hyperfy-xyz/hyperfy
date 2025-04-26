import { Node } from './Node'

export class Group extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'group'
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    return this
  }

  getProxy() {
    if (!this.proxy) {
      let proxy = {
        // ...
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}
