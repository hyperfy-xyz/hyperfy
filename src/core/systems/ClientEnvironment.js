import * as THREE from '../extras/three'

import { System } from './System'

import { CSM } from '../libs/csm/CSM'
import { isNumber, isString } from 'lodash-es'

const csmLevels = {
  none: {
    cascades: 1,
    shadowMapSize: 1024,
    castShadow: false,
    lightIntensity: 3,
    // shadowBias: 0.000002,
    // shadowNormalBias: 0.001,
  },
  low: {
    cascades: 1,
    shadowMapSize: 2048,
    castShadow: true,
    lightIntensity: 3,
    shadowBias: 0.0000009,
    shadowNormalBias: 0.001,
  },
  med: {
    cascades: 3,
    shadowMapSize: 1024,
    castShadow: true,
    lightIntensity: 1,
    shadowBias: 0.000002,
    shadowNormalBias: 0.002,
  },
  high: {
    cascades: 3,
    shadowMapSize: 2048,
    castShadow: true,
    lightIntensity: 1,
    shadowBias: 0.000003,
    shadowNormalBias: 0.002,
  },
}

// fix fog distance calc
// see: https://github.com/mrdoob/three.js/issues/14601
// future: https://www.youtube.com/watch?v=k1zGz55EqfU
// THREE.ShaderChunk.fog_vertex = `
// #ifdef USE_FOG
// 	// vFogDepth = - mvPosition.z;
//   vFogDepth = length(mvPosition);
// #endif
// `

/**
 * Environment System
 *
 * - Runs on the client
 * - Sets up the sky, hdr, sun, shadows, fog etc
 *
 */
export class ClientEnvironment extends System {
  constructor(world) {
    super(world)

    this.skys = []
    this.sky = null
    this.skyN = 0
    this.bgUrl = null
    this.hdrUrl = null
  }

  init({ baseEnvironment }) {
    this.base = baseEnvironment
    console.log(this.base)
  }

  async start() {
    this.buildCSM()
    this.updateSky()

    this.world.prefs.on('change', this.onPrefsChange)
    this.world.graphics.on('resize', this.onViewportResize)

    // TEMP: the following sets up a the base environment
    // but eventually you'll do this with an environment app
    if (this.base.model) {
      const glb = await this.world.loader.load('model', this.base.model)
      const root = glb.toNodes()
      root.activate({ world: this.world, label: 'base' })
    }
  }

  addSky(node) {
    const handle = {
      node,
      destroy: () => {
        const idx = this.skys.indexOf(handle)
        if (idx === -1) return
        this.skys.splice(idx, 1)
        this.updateSky()
      },
    }
    this.skys.push(handle)
    this.updateSky()
    return handle
  }

  getSky() {}

