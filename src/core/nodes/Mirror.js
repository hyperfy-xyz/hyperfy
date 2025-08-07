import { isBoolean, isNumber, isString } from 'lodash-es'
import { Node } from './Node'
import * as THREE from '../extras/three'
import { Reflector } from '../extras/Reflector.js'

const pivots = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

const defaults = {
  width: 2,
  height: 2,
  color: '#ffffff', // white
  pivot: 'center',
  castShadow: false,
  receiveShadow: false,
  textureWidth: 512,
  textureHeight: 512,
  clipBias: 0,
  multisample: 4,
  recursion: 0,
}

export class Mirror extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'mirror'

    this.width = data.width
    this.height = data.height
    this.color = data.color
    this.pivot = data.pivot
    this.castShadow = data.castShadow
    this.receiveShadow = data.receiveShadow
    this.textureWidth = data.textureWidth
    this.textureHeight = data.textureHeight
    this.clipBias = data.clipBias
    this.multisample = data.multisample
    this.recursion = data.recursion

    this.n = 0
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._width = source._width
    this._height = source._height
    this._color = source._color
    this._pivot = source._pivot
    this._castShadow = source._castShadow
    this._receiveShadow = source._receiveShadow
    this._textureWidth = source._textureWidth
    this._textureHeight = source._textureHeight
    this._clipBias = source._clipBias
    this._multisample = source._multisample
    this._recursion = source._recursion
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
    applyPivot(geometry, this._width, this._height, this._pivot)

    const options = {
      color: this._color,
      textureWidth: this._textureWidth,
      textureHeight: this._textureHeight,
      clipBias: this._clipBias,
      multisample: this._multisample,
      recursion: this._recursion,
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

    this.mesh.castShadow = this._castShadow
    this.mesh.receiveShadow = this._receiveShadow
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

  get color() {
    return this._color
  }

  set color(value = defaults.color) {
    if (!isString(value)) {
      throw new Error('[mirror] color not a string')
    }
    if (this._color === value) return
    this._color = value
    this.needsRebuild = true
    this.setDirty()
  }

  get pivot() {
    return this._pivot
  }

  set pivot(value = defaults.pivot) {
    if (!isPivot(value)) {
      throw new Error('[mirror] pivot invalid')
    }
    if (this._pivot === value) return
    this._pivot = value
    this.needsRebuild = true
    this.setDirty()
  }

  get castShadow() {
    return this._castShadow
  }

  set castShadow(value = defaults.castShadow) {
    if (!isBoolean(value)) {
      throw new Error('[mirror] castShadow not a boolean')
    }
    if (this._castShadow === value) return
    this._castShadow = value
    this.needsRebuild = true
    this.setDirty()
  }

  get receiveShadow() {
    return this._receiveShadow
  }

  set receiveShadow(value = defaults.receiveShadow) {
    if (!isBoolean(value)) {
      throw new Error('[mirror] receiveShadow not a boolean')
    }
    if (this._receiveShadow === value) return
    this._receiveShadow = value
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

  get multisample() {
    return this._multisample
  }

  set multisample(value = defaults.multisample) {
    if (!isNumber(value)) {
      throw new Error('[mirror] multisample not a number')
    }
    if (this._multisample === value) return
    this._multisample = value
    this.needsRebuild = true
    this.setDirty()
  }

  get recursion() {
    return this._recursion
  }

  set recursion(value = defaults.recursion) {
    if (!isNumber(value)) {
      throw new Error('[mirror] recursion not a number')
    }
    if (this._recursion === value) return
    this._recursion = value
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
        get color() {
          return self.color
        },
        set color(value) {
          self.color = value
        },
        get pivot() {
          return self.pivot
        },
        set pivot(value) {
          self.pivot = value
        },
        get castShadow() {
          return self.castShadow
        },
        set castShadow(value) {
          self.castShadow = value
        },
        get receiveShadow() {
          return self.receiveShadow
        },
        set receiveShadow(value) {
          self.receiveShadow = value
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
        get multisample() {
          return self.multisample
        },
        set multisample(value) {
          self.multisample = value
        },
        get recursion() {
          return self.recursion
        },
        set recursion(value) {
          self.recursion = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

function isPivot(value) {
  return pivots.includes(value)
}

function applyPivot(geometry, width, height, pivot) {
  if (pivot === 'center') return
  let offsetX = 0
  let offsetY = 0
  if (pivot.includes('left')) {
    offsetX = width / 2
  } else if (pivot.includes('right')) {
    offsetX = -width / 2
  }
  if (pivot.includes('top')) {
    offsetY = -height / 2
  } else if (pivot.includes('bottom')) {
    offsetY = height / 2
  }
  if (offsetX !== 0 || offsetY !== 0) {
    geometry.translate(offsetX, offsetY, 0)
  }
}
