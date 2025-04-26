import * as THREE from '../extras/three'
import { Node } from './Node'

export class Snap extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'snap'
    this.worldPosition = new THREE.Vector3()
  }

  mount() {
    this.worldPosition.setFromMatrixPosition(this.matrixWorld)
    this.handle = this.ctx.world.snaps?.create(this.worldPosition, !this.ctx.moving)
  }

  commit(didMove) {
    if (didMove) {
      this.worldPosition.setFromMatrixPosition(this.matrixWorld)
      this.handle?.move()
    }
  }

  unmount() {
    this.handle?.destroy()
    this.handle = null
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
