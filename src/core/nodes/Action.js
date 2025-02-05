import * as THREE from '../extras/three'
import { isFunction, isNumber, isString } from 'lodash-es'

import { Node } from './Node'

const defaults = {
  label: 'Interact',
  distance: 3,
  duration: 0.5,
  onStart: () => {},
  onTrigger: () => {},
  onCancel: () => {},
}

export class Action extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'action'

    this.label = data.label
    this.distance = data.distance
    this.duration = data.duration
    this.onStart = data.onStart
    this.onTrigger = data.onTrigger
    this.onCancel = data.onCancel

    this.worldPos = new THREE.Vector3()
    this.progress = 0
  }

  mount() {
    this.ctx.world.actions?.register(this)
    this.worldPos.setFromMatrixPosition(this.matrixWorld)
  }

  commit(didMove) {
    if (didMove) {
      this.worldPos.setFromMatrixPosition(this.matrixWorld)
    }
  }

  unmount() {
    this.ctx.world.actions?.unregister(this)
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._label = source._label
    this._distance = source._distance
    this._duration = source._duration
    this._onStart = source._onStart
    this._onTrigger = source._onTrigger
    this._onCancel = source._onCancel
    return this
  }

  get label() {
    return this._label
  }

  set label(value) {
    this._label = isString(value) ? value : isNumber(value) ? value + '' : defaults.label
  }

  get distance() {
    return this._distance
  }

  set distance(value = defaults.distance) {
    if (!isNumber(value)) {
      throw new Error('[action] distance not a number')
    }
    this._distance = value
  }

  get duration() {
    return this._duration
  }

  set duration(value = defaults.duration) {
    if (!isNumber(value)) {
      throw new Error('[action] duration not a number')
    }
    this._duration = value
  }

  get onStart() {
    return this._onStart
  }

  set onStart(value = defaults.onStart) {
    if (!isFunction(value)) {
      throw new Error('[action] onStart not a function')
    }
    this._onStart = value
  }

  get onTrigger() {
    return this._onTrigger
  }

  set onTrigger(value = defaults.onTrigger) {
    if (!isFunction(value)) {
      throw new Error('[action] onTrigger not a function')
    }
    this._onTrigger = value
  }

  get onCancel() {
    return this._onCancel
  }

  set onCancel(value = defaults.onCancel) {
    if (!isFunction(value)) {
      throw new Error('[action] onCancel not a function')
    }
    this._onCancel = value
  }

  getProxy() {
    var self = this
    if (!this.proxy) {
      let proxy = {
        get label() {
          return self.label
        },
        set label(value) {
          self.label = value
        },
        get distance() {
          return self.distance
        },
        set distance(value) {
          self.distance = value
        },
        get duration() {
          return self.duration
        },
        set duration(value) {
          self.duration = value
        },
        get onStart() {
          return self.onStart
        },
        set onStart(value) {
          self.onStart = value
        },
        get onTrigger() {
          return self.onTrigger
        },
        set onTrigger(value) {
          self.onTrigger = value
        },
        get onCancel() {
          return self.onCancel
        },
        set onCancel(value) {
          self.onCancel = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}
