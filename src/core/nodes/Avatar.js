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
      this.instance = this.factory(this.matrixWorld, this.hooks, this)
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

  // setMode(mode) {
  //   // TODO: toggle physics off when moving
  //   //
  //   // if (mode === 'moving') {
  //   //   this.layer = Layers.MOVING
  //   // } else {
  //   //   this.layer = Layers.DEFAULT
  //   // }
  // }

  // getStats() {
  //   let triangles = 0
  //   if (this.src) {
  //     const geometry = this.src.lods[0].mesh.geometry
  //     if (geometry.index !== null) {
  //       triangles += geometry.index.count / 3
  //     } else {
  //       triangles += geometry.attributes.position.count / 3
  //     }
  //   }
  //   return {
  //     triangles,
  //   }
  // }

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
