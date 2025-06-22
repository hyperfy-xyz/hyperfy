import { isBoolean } from 'lodash-es'
import * as THREE from 'three'

import { getRef, Node } from './Node'

const v0 = new THREE.Vector3()
const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()

const defaults = {
  scaleAware: true,
}

interface LODItem {
  node: any;
  maxDistance: number;
}

export class LOD extends Node {
  lods: LODItem[]
  prevLod: LODItem | null
  _scaleAware: boolean
  lod: LODItem | undefined
  
  constructor(data: any = {}) {
    super(data)
    this.name = 'lod'

    this.scaleAware = data.scaleAware

    this.lods = [] // [...{ node, maxDistance }]
    this.prevLod = null
    this._scaleAware = defaults.scaleAware
  }

  insert(node: any, maxDistance: number) {
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
    let distance = cameraPos.distanceTo(itemPos)
    if (this._scaleAware) {
      v2.setFromMatrixScale(this.matrixWorld)
      const avgScale = (v2.x + v2.y + v2.z) / 3
      distance = distance / avgScale
    }
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

  copy(source: any, recursive: boolean) {
    super.copy(source, recursive)
    this._scaleAware = source._scaleAware
    this.lods = source.lods.map((lod: LODItem) => {
      const node = this.children.find(node => node.id === lod.node.id)
      if (node) {
        node.active = false
      }
      const maxDistance = lod.maxDistance
      return {
        node,
        maxDistance,
      }
    })
    return this
  }

  get scaleAware() {
    return this._scaleAware
  }

  set scaleAware(value) {
    if (value === undefined) value = defaults.scaleAware
    if (!isBoolean(value)) {
      throw new Error('[lod] scaleAware not a boolean')
    }
    if (this._scaleAware === value) return
    this._scaleAware = value
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get scaleAware() {
          return self.scaleAware
        },
        set scaleAware(value) {
          self.scaleAware = value
        },
        insert(pNode: any, maxDistance: number) {
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
