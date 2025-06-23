import { Node } from './Node'

export class Group extends Node {
  constructor(data: any = {}) {
    super(data)
    this.name = 'group'
  }

  override copy(source: any, recursive?: boolean): this {
    super.copy(source, recursive)
    return this
  }

  override getProxy(): any {
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
