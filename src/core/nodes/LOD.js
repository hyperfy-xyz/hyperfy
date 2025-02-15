import * as THREE from '../extras/three'

import { getRef, Node } from './Node'

const v0 = new THREE.Vector3()
const v1 = new THREE.Vector3()

export class LOD extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'lod'

    this.lods = [] // [...{ node, maxDistance }]
  }

  insert(node, maxDistance) {
    this.lods.push({ node, maxDistance })
    this.lods.sort((a, b) => a.maxDistance - b.maxDistance) // ascending
    node.active = false
    this.add(node)
  }

  mount() {
    this.ctx.world.lods?.register(this)
    this.check()
  }

  check() {
    if (this.prevLod) {
      this.prevLod.node.active = false
      this.prevLod = null
    }
    const cameraPos = v0.setFromMatrixPosition(this.ctx.world.camera.matrixWorld)
    const itemPos = v1.setFromMatrixPosition(this.matrixWorld)
    const distance = cameraPos.distanceTo(itemPos)
    const lod = this.lods.find(lod => distance <= lod.maxDistance)
    // if this lod hasnt change, stop here
    if (this.lod === lod) return
    // if we have a new lod, lets activate it immediately
    if (lod) {
      lod.node.active = true
    }
    // if we have a pre-existing active lod, queue to remove it next frame
    if (this.lod) {
      this.prevLod = this.lod
    }
    // track the new lod (if any)
    this.lod = lod
  }

  unmount() {
    this.ctx.world.lods?.unregister(this)
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this.lods = source.lods.map(lod => {
      const node = this.children.find(node => node.id === lod.node.id)
      const maxDistance = lod.maxDistance
      return {
        node,
        maxDistance,
      }
    })
    return this
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        insert(pNode, maxDistance) {
          const node = getRef(pNode)
          self.insert(node, maxDistance)
          return this
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}
