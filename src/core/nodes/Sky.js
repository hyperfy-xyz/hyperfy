import { isNumber, isString } from 'lodash-es'
import { Node } from './Node'
import * as THREE from '../extras/three'

// NOTE: actual defaults bubble up to ClientEnvironment.js
const defaults = {
  bg: null,
  hdr: null,
  sunDirection: null,
  sunIntensity: null,
  sunColor: null,
}

export class Sky extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'sky'

    this.bg = data.bg
    this.hdr = data.hdr
    this.sunDirection = data.sunDirection
    this.sunIntensity = data.sunIntensity
    this.sunColor = data.sunColor
  }

  mount() {
    this.handle = this.ctx.world.environment?.addSky(this)
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.handle?.destroy()
      this.handle = this.ctx.world.environment?.addSky(this)
      this.needsRebuild = false
    }
  }

  unmount() {
    this.handle?.destroy()
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._bg = source._bg
    this._hdr = source._hdr
    this._sunDirection = source._sunDirection
    this._sunIntensity = source._sunIntensity
    this._sunColor = source._sunColor
    return this
  }

  get bg() {
    return this._bg
  }

  set bg(value = defaults.bg) {
    if (value !== null && !isString(value)) {
      throw new Error('[sky] bg not a string')
    }
    if (this._bg === value) return
    this._bg = value
    this.needsRebuild = true
    this.setDirty()
  }

  get hdr() {
    return this._hdr
  }

  set hdr(value = defaults.hdr) {
    if (value !== null && !isString(value)) {
      throw new Error('[sky] hdr not a string')
    }
    if (this._hdr === value) return
    this._hdr = value
    this.needsRebuild = true
    this.setDirty()
  }

  get sunDirection() {
    return this._sunDirection
  }

  set sunDirection(value = defaults.sunDirection) {
    if (value !== null && !value?.isVector3) {
      throw new Error('[sky] sunDirection not a Vector3')
    }
    if (this._sunDirection === value) return
    this._sunDirection = value
    this.needsRebuild = true
    this.setDirty()
  }

  get sunIntensity() {
    return this._sunIntensity
  }

  set sunIntensity(value = defaults.sunIntensity) {
    if (value !== null && !isNumber(value)) {
      throw new Error('[sky] sunIntensity not a number')
    }
    if (this._sunIntensity === value) return
    this._sunIntensity = value
    this.needsRebuild = true
    this.setDirty()
  }

  get sunColor() {
    return this._sunColor
  }

  set sunColor(value = defaults.sunColor) {
    if (value !== null && !isString(value)) {
      throw new Error('[sky] sunColor not a string')
    }
    if (this._sunColor === value) return
    this._sunColor = value
    this.needsRebuild = true
    this.setDirty()
  }

  getProxy() {
    var self = this
    if (!this.proxy) {
      let proxy = {
        get bg() {
          return self.bg
        },
        set bg(value) {
          self.bg = value
        },
        get hdr() {
          return self.hdr
        },
        set hdr(value) {
          self.hdr = value
        },
        get sunDirection() {
          return self.sunDirection
        },
        set sunDirection(value) {
          self.sunDirection = value
        },
        get sunIntensity() {
          return self.sunIntensity
        },
        set sunIntensity(value) {
          self.sunIntensity = value
        },
        get sunColor() {
          return self.sunColor
        },
        set sunColor(value) {
          self.sunColor = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}
