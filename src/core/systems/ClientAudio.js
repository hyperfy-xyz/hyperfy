import * as THREE from '../extras/three'

import { System } from './System'

const up = new THREE.Vector3(0, 1, 0)
const v1 = new THREE.Vector3()

export class ClientAudio extends System {
  constructor(world) {
    super(world)
    this.handles = new Set()
    this.ctx = new AudioContext() // new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain()
    this.masterGain.connect(this.ctx.destination)
    this.groupGains = {
      music: this.ctx.createGain(),
      sfx: this.ctx.createGain(),
      voice: this.ctx.createGain(),
    }
    this.groupGains.music.gain.value = world.prefs.music
    this.groupGains.sfx.gain.value = world.prefs.sfx
    this.groupGains.voice.gain.value = world.prefs.voice
    this.groupGains.music.connect(this.masterGain)
    this.groupGains.sfx.connect(this.masterGain)
    this.groupGains.voice.connect(this.masterGain)
    this.listener = this.ctx.listener
    this.listener.positionX.value = 0
    this.listener.positionY.value = 0
    this.listener.positionZ.value = 0
    this.listener.forwardX.value = 0
    this.listener.forwardY.value = 0
    this.listener.forwardZ.value = -1
    this.listener.upX.value = 0
    this.listener.upY.value = 1
    this.listener.upZ.value = 0
    this.lastDelta = 0

    this.gestured = false
    this.gestureQueue = []
    const onGesture = () => {
      while (this.gestureQueue.length) {
        this.gestureQueue.shift()()
      }
      document.body.removeEventListener('click', onGesture)
      this.gestured = true
    }
    document.body.addEventListener('click', onGesture)
  }

  async init() {
    this.world.prefs.on('change', this.onPrefsChange)
  }

  start() {
    // ...
  }

  lateUpdate(delta) {
    const target = this.world.rig
    const dir = v1.set(0, 0, -1).applyQuaternion(target.quaternion)
    if (this.listener.positionX) {
      // https://github.com/mrdoob/three.js/blob/master/src/audio/AudioListener.js
      // code path for Chrome (see three#14393)
      const endTime = this.ctx.currentTime + delta
      this.listener.positionX.linearRampToValueAtTime(target.position.x, endTime)
      this.listener.positionY.linearRampToValueAtTime(target.position.y, endTime)
      this.listener.positionZ.linearRampToValueAtTime(target.position.z, endTime)
      this.listener.forwardX.linearRampToValueAtTime(dir.x, endTime)
      this.listener.forwardY.linearRampToValueAtTime(dir.y, endTime)
      this.listener.forwardZ.linearRampToValueAtTime(dir.z, endTime)
      this.listener.upX.linearRampToValueAtTime(up.x, endTime)
      this.listener.upY.linearRampToValueAtTime(up.y, endTime)
      this.listener.upZ.linearRampToValueAtTime(up.z, endTime)
    } else {
      this.listener.setPosition(target.position.x, target.position.y, target.position.z)
      this.listener.setOrientation(dir.x, dir.y, dir.z, up.x, up.y, up.z)
    }
    this.lastDelta = delta
  }

  requireGesture(fn) {
    if (this.gestured) return fn()
    this.gestureQueue.push(fn)
  }

  onPrefsChange = changes => {
    if (changes.music) {
      this.groupGains.music.gain.value = changes.music.value
    }
    if (changes.sfx) {
      this.groupGains.sfx.gain.value = changes.sfx.value
    }
    if (changes.voice) {
      this.groupGains.voice.gain.value = changes.voice.value
    }
  }
}
