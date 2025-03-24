import * as THREE from 'three'

import { System } from './System'

export class Wind extends System {
  constructor(world) {
    super(world)
    this.uniforms = {
      time: { value: 0 },
      strength: { value: 1 }, // 3 nice for pine
      direction: { value: new THREE.Vector3(1, 0, 0) },
      speed: { value: 0.5 }, // 0.1 nice for pine
      noiseScale: { value: 1 }, // 0.5 nice for pine
      ampScale: { value: 0.2 },
      freqMultiplier: { value: 1 },
    }
  }

  update(delta) {
    this.uniforms.time.value += delta
  }
}
