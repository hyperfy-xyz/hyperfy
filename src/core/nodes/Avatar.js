import { Node } from './Node'
import * as THREE from 'three'

export class Avatar extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'avatar'
    this.factory = data.factory
    this.hooks = data.hooks
    this.instance = null
  }

  mount() {
    if (this.factory) {
      this.instance = this.factory.create(this.matrixWorld, this.hooks, this)
      this.ctx.world?.setHot(this.instance, true)
    }
  }

  commit(didMove) {
    if (didMove) {
      this.instance?.move(this.matrixWorld)
    }
  }

  unmount() {
    if (this.instance) {
      this.ctx.world?.setHot(this.instance, false)
      this.instance.destroy()
      this.instance = null
    }
  }

  applyStats(stats) {
    this.factory?.applyStats(stats)
  }

  get height() {
    return this.instance?.height || null
  }

  setEmote(url) {
    return this.instance?.setEmote(url)
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this.factory = source.factory
    this.hooks = source.hooks
    return this
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get height() {
          return self.height
        },
        setEmote(url) {
          return self.setEmote(url)
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}
