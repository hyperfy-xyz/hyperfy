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
    lightIntensity: 1,
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

const defaults = {
  bg: '/day2-2k.jpg',
  hdr: '/day2.hdr',
  sunDirection: new THREE.Vector3(-1, -2, -2).normalize(),
  sunIntensity: 1,
  sunColor: 0xffffff,
}

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

  async start() {
    this.buildCSM()
    this.updateSky()

    this.world.client.settings.on('change', this.onSettingsChange)
    this.world.graphics.on('resize', this.onViewportResize)

    // TEMP: the following sets up a the base environment
    // but eventually you'll do this with an environment app

    // ground
    const glb = await this.world.loader.load('model', '/base-environment.glb')
    const root = glb.toNodes()
    root.activate({ world: this.world, label: 'base-environment' })
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

  async updateSky() {
    if (!this.sky) {
      const geometry = new THREE.SphereGeometry(1000, 60, 40)
      const material = new THREE.MeshBasicMaterial({ side: THREE.BackSide })
      this.sky = new THREE.Mesh(geometry, material)
      this.sky.geometry.computeBoundsTree()
      this.sky.material.needsUpdate = true
      this.sky.material.fog = false
      this.sky.material.toneMapped = false
      this.sky.matrixAutoUpdate = false
      this.sky.matrixWorldAutoUpdate = false
      this.sky.visible = false
      this.world.stage.scene.add(this.sky)
    }

    const node = this.skys[this.skys.length - 1]?.node
    const bgUrl = node?._bg || defaults.bg
    const hdrUrl = node?._hdr || defaults.hdr
    const sunDirection = node?._sunDirection || defaults.sunDirection
    const sunIntensity = isNumber(node?._sunIntensity) ? node._sunIntensity : defaults.sunIntensity
    const sunColor = isString(node?._sunColor) ? node._sunColor : defaults.sunColor

    const n = ++this.skyN
    const bgTexture = await this.world.loader.load('texture', bgUrl)
    const hdrTexture = await this.world.loader.load('hdr', hdrUrl)
    if (n !== this.skyN) return

    // bgTexture = bgTexture.clone()
    bgTexture.minFilter = bgTexture.magFilter = THREE.LinearFilter
    bgTexture.mapping = THREE.EquirectangularReflectionMapping
    // bgTexture.encoding = Encoding[this.encoding]
    bgTexture.colorSpace = THREE.SRGBColorSpace
    this.sky.material.map = bgTexture

    // hdrTexture.colorSpace = THREE.NoColorSpace
    // hdrTexture.colorSpace = THREE.SRGBColorSpace
    // hdrTexture.colorSpace = THREE.LinearSRGBColorSpace
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping
    this.world.stage.scene.environment = hdrTexture

    this.csm.lightDirection = sunDirection

    for (const light of this.csm.lights) {
      light.intensity = sunIntensity
      light.color.set(sunColor)
    }

    this.sky.visible = true
  }

  update(delta) {
    this.csm.update()
  }

  lateUpdate(delta) {
    this.sky.matrixWorld.copyPosition(this.world.rig.matrixWorld)
  }

  buildCSM() {
    if (this.csm) this.csm.dispose()
    const scene = this.world.stage.scene
    const camera = this.world.camera
    const options = csmLevels[this.world.client.settings.shadows]
    this.csm = new CSM({
      mode: 'practical', // uniform, logarithmic, practical, custom
      // mode: 'custom',
      // customSplitsCallback: function (cascadeCount, nearDistance, farDistance) {
      //   return [0.05, 0.2, 0.5]
      // },
      cascades: 3,
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

  onSettingsChange = changes => {
    if (changes.shadows) {
      this.buildCSM()
    }
  }

  onViewportResize = () => {
    this.csm.updateFrustums()
  }
}
