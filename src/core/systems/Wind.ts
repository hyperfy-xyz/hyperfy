import * as THREE from 'three'

import { System } from './System'

interface WindUniforms {
  time: { value: number }
  strength: { value: number }
  direction: { value: THREE.Vector3 }
  speed: { value: number }
  noiseScale: { value: number }
  ampScale: { value: number }
  freqMultiplier: { value: number }
}

export class Wind extends System {
  uniforms: WindUniforms
  
  constructor(world: any) {
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

  update(delta: number) {
    this.uniforms.time.value += delta
  }
}
