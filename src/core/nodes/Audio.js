import * as THREE from '../extras/three'
import { every, isBoolean, isNumber, isString } from 'lodash-es'

import { Node } from './Node'

const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()
const q1 = new THREE.Quaternion()

const groups = ['music', 'sfx']
const distanceModels = ['linear', 'inverse', 'exponential']

const defaults = {
  src: null,
  volume: 1,
  loop: false,
  group: 'music',
  // see: https://medium.com/@kfarr/understanding-web-audio-api-positional-audio-distance-models-for-webxr-e77998afcdff
  spatial: true,
  distanceModel: 'inverse',
  refDistance: 1,
  maxDistance: 40,
  rolloffFactor: 3,
  coneInnerAngle: 360,
  coneOuterAngle: 360,
  coneOuterGain: 0,
}

export class Audio extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'audio'

    this.src = data.src
    this.volume = data.volume
    this.loop = data.loop
    this.group = data.group
    this.spatial = data.spatial
    this.distanceModel = data.distanceModel
    this.refDistance = data.refDistance
    this.maxDistance = data.maxDistance
    this.rolloffFactor = data.rolloffFactor
    this.coneInnerAngle = data.coneInnerAngle
    this.coneOuterAngle = data.coneOuterAngle
    this.coneOuterGain = data.coneOuterGain

    this.n = 0
    this.source = null
    this.gainNode = null
    this.pannerNode = null

    this.offset = 0
    this.shouldPlay = false
    this.startTime = null
  }

  async mount() {
    // ...
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.needsRebuild = false
      if (this.source) {
        this.pause()
        this.play()
      }
      return
    }
    if (didMove) {
      this.updatePannerPosition()
    }
  }

  unmount() {
    this.stop()
  }

  updatePannerPosition() {
    if (!this.pannerNode) return
    const audio = this.ctx.world.audio
    const pos = v1.setFromMatrixPosition(this.matrixWorld)
    const qua = q1.setFromRotationMatrix(this.matrixWorld)
    const dir = v2.set(0, 0, -1).applyQuaternion(qua)
    if (this.pannerNode.positionX) {
      const endTime = audio.ctx.currentTime + audio.lastDelta
      this.pannerNode.positionX.linearRampToValueAtTime(pos.x, endTime)
      this.pannerNode.positionY.linearRampToValueAtTime(pos.y, endTime)
      this.pannerNode.positionZ.linearRampToValueAtTime(pos.z, endTime)
      this.pannerNode.orientationX.linearRampToValueAtTime(dir.x, endTime)
      this.pannerNode.orientationY.linearRampToValueAtTime(dir.y, endTime)
      this.pannerNode.orientationZ.linearRampToValueAtTime(dir.z, endTime)
    } else {
      this.pannerNode.setPosition(pos.x, pos.y, pos.z)
      this.pannerNode.setOrientation(dir.x, dir.y, dir.z)
    }
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._src = source._src
    this._volume = source._volume
    this._loop = source._loop
    this._group = source._group
    this._spatial = source._spatial
    this._distanceModel = source._distanceModel
    this._refDistance = source._refDistance
    this._maxDistance = source._maxDistance
    this._rolloffFactor = source._rolloffFactor
    this._coneInnerAngle = source._coneInnerAngle
    this._coneOuterAngle = source._coneOuterAngle
    this._coneOuterGain = source._coneOuterGain
    return this
  }

  get src() {
    return this._src
  }

  set src(value = defaults.src) {
    if (!isString(value) && value !== null) {
      throw new Error('[audio] src not a string')
    }
    this._src = value || null
    this.needsRebuild = true
    this.setDirty()
  }

  get volume() {
    return this._volume
  }

  set volume(value = defaults.volume) {
    if (!isNumber(value)) {
      throw new Error('[audio] volume not a number')
    }
    this._volume = value
    if (this.gainNode) {
      this.gainNode.gain.value = this._volume
    }
  }

  get loop() {
    return this._loop
  }

  set loop(value = defaults.loop) {
    if (!isBoolean(value)) {
      throw new Error('[audio] loop not a boolean')
    }
    this._loop = value
    this.needsRebuild = true
    this.setDirty()
  }

  get group() {
    return this._group
  }

  set group(value = defaults.group) {
    if (!isGroup(value)) {
      throw new Error('[audio] group not valid')
    }
    this._group = value
    this.needsRebuild = true
    this.setDirty()
  }

  get spatial() {
    return this._spatial
  }

  set spatial(value = defaults.spatial) {
    if (!isBoolean(value)) {
      throw new Error('[audio] spatial not a boolean')
    }
    this._spatial = value
    this.needsRebuild = true
    this.setDirty()
  }

  get distanceModel() {
    return this._distanceModel
  }

  set distanceModel(value = defaults.distanceModel) {
    if (!isDistanceModel(value)) {
      throw new Error('[audio] distanceModel not valid')
    }
    this._distanceModel = value
    if (this.pannerNode) {
      this.pannerNode.distanceModel = this._distanceModel
    }
  }

  get refDistance() {
    return this._refDistance
  }

  set refDistance(value = defaults.refDistance) {
    if (!isNumber(value)) {
      throw new Error('[audio] refDistance not a number')
    }
    this._refDistance = value
    if (this.pannerNode) {
      this.pannerNode.refDistance = this._refDistance
    }
  }

  get maxDistance() {
    return this._maxDistance
  }

  set maxDistance(value = defaults.maxDistance) {
    if (!isNumber(value)) {
      throw new Error('[audio] maxDistance not a number')
    }
    this._maxDistance = value
    if (this.pannerNode) {
      this.pannerNode.maxDistance = this._maxDistance
    }
  }

  get rolloffFactor() {
    return this._rolloffFactor
  }

  set rolloffFactor(value = defaults.rolloffFactor) {
    if (!isNumber(value)) {
      throw new Error('[audio] rolloffFactor not a number')
    }
    this._rolloffFactor = value
    if (this.pannerNode) {
      this.pannerNode.rolloffFactor = this._rolloffFactor
    }
  }

  get coneInnerAngle() {
    return this._coneInnerAngle
  }

  set coneInnerAngle(value = defaults.coneInnerAngle) {
    if (!isNumber(value)) {
      throw new Error('[audio] coneInnerAngle not a number')
    }
    this._coneInnerAngle = value
    if (this.pannerNode) {
      this.pannerNode.coneInnerAngle = this._coneInnerAngle
    }
  }

  get coneOuterAngle() {
    return this._coneOuterAngle
  }

  set coneOuterAngle(value = defaults.coneOuterAngle) {
    if (!isNumber(value)) {
      throw new Error('[audio] coneOuterAngle not a number')
    }
    this._coneOuterAngle = value
    if (this.pannerNode) {
      this.pannerNode.coneOuterAngle = this._coneOuterAngle
    }
  }

  get coneOuterGain() {
    return this._coneOuterGain
  }

  set coneOuterGain(value = defaults.coneOuterGain) {
    if (!isNumber(value)) {
      throw new Error('[audio] coneOuterGain not a number')
    }
    this._coneOuterGain = value
    if (this.pannerNode) {
      this.pannerNode.coneOuterGain = this._coneOuterGain
    }
  }

  get currentTime() {
    const audio = this.ctx.world.audio
    if (!audio) {
      return 0
    }
    if (this.source) {
      return audio.ctx.currentTime - this.startTime
    }
    return this.offset
  }

  set currentTime(time) {
    if (!isNumber(time)) {
      throw new Error('[audio] currentTime not a number')
    }
    const offset = Math.max(0, time)
    if (this.source) {
      this.stop()
      this.offset = offset
      this.play()
    } else {
      this.offset = offset
    }
  }

  get isPlaying() {
    return !!this.source
  }

  async play(restartIfPlaying = false) {
    if (!this.ctx.world) return // not mounted
    const loader = this.ctx.world.loader
    const audio = this.ctx.world.audio
    if (!audio) return
    if (!this._src) return
    if (restartIfPlaying) this.stop()
    if (this.source) return
    const n = ++this.n
    let buffer
    try {
      buffer = loader.get('audio', this._src)
      if (!buffer) buffer = await loader.load('audio', this._src)
    } catch (err) {
      console.error(err)
      return
    }
    if (n !== this.n) return

    this.source = audio.ctx.createBufferSource()
    this.source.buffer = buffer
    this.source.loop = this._loop

    this.gainNode = audio.ctx.createGain()
    this.gainNode.gain.value = this._volume

    if (this._spatial) {
      this.pannerNode = audio.ctx.createPanner()
      this.pannerNode.panningModel = 'HRTF'
      this.pannerNode.distanceModel = this._distanceModel
      this.pannerNode.refDistance = this._refDistance
      this.pannerNode.maxDistance = this._maxDistance
      this.pannerNode.rolloffFactor = this._rolloffFactor
      this.pannerNode.coneInnerAngle = this._coneInnerAngle
      this.pannerNode.coneOuterAngle = this._coneOuterAngle
      this.pannerNode.coneOuterGain = this._coneOuterGain
      this.source.connect(this.gainNode)
      this.gainNode.connect(this.pannerNode)
      this.pannerNode.connect(audio.groupGains[this._group])
      this.updatePannerPosition()
    } else {
      this.source.connect(this.gainNode)
      this.gainNode.connect(audio.groupGains[this._group])
    }

    audio.ready(() => {
      if (n !== this.n) return
      this.startTime = audio.ctx.currentTime - this.offset
      this.source.start(0, this.offset)
      if (!this._loop) {
        this.source.onended = () => this.stop()
      }
    })
  }

  pause() {
    const audio = this.ctx.world.audio
    if (!audio) return
    if (this.source) {
      this.n++
      this.offset = audio.ctx.currentTime - this.startTime
      this.source.onended = null
      this.source.stop()
      this.source = null
      this.gainNode?.disconnect()
      this.gainNode = null
      this.pannerNode?.disconnect()
      this.pannerNode = null
    }
  }

  stop() {
    const audio = this.ctx.world.audio
    if (!audio) return
    this.n++
    this.offset = 0
    if (this.source) {
      this.source.onended = null
      this.source?.stop()
      this.source = null
      this.gainNode?.disconnect()
      this.gainNode = null
      this.pannerNode?.disconnect()
      this.pannerNode = null
    }
  }

  setPlaybackRate(rate) {
    const audio = this.ctx.world.audio
    const endTime = audio.ctx.currentTime + audio.lastDelta
    this.source?.playbackRate.linearRampToValueAtTime(rate, endTime)
  }

  getProxy() {
    var self = this
    if (!this.proxy) {
      let proxy = {
        get src() {
          return self.src
        },
        set src(value) {
          self.src = value
        },
        get volume() {
          return self.volume
        },
        set volume(value) {
          self.volume = value
        },
        get loop() {
          return self.loop
        },
        set loop(value) {
          self.loop = value
        },
        get group() {
          return self.group
        },
        set group(value) {
          self.group = value
        },
        get spatial() {
          return self.spatial
        },
        set spatial(value) {
          self.spatial = value
        },
        get distanceModel() {
          return self.distanceModel
        },
        set distanceModel(value) {
          self.distanceModel = value
        },
        get refDistance() {
          return self.refDistance
        },
        set refDistance(value) {
          self.refDistance = value
        },
        get maxDistance() {
          return self.maxDistance
        },
        set maxDistance(value) {
          self.maxDistance = value
        },
        get rolloffFactor() {
          return self.rolloffFactor
        },
        set rolloffFactor(value) {
          self.rolloffFactor = value
        },
        get coneInnerAngle() {
          return self.coneInnerAngle
        },
        set coneInnerAngle(value) {
          self.coneInnerAngle = value
        },
        get coneOuterAngle() {
          return self.coneOuterAngle
        },
        set coneOuterAngle(value) {
          self.coneOuterAngle = value
        },
        get coneOuterGain() {
          return self.coneOuterGain
        },
        set coneOuterGain(value) {
          self.coneOuterGain = value
        },
        get currentTime() {
          return self.currentTime
        },
        set currentTime(value) {
          self.currentTime = value
        },
        get isPlaying() {
          return self.isPlaying
        },
        play(restartIfPlaying) {
          self.play(restartIfPlaying)
        },
        pause() {
          self.pause()
        },
        stop() {
          self.stop()
        },
        setPlaybackRate(rate) {
          self.setPlaybackRate(rate)
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

function isDistanceModel(value) {
  return distanceModels.includes(value)
}

function isGroup(value) {
  return groups.includes(value)
}