  async updateSky() {
    if (!this.sky) {
      const geometry = new THREE.SphereGeometry(1000, 60, 40)
      const material = new THREE.MeshBasicMaterial({ side: THREE.BackSide })
      this.sky = new THREE.Mesh(geometry, material)
      this.sky.geometry.computeBoundsTree()
      this.sky.material.fog = false
      this.sky.material.toneMapped = false
      this.sky.material.needsUpdate = true
      this.sky.matrixAutoUpdate = false
      this.sky.matrixWorldAutoUpdate = false
      this.sky.visible = false
      this.world.stage.scene.add(this.sky)
    }

    const base = this.base
    const node = this.skys[this.skys.length - 1]?.node
    const bgUrl = node?._bg || base.bg
    const hdrUrl = node?._hdr || base.hdr
    const sunDirection = node?._sunDirection || base.sunDirection
    const sunIntensity = isNumber(node?._sunIntensity) ? node._sunIntensity : base.sunIntensity
    const sunColor = isString(node?._sunColor) ? node._sunColor : base.sunColor
    const fogNear = isNumber(node?._fogNear) ? node._fogNear : base.fogNear
    const fogFar = isNumber(node?._fogFar) ? node._fogFar : base.fogFar
    const fogColor = isString(node?._fogColor) ? node._fogColor : base.fogColor

    const n = ++this.skyN
    let bgTexture
    if (bgUrl) bgTexture = await this.world.loader.load('texture', bgUrl)
    let hdrTexture
    if (hdrUrl) hdrTexture = await this.world.loader.load('hdr', hdrUrl)
    if (n !== this.skyN) return

    if (bgTexture) {
      // bgTexture = bgTexture.clone()
      bgTexture.minFilter = bgTexture.magFilter = THREE.LinearFilter
      bgTexture.mapping = THREE.EquirectangularReflectionMapping
      // bgTexture.encoding = Encoding[this.encoding]
      bgTexture.colorSpace = THREE.SRGBColorSpace
      this.sky.material.map = bgTexture
      this.sky.visible = true
    } else {
      this.sky.visible = false
    }

    if (hdrTexture) {
      // hdrTexture.colorSpace = THREE.NoColorSpace
      // hdrTexture.colorSpace = THREE.SRGBColorSpace
      // hdrTexture.colorSpace = THREE.LinearSRGBColorSpace
      hdrTexture.mapping = THREE.EquirectangularReflectionMapping
      this.world.stage.scene.environment = hdrTexture
    }

    this.csm.lightDirection = sunDirection

    for (const light of this.csm.lights) {
      light.intensity = sunIntensity
      light.color.set(sunColor)
    }

    if (isNumber(fogNear) && isNumber(fogFar) && fogColor) {
      const color = new THREE.Color(fogColor)
      this.world.stage.scene.fog = new THREE.Fog(color, fogNear, fogFar)
    } else {
      this.world.stage.scene.fog = null
    }

    this.skyInfo = {
      bgUrl,
      hdrUrl,
      sunDirection,
      sunIntensity,
      sunColor,
      fogNear,
      fogFar,
      fogColor,
    }
  }

  update(delta) {
    this.csm.update()
  }

  lateUpdate(delta) {
    this.sky.matrixWorld.copyPosition(this.world.rig.matrixWorld)
  }

  buildCSM() {
    const options = csmLevels[this.world.prefs.shadows]
    if (this.csm) {
      this.csm.updateCascades(options.cascades)
      this.csm.updateShadowMapSize(options.shadowMapSize)
      this.csm.lightDirection = this.skyInfo.sunDirection
      for (const light of this.csm.lights) {
        light.intensity = this.skyInfo.sunIntensity
        light.color.set(this.skyInfo.sunColor)
        light.castShadow = options.castShadow
      }
    } else {
      const scene = this.world.stage.scene
      const camera = this.world.camera
      this.csm = new CSM({
        mode: 'practical', // uniform, logarithmic, practical, custom
        // mode: 'custom',
        // customSplitsCallback: function (cascadeCount, nearDistance, farDistance) {
        //   return [0.05, 0.2, 0.5]
        // },
        cascades: 3,
        maxCascades: 3,
        shadowMapSize: 2048,
        maxFar: 100,
        lightIntensity: 1,
        lightDirection: new THREE.Vector3(0, -1, 0).normalize(),
        fade: true,
        parent: scene,
        camera: camera,
        // note: you can play with bias in console like this:
        // var csm = world.graphics.csm
        // csm.shadowBias = 0.00001
        // csm.shadowNormalBias = 0.002
        // csm.updateFrustums()
        // shadowBias: 0.00001,
        // shadowNormalBias: 0.002,
        // lightNear: 0.0000001,
        // lightFar: 5000,
        // lightMargin: 200,
        // noLastCascadeCutOff: true,
        ...options,
        // note: you can test changes in console and then call csm.updateFrustrums() to debug
      })
      if (!options.castShadow) {
        for (const light of this.csm.lights) {
          light.castShadow = false
        }
      }
    }
  }

  onPrefsChange = changes => {
    if (changes.shadows) {
      this.buildCSM()
      this.updateSky()
    }
  }

  onViewportResize = () => {
    this.csm.updateFrustums()
  }
}
