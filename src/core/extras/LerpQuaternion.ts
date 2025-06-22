import * as THREE from 'three'

export class LerpQuaternion {
  value: THREE.Quaternion;
  rate: number;
  previous: THREE.Quaternion;
  current: THREE.Quaternion;
  time: number;
  snapToken: unknown;

  constructor(value: THREE.Quaternion, rate: number) {
    this.value = value
    this.rate = rate // receive rate eg 1/5 for 5hz
    this.previous = new THREE.Quaternion().copy(this.value)
    this.current = new THREE.Quaternion().copy(this.value)
    this.time = 0
    this.snapToken = null
  }

  push(value: THREE.Quaternion, snapToken: unknown = null) {
    if (this.snapToken !== snapToken) {
      this.snapToken = snapToken
      this.previous.copy(value)
      this.current.copy(value)
      this.value.copy(value)
    } else {
      this.previous.copy(this.current)
      this.current.copy(value)
    }
    this.time = 0
  }

  pushArray(value: number[], snapToken: unknown = null) {
    if (this.snapToken !== snapToken) {
      this.snapToken = snapToken
      this.previous.fromArray(value)
      this.current.fromArray(value)
      this.value.fromArray(value)
    } else {
      this.previous.copy(this.current)
      this.current.fromArray(value)
    }
    this.time = 0
  }

  update(delta: number) {
    this.time += delta
    let alpha = this.time / this.rate
    if (alpha > 1) alpha = 1
    this.value.slerpQuaternions(this.previous, this.current, alpha)
    return this
  }

  snap() {
    this.previous.copy(this.current)
    this.value.copy(this.current)
    this.time = 0
  }

  clear() {
    this.previous.copy(this.value)
    this.current.copy(this.value)
    this.time = 0
  }
}
