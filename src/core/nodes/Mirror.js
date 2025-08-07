import { isBoolean, isNumber, isString } from 'lodash-es'
import { Node } from './Node'
import * as THREE from '../extras/three'
import { Reflector } from '../extras/Reflector.js'

const defaults = {
  width: 2,
  height: 2,
  tint: '#ffffff', // white
  textureWidth: 512,
  textureHeight: 512,
  clipBias: 0,
}

export class Mirror extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'mirror'

    this.width = data.width
    this.height = data.height
    this.tint = data.tint
    this.textureWidth = data.textureWidth
    this.textureHeight = data.textureHeight
    this.clipBias = data.clipBias

    this.n = 0
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._width = source._width
    this._height = source._height
    this._tint = source._tint
    this._textureWidth = source._textureWidth
    this._textureHeight = source._textureHeight
    this._clipBias = source._clipBias
    return this
  }

  async mount() {
    this.build()
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.build()
      return
    }
    if (didMove) {
      if (this.mesh) {
        this.mesh.matrixWorld.copy(this.matrixWorld)
      }
    }
  }

  unmount() {
    this.unbuild()
  }

  async build() {
    this.needsRebuild = false
    if (this.ctx.world.network.isServer) return

    this.unbuild()

    const geometry = new THREE.PlaneGeometry(this._width, this._height)

    const options = {
      color: this._tint,  // Reflector expects 'color' parameter
      textureWidth: this._textureWidth,
      textureHeight: this._textureHeight,
      clipBias: this._clipBias,
      multisample: 4,  // Fixed value
      recursion: 0,    // Fixed value
    }

    this.mesh = new Reflector(geometry, options)

    // Handle first person mode - show avatar in mirror even when invisible
    const world = this.ctx.world
    this.mesh.onBeforeRender2 = (renderer, scene, camera) => {
      const localPlayer = world.entities?.player
      if (localPlayer && localPlayer.isLocal && localPlayer.firstPerson && localPlayer.avatar) {
        localPlayer.avatar.visible = true
      }
    }

    this.mesh.onAfterRender2 = (renderer, scene, camera) => {
      const localPlayer = world.entities?.player
      if (localPlayer && localPlayer.isLocal && localPlayer.firstPerson && localPlayer.avatar) {
        localPlayer.avatar.visible = false
      }
    }

    this.mesh.castShadow = false
    this.mesh.receiveShadow = false
    this.mesh.matrixWorld.copy(this.matrixWorld)
    this.mesh.matrixAutoUpdate = false
    this.mesh.matrixWorldAutoUpdate = false

    this.ctx.world.stage.scene.add(this.mesh)

    this.sItem = {
      matrix: this.matrixWorld,
      geometry,
      material: this.mesh.material,
      getEntity: () => this.ctx.entity,
      node: this,
    }
    this.ctx.world.stage.octree.insert(this.sItem)
  }

  unbuild() {
    this.n++
    if (this.mesh) {
      this.ctx.world.stage.scene.remove(this.mesh)
      this.mesh.dispose()
      this.mesh = null
    }
    if (this.sItem) {
      this.ctx.world.stage.octree.remove(this.sItem)
      this.sItem = null
    }
  }

  get width() {
    return this._width
  }

  set width(value = defaults.width) {
    if (!isNumber(value)) {
      throw new Error('[mirror] width not a number')
    }
    if (this._width === value) return
    this._width = value
    this.needsRebuild = true
    this.setDirty()
  }

  get height() {
    return this._height
  }

  set height(value = defaults.height) {
    if (!isNumber(value)) {
      throw new Error('[mirror] height not a number')
    }
    if (this._height === value) return
    this._height = value
    this.needsRebuild = true
    this.setDirty()
  }

  get tint() {
    return this._tint
  }

  set tint(value = defaults.tint) {
    if (!isString(value)) {
      throw new Error('[mirror] tint not a string')
    }
    if (this._tint === value) return
    this._tint = value
    this.needsRebuild = true
    this.setDirty()
  }


  get textureWidth() {
    return this._textureWidth
  }

  set textureWidth(value = defaults.textureWidth) {
    if (!isNumber(value)) {
      throw new Error('[mirror] textureWidth not a number')
    }
    if (this._textureWidth === value) return
    this._textureWidth = value
    this.needsRebuild = true
    this.setDirty()
  }

  get textureHeight() {
    return this._textureHeight
  }

  set textureHeight(value = defaults.textureHeight) {
    if (!isNumber(value)) {
      throw new Error('[mirror] textureHeight not a number')
    }
    if (this._textureHeight === value) return
    this._textureHeight = value
    this.needsRebuild = true
    this.setDirty()
  }

  get clipBias() {
    return this._clipBias
  }

  set clipBias(value = defaults.clipBias) {
    if (!isNumber(value)) {
      throw new Error('[mirror] clipBias not a number')
    }
    if (this._clipBias === value) return
    this._clipBias = value
    this.needsRebuild = true
    this.setDirty()
  }


  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get width() {
          return self.width
        },
        set width(value) {
          self.width = value
        },
        get height() {
          return self.height
        },
        set height(value) {
          self.height = value
        },
        get tint() {
          return self.tint
        },
        set tint(value) {
          self.tint = value
        },
        get textureWidth() {
          return self.textureWidth
        },
        set textureWidth(value) {
          self.textureWidth = value
        },
        get textureHeight() {
          return self.textureHeight
        },
        set textureHeight(value) {
          self.textureHeight = value
        },
        get clipBias() {
          return self.clipBias
        },
        set clipBias(value) {
          self.clipBias = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}
