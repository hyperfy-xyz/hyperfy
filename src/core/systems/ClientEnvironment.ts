import * as THREE from '../extras/three'

import { System } from './System'

import { CSM } from '../libs/csm/CSM'
import type { World, WorldOptions } from '../../types/index'

// Helper functions to replace lodash
function isNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value)
}

function isString(value: any): value is string {
  return typeof value === 'string'
}

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

interface BaseEnvironment {
  model?: string;
  bg?: string;
  hdr?: string;
  sunDirection?: THREE.Vector3;
  sunIntensity?: number;
  sunColor?: string;
  fogNear?: number;
  fogFar?: number;
  fogColor?: string;
}

interface SkyNode {
  _bg?: string;
  _hdr?: string;
  _sunDirection?: THREE.Vector3;
  _sunIntensity?: number;
  _sunColor?: string;
  _fogNear?: number;
  _fogFar?: number;
  _fogColor?: string;
}

interface SkyHandle {
  node: SkyNode;
  destroy: () => void;
}

interface SkyInfo {
  bgUrl?: string;
  hdrUrl?: string;
  sunDirection: THREE.Vector3;
  sunIntensity: number;
  sunColor: string;
  fogNear?: number;
  fogFar?: number;
  fogColor?: string;
}

/**
 * Environment System
 *
 * - Runs on the client
 * - Sets up the sky, hdr, sun, shadows, fog etc
 *
 */
export class ClientEnvironment extends System {
  base!: BaseEnvironment;
  model: any = null;
  skys: SkyHandle[] = [];
  sky: THREE.Mesh | null = null;
  skyN: number = 0;
  bgUrl?: string;
  hdrUrl?: string;
  csm!: CSM;
  skyInfo!: SkyInfo;

  constructor(world: World) {
    super(world)
  }

  override init(options: WorldOptions & { baseEnvironment?: BaseEnvironment }): Promise<void> {
    this.base = options.baseEnvironment || {}
    return Promise.resolve()
  }

  override async start() {
    this.buildCSM()
    this.updateSky()
    
    // Load initial model
    await this.updateModel()

    const worldAny = this.world as any
    worldAny.settings?.on('change', this.onSettingsChange)
    worldAny.prefs?.on('change', this.onPrefsChange)
    worldAny.graphics?.on('resize', this.onViewportResize)
  }

  async updateModel() {
    const worldAny = this.world as any
    const url = worldAny.settings?.model?.url || this.base.model
    let glb = worldAny.loader?.get('model', url)
    if (!glb) glb = await worldAny.loader?.load('model', url)
    if (this.model) this.model.deactivate()
    this.model = glb.toNodes()
    this.model.activate({ world: this.world, label: 'base' })
  }

  addSky(node: SkyNode) {
    const handle: SkyHandle = {
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
      const skyMaterial = this.sky.material as THREE.MeshBasicMaterial
      skyMaterial.fog = false
      skyMaterial.toneMapped = false
      skyMaterial.needsUpdate = true
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
    const sunIntensity = (node && isNumber(node._sunIntensity)) ? node._sunIntensity : base.sunIntensity
    const sunColor = (node && isString(node._sunColor)) ? node._sunColor : base.sunColor
    const fogNear = (node && isNumber(node._fogNear)) ? node._fogNear : base.fogNear
    const fogFar = (node && isNumber(node._fogFar)) ? node._fogFar : base.fogFar
    const fogColor = (node && isString(node._fogColor)) ? node._fogColor : base.fogColor

    const n = ++this.skyN
    let bgTexture
    if (bgUrl) bgTexture = await (this.world as any).loader?.load('texture', bgUrl)
    let hdrTexture
    if (hdrUrl) hdrTexture = await (this.world as any).loader?.load('hdr', hdrUrl)
    if (n !== this.skyN) return

    if (bgTexture) {
      // bgTexture = bgTexture.clone()
      bgTexture.minFilter = bgTexture.magFilter = THREE.LinearFilter
      bgTexture.mapping = THREE.EquirectangularReflectionMapping
      // bgTexture.encoding = Encoding[this.encoding]
      bgTexture.colorSpace = THREE.SRGBColorSpace
      const skyMaterial = this.sky.material as THREE.MeshBasicMaterial
      skyMaterial.map = bgTexture
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

    this.csm.lightDirection = sunDirection || new THREE.Vector3(0, -1, 0)

    for (const light of this.csm.lights) {
      light.intensity = sunIntensity || 1
      light.color.set(sunColor || '#ffffff')
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
      sunDirection: sunDirection || new THREE.Vector3(0, -1, 0),
      sunIntensity: sunIntensity || 1,
      sunColor: sunColor || '#ffffff',
      fogNear,
      fogFar,
      fogColor,
    }
  }

  override update(_delta: number) {
    this.csm.update()
  }

  override lateUpdate(_delta: number) {
    if (!this.sky) return
    this.sky.position.x = this.world.rig.position.x
    this.sky.position.z = this.world.rig.position.z
    this.sky.matrixWorld.setPosition(this.sky.position)
    // this.sky.matrixWorld.copyPosition(this.world.rig.matrixWorld)
  }

  buildCSM() {
    const worldAny = this.world as any
    const shadowsLevel = worldAny.prefs?.shadows || 'med'
    const options = csmLevels[shadowsLevel as keyof typeof csmLevels] || csmLevels.med
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
        maxCascades: 3,
        maxFar: 100,
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

  onSettingsChange = (changes: any) => {
    if (changes.model) {
      this.updateModel()
    }
  }

  onPrefsChange = (changes: any) => {
    if (changes.shadows) {
      this.buildCSM()
      this.updateSky()
    }
  }

  onViewportResize = () => {
    this.csm.updateFrustums()
  }
}
