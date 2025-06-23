import { isBoolean, isNumber, isString } from 'lodash-es'
import CustomShaderMaterial from '../libs/three-custom-shader-material'
import * as THREE from '../extras/three'

import { getRef, Node, secureRef } from './Node'
import { uuid } from '../utils'

const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()
const q1 = new THREE.Quaternion()

const groups = ['music', 'sfx']
const distanceModels = ['linear', 'inverse', 'exponential']
const fits = ['none', 'cover', 'contain']
const pivots = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

const defaults = {
  screenId: null,
  src: null,
  linked: false,
  loop: false,

  visible: true,
  color: 'black',
  lit: false,
  doubleside: false,
  castShadow: false,
  receiveShadow: false,

  aspect: 16 / 9,
  fit: 'contain',

  width: null,
  height: 1,
  pivot: 'center',

  geometry: null,

  volume: 1,
  group: 'music',
  spatial: true,
  distanceModel: 'inverse',
  refDistance: 1,
  maxDistance: 40,
  rolloffFactor: 3,
  coneInnerAngle: 360,
  coneOuterAngle: 360,
  coneOuterGain: 0,
}

interface VideoData {
  screenId?: string | null
  src?: string | null
  linked?: boolean | string
  loop?: boolean
  visible?: boolean
  color?: string | null
  lit?: boolean
  doubleside?: boolean
  castShadow?: boolean
  receiveShadow?: boolean
  aspect?: number
  fit?: string
  width?: number | null
  height?: number | null
  pivot?: string
  geometry?: any
  volume?: number
  group?: string
  spatial?: boolean
  distanceModel?: string
  refDistance?: number
  maxDistance?: number
  rolloffFactor?: number
  coneInnerAngle?: number
  coneOuterAngle?: number
  coneOuterGain?: number
}

export class Video extends Node {
  n: number
  _loading: boolean
  needsRebuild: boolean = false
  _linked: boolean | string = defaults.linked
  _screenId: any
  instance: any
  _src: any
  _visible: any
  _aspect: number = defaults.aspect
  _fit: string = defaults.fit
  _color: string | null | undefined
  _lit: any
  _doubleside: any
  _geometry: any
  _width: any
  _height: any
  mesh!: THREE.Mesh<any, any, THREE.Object3DEventMap>
  _castShadow: any
  _receiveShadow: any
  sItem: any
  _loop: any
  gain: any
  _volume: any
  _spatial: any
  panner: any
  _distanceModel: any
  _refDistance: any
  _maxDistance: any
  _rolloffFactor: any
  _coneInnerAngle: any
  _coneOuterAngle: any
  _coneOuterGain: any
  shouldPlay: any
  _group: any
  pannerNode: any
  _materialProxy: any
  _pivot: any
  _onLoad: any
  
  constructor(data: VideoData = {}) {
    super(data)
    this.name = 'video'

    this.screenId = data.screenId ?? defaults.screenId
    this.src = data.src ?? defaults.src
    this.linked = data.linked ?? defaults.linked
    this.loop = data.loop ?? defaults.loop

    this.visible = data.visible ?? defaults.visible
    this.color = data.color ?? defaults.color
    this.lit = data.lit ?? defaults.lit
    this.doubleside = data.doubleside ?? defaults.doubleside
    this.castShadow = data.castShadow ?? defaults.castShadow
    this.receiveShadow = data.receiveShadow ?? defaults.receiveShadow

    this.aspect = data.aspect ?? defaults.aspect
    this.fit = data.fit ?? defaults.fit

    this.width = data.width ?? defaults.width
    this.height = data.height ?? defaults.height
    this.pivot = data.pivot ?? defaults.pivot

    this.geometry = data.geometry ?? defaults.geometry

    this.volume = data.volume ?? defaults.volume
    this.group = data.group ?? defaults.group
    this.spatial = data.spatial ?? defaults.spatial
    this.distanceModel = data.distanceModel ?? defaults.distanceModel
    this.refDistance = data.refDistance ?? defaults.refDistance
    this.maxDistance = data.maxDistance ?? defaults.maxDistance
    this.rolloffFactor = data.rolloffFactor ?? defaults.rolloffFactor
    this.coneInnerAngle = data.coneInnerAngle ?? defaults.coneInnerAngle
    this.coneOuterAngle = data.coneOuterAngle ?? defaults.coneOuterAngle
    this.coneOuterGain = data.coneOuterGain ?? defaults.coneOuterGain

    this.n = 0

    this._loading = true
  }

  async mount() {
    this.needsRebuild = false
    if (this.ctx.world.network.isServer) return
    this._loading = true

    const n = ++this.n

    // when linked can be instanced thousands of times all using the same video element and texture
    let key = ''
    if (this._linked === true) {
      key += 'default'
    } else if (this._linked === false) {
      key += uuid()
    } else {
      key += this._linked
    }

    let screen
    if (this._screenId) {
      screen = this.ctx.world.livekit.registerScreenNode(this)
    }

    if (screen) {
      this.instance = screen
    } else if (this._src) {
      let factory = this.ctx.world.loader.get('video', this._src)
      if (!factory) factory = await this.ctx.world.loader.load('video', this._src)
      if (this.n !== n) return
      this.instance = factory.get(key)
    }

    if (this._visible) {
      // material
      let material
      let vidAspect = this.instance?.width / this.instance?.height || this._aspect
      const uniforms = {
        uMap: { value: null },
        uHasMap: { value: 0 },
        uVidAspect: { value: vidAspect },
        uGeoAspect: { value: this._aspect },
        uFit: { value: this._fit === 'cover' ? 1 : this._fit === 'contain' ? 2 : 0 }, // 0 = none, 1 = cover, 2 = contain
        uColor: { value: new THREE.Color(this._color || 'black') },
        uOffset: { value: new THREE.Vector2(0, 0) },
      }
      // const color = this.instance?.ready ? 'white' : this._color
      material = new (CustomShaderMaterial as any)({
        baseMaterial: this._lit ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial,
        ...(this._lit ? { roughness: 1, metalness: 0 } : {}),
        // color,
        side: this._doubleside ? THREE.DoubleSide : THREE.FrontSide,
        uniforms,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
          }
        `,
        fragmentShader: `
          uniform sampler2D uMap;
          uniform float uHasMap;
          uniform float uVidAspect;
          uniform float uGeoAspect;
          uniform float uFit; // 0 = none, 1 = cover, 2 = contain
          uniform vec3 uColor; 
          uniform vec2 uOffset;
          
          varying vec2 vUv;

          vec4 sRGBToLinear(vec4 color) {
            return vec4(pow(color.rgb, vec3(2.2)), color.a);
          }
          
          vec4 LinearToSRGB(vec4 color) {
              return vec4(pow(color.rgb, vec3(1.0 / 2.2)), color.a);
          }
          
          void main() {
            // Calculate aspect ratio relationship between video and geometry
            float aspect = uGeoAspect / uVidAspect;

            vec2 uv = vUv;

            // Apply UV offset
            uv = uv + uOffset;
            
            // COVER MODE (uFit = 1.0)
            if (abs(uFit - 1.0) < 0.01) {
              // Center the UV coordinates
              uv = uv - 0.5;
              
              if (aspect > 1.0) {
                // Geometry is wider than video:
                // - Fill horizontally (maintain x scale)
                // - Scale vertically to maintain aspect ratio (shrink y)
                uv.y /= aspect;
              } else {
                // Geometry is taller than video:
                // - Fill vertically (maintain y scale)
                // - Scale horizontally to maintain aspect ratio (shrink x)
                uv.x *= aspect;
              }
              
              // Return to 0-1 range
              uv = uv + 0.5;
            }
            // CONTAIN MODE (uFit = 2.0)
            else if (abs(uFit - 2.0) < 0.01) {
              // Center the UV coordinates
              uv = uv - 0.5;
              
              if (aspect > 1.0) {
                // Geometry is wider than video:
                // - Fill vertically (maintain y scale)
                // - Scale horizontally to fit entire video (expand x)
                uv.x *= aspect;
              } else {
                // Geometry is taller than video:
                // - Fill horizontally (maintain x scale)
                // - Scale vertically to fit entire video (expand y)
                uv.y /= aspect;
              }
              
              // Return to 0-1 range
              uv = uv + 0.5;
            }

            // pull UV into [0,1] before sampling
            vec2 uvClamped = clamp(uv, 0.0, 1.0);
            vec4 col = texture2D(uMap, uvClamped);

            // outside coloring (for contain mode)
            if (uFit >= 1.5) {
              const float EPS = 0.005;
              // decide "outside" based on the *raw* uv
              bool outside = uv.x < -EPS || uv.x > 1.0 + EPS || uv.y < -EPS || uv.y > 1.0 + EPS;
              if (outside) {
                col = vec4(uColor, 1.0);
              }
            } 

            csm_DiffuseColor = sRGBToLinear(col);
          }
        `,
      })
      this.ctx.world.setupMaterial(material)

      let geometry
      // custom
      if (this._geometry) {
        geometry = this._geometry
      }
      // plane (initial)
      if (!this._geometry) {
        let width = this._width
        let height = this._height
        let preAspect = this._aspect
        if (width === null && height === null) {
          height = 0
          width = 0
        } else if (width !== null && height === null) {
          height = width / preAspect
        } else if (height !== null && width === null) {
          width = height * preAspect
        }
        geometry = new THREE.PlaneGeometry(width, height)
        geometry._oWidth = width
        geometry._oHeight = height
        applyPivot(geometry, width, height, this._pivot)
      }

      // mesh
      this.mesh = new THREE.Mesh(geometry, material)
      this.mesh.castShadow = this._castShadow
      this.mesh.receiveShadow = this._receiveShadow
      this.mesh.matrixWorld.copy(this.matrixWorld)
      this.mesh.matrixAutoUpdate = false
      this.mesh.matrixWorldAutoUpdate = false
      this.ctx.world.stage.scene.add(this.mesh)
      this.sItem = {
        matrix: this.matrixWorld,
        geometry,
        material,
        getEntity: () => this.ctx.entity,
        node: this,
      }
      this.ctx.world.stage.octree.insert(this.sItem)
    }

    if (!this.instance) return

    await this.instance.prepare
    if (this.n !== n) return

    this.instance.loop = this._loop

    this.gain = this.ctx.world.audio.ctx.createGain()
    this.gain.gain.value = this._volume
    this.gain.connect(this.ctx.world.audio.groupGains.music)
    if (this._spatial) {
      this.panner = this.ctx.world.audio.ctx.createPanner()
      this.panner.panningModel = 'HRTF'
      this.panner.distanceModel = this._distanceModel
      this.panner.refDistance = this._refDistance
      this.panner.maxDistance = this._maxDistance
      this.panner.rolloffFactor = this._rolloffFactor
      this.panner.coneInnerAngle = this._coneInnerAngle
      this.panner.coneOuterAngle = this._coneOuterAngle
      this.panner.coneOuterGain = this._coneOuterGain
      this.panner.connect(this.gain)
      this.instance.audio?.connect(this.panner)
      this.updatePannerPosition()
    } else {
      this.instance.audio?.connect(this.gain)
    }

    if (this._visible) {
      const geometry = this.mesh.geometry
      const material = this.mesh.material

      let vidAspect
      let geoAspect

      // custom
      if (this._geometry) {
        // based on the video dimensions, textures are scaled and repeated to emulate `background-size: cover` from css.
        // the end result is a video that is scaled up until it "covers" the entire UV square (0,0 to 1,1), centered.
        vidAspect = this.instance.width / this.instance.height
        geoAspect = this._aspect
      }

      // plane
      if (!this._geometry) {
        vidAspect = this.instance.width / this.instance.height
        let width = this._width
        let height = this._height
        if (width === null && height === null) {
          height = 0
          width = 0
        } else if (width !== null && height === null) {
          height = width / vidAspect
        } else if (height !== null && width === null) {
          width = height * vidAspect
        }
        // new geometry if changed
        if (geometry._oWidth !== width || geometry._oHeight !== height) {
          const newGeometry = new THREE.PlaneGeometry(width, height)
          applyPivot(newGeometry, width, height, this._pivot)
          this.mesh.geometry = newGeometry
          geometry.dispose()
        }
        // if the video aspect is different to the plane aspect we need to ensure the texture is scaled correctly.
        // this effect is identical to the `background-size: cover` css property.
        geoAspect = width / height
      }

      material.color.set('white')
      material.uniforms.uVidAspect.value = vidAspect
      material.uniforms.uGeoAspect.value = geoAspect
      material.uniforms.uMap.value = this.instance.texture
      material.uniforms.uHasMap.value = 1
      material.needsUpdate = true

      this._loading = false
      this._onLoad?.()

      if (this.shouldPlay) {
        this.instance.play()
        this.shouldPlay = false
      }
    }
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.unmount()
      this.mount()
      return
    }
    if (didMove) {
      if (this.mesh) {
        this.mesh.matrixWorld.copy(this.matrixWorld)
      }
      if (this.sItem) {
        this.ctx.world.stage.octree.move(this.sItem)
      }
      if (this.panner) {
        this.updatePannerPosition()
      }
    }
  }

  unmount() {
    if (this.ctx.world.network.isServer) return
    this.n++
    if (this.mesh) {
      this.ctx.world.stage.scene.remove(this.mesh)
      this.mesh.material.dispose()
      this.mesh.geometry.dispose()
      this.mesh = null as any
    }
    if (this.instance) {
      if (this.panner) {
        this.instance.audio?.disconnect(this.panner)
      } else {
        this.instance.audio?.disconnect(this.gain)
      }
      this.panner = null
      this.gain = null
      this.instance.release()
      this.instance = null
    }
    if (this.sItem) {
      this.ctx.world.stage.octree.remove(this.sItem)
      this.sItem = null
    }
    this.ctx.world.livekit.unregisterScreenNode(this)
  }

  updatePannerPosition() {
    const audio = this.ctx.world.audio
    const pos = v1.setFromMatrixPosition(this.matrixWorld)
    const qua = q1.setFromRotationMatrix(this.matrixWorld)
    const dir = v2.set(0, 0, -1).applyQuaternion(qua)
    if (this.panner.positionX) {
      const endTime = audio.ctx.currentTime + audio.lastDelta
      this.panner.positionX.linearRampToValueAtTime(pos.x, endTime)
      this.panner.positionY.linearRampToValueAtTime(pos.y, endTime)
      this.panner.positionZ.linearRampToValueAtTime(pos.z, endTime)
      this.panner.orientationX.linearRampToValueAtTime(dir.x, endTime)
      this.panner.orientationY.linearRampToValueAtTime(dir.y, endTime)
      this.panner.orientationZ.linearRampToValueAtTime(dir.z, endTime)
    } else {
      this.panner.setPosition(pos.x, pos.y, pos.z)
      this.panner.setOrientation(dir.x, dir.y, dir.z)
    }
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._screenId = source._screenId
    this._src = source._src
    this._linked = source._linked
    this._loop = source._loop

    this._visible = source._visible
    this._color = source._color
    this._lit = source._lit
    this._doubleside = source._doubleside
    this._castShadow = source._castShadow
    this._receiveShadow = source._receiveShadow

    this._aspect = source._aspect
    this._fit = source._fit

    this._width = source._width
    this._height = source._height
    this._pivot = source._pivot

    this._geometry = source._geometry

    this._volume = source._volume
    this._spatial = source._spatial
    this._group = source._group
    this._spatial = source._spatial
    this._distanceModel = source._distanceModel
    this._refDistance = source._refDistance
    this._maxDistance = source._maxDistance
    this._rolloffFactor = source._rolloffFactor
    this._coneInnerAngle = source._coneInnerAngle
    this._coneOuterAngle = source._coneOuterAngle
    this._coneOuterGain = source._coneOuterGain

    // this._color = source._color
    return this
  }

  get screenId() {
    return this._screenId
  }

  set screenId(value) {
    if (value === undefined) value = defaults.screenId
    if (value !== null && !isString(value)) {
      throw new Error('[video] screenId not null or string')
    }
    if (this._screenId === value) return
    this._screenId = value
    this.needsRebuild = true
    this.setDirty()
  }

  get src() {
    return this._src
  }

  set src(value) {
    if (value === undefined) value = defaults.src
    if (value !== null && !isString(value)) {
      throw new Error('[video] src not null or string')
    }
    if (this._src === value) return
    this._src = value
    this._loading = true
    this.needsRebuild = true
    this.setDirty()
  }

  get linked() {
    return this._linked
  }

  set linked(value) {
    if (value === undefined) value = defaults.linked
    if (!isBoolean(value) && !isString(value)) {
      throw new Error('[video] linked not boolean or string')
    }
    if (this._linked === value) return
    this._linked = value
    this.needsRebuild = true
    this.setDirty()
  }

  get loop() {
    return this._loop
  }

  set loop(value) {
    if (value === undefined) value = defaults.loop
    if (!isBoolean(value)) {
      throw new Error('[video] loop not boolean')
    }
    if (this._loop === value) return
    this._loop = value
    if (this.instance) {
      this.instance.loop = value
    }
  }

  get visible() {
    return this._visible
  }

  set visible(value) {
    if (value === undefined) value = defaults.visible
    if (!isBoolean(value)) {
      throw new Error('[video] visible not a boolean')
    }
    if (this._visible === value) return
    this._visible = value
    this.needsRebuild = true
    this.setDirty()
  }

  get color() {
    return this._color
  }

  set color(value) {
    if (value === undefined) value = defaults.color
    if (value !== null && !isString(value)) {
      throw new Error('[video] color not null or string')
    }
    if (this._color === value) return
    this._color = value
    this.needsRebuild = true
    this.setDirty()
  }

  get lit() {
    return this._lit
  }

  set lit(value) {
    if (value === undefined) value = defaults.lit
    if (!isBoolean(value)) {
      throw new Error('[video] lit not boolean')
    }
    if (this._lit === value) return
    this._lit = value
    this.needsRebuild = true
    this.setDirty()
  }

  get doubleside() {
    return this._doubleside
  }

  set doubleside(value) {
    if (value === undefined) value = defaults.doubleside
    if (!isBoolean(value)) {
      throw new Error('[video] doubleside not boolean')
    }
    if (this._doubleside === value) return
    this._doubleside = value
    if (this.mesh) {
      this.mesh.material.side = value ? THREE.DoubleSide : THREE.FrontSide
      this.mesh.material.needsUpdate = true
    }
  }

  get castShadow() {
    return this._castShadow
  }

  set castShadow(value) {
    if (value === undefined) value = defaults.castShadow
    if (!isBoolean(value)) {
      throw new Error('[video] castShadow not boolean')
    }
    if (this._castShadow === value) return
    this._castShadow = value
    if (this.mesh) {
      this.mesh.castShadow = value
    }
  }

  get receiveShadow() {
    return this._receiveShadow
  }

  set receiveShadow(value) {
    if (value === undefined) value = defaults.receiveShadow
    if (!isBoolean(value)) {
      throw new Error('[video] receiveShadow not boolean')
    }
    if (this._receiveShadow === value) return
    this._receiveShadow = value
    if (this.mesh) {
      this.mesh.receiveShadow = value
    }
  }

  get aspect() {
    return this._aspect
  }

  set aspect(value) {
    if (value === undefined) value = defaults.aspect
    if (!isNumber(value)) {
      throw new Error('[video] aspect not a number')
    }
    if (this._aspect === value) return
    this._aspect = value
    this.needsRebuild = true
    this.setDirty()
  }

  get fit() {
    return this._fit
  }

  set fit(value) {
    if (value === undefined) value = defaults.fit
    if (!isFit(value)) {
      throw new Error('[video] fit invalid')
    }
    if (this._fit === value) return
    this._fit = value
    this.needsRebuild = true
    this.setDirty()
  }

  get width() {
    return this._width
  }

  set width(value) {
    if (value === undefined) value = defaults.width
    if (value !== null && !isNumber(value)) {
      throw new Error('[video] width not null or number')
    }
    if (this._width === value) return
    this._width = value
    this.needsRebuild = true
    this.setDirty()
  }

  get height() {
    return this._height
  }

  set height(value) {
    if (value === undefined) value = defaults.height
    if (value !== null && !isNumber(value)) {
      throw new Error('[video] height not null or number')
    }
    if (this._height === value) return
    this._height = value
    this.needsRebuild = true
    this.setDirty()
  }

  get pivot() {
    return this._pivot
  }

  set pivot(value) {
    if (value === undefined) value = defaults.pivot
    if (!isPivot(value)) {
      throw new Error('[video] pivot invalid')
    }
    if (this._pivot === value) return
    this._pivot = value
    this.needsRebuild = true
    this.setDirty()
  }

  get geometry() {
    return secureRef({}, () => this._geometry)
  }

  set geometry(value) {
    if (value === undefined) value = defaults.geometry
    this._geometry = getRef(value)
    this.needsRebuild = true
    this.setDirty()
  }

  get volume() {
    return this._volume
  }

  set volume(value) {
    if (value === undefined) value = defaults.volume
    if (!isNumber(value)) {
      throw new Error('[video] volume not number')
    }
    if (this._volume === value) return
    this._volume = value
    if (this.gain) {
      this.gain.gain.value = value
    }
  }

  get group() {
    return this._group
  }

  set group(value) {
    if (value === undefined) value = defaults.group
    if (!isGroup(value)) {
      throw new Error('[video] group not valid')
    }
    this._group = value
    this.needsRebuild = true
    this.setDirty()
  }

  get spatial() {
    return this._spatial
  }

  set spatial(value) {
    if (value === undefined) value = defaults.spatial
    if (!isBoolean(value)) {
      throw new Error('[video] spatial not boolean')
    }
    if (this._spatial === value) return
    this._spatial = value
    this.needsRebuild = true
    this.setDirty()
  }

  get distanceModel() {
    return this._distanceModel
  }

  set distanceModel(value) {
    if (value === undefined) value = defaults.distanceModel
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

  set refDistance(value) {
    if (value === undefined) value = defaults.refDistance
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

  set maxDistance(value) {
    if (value === undefined) value = defaults.maxDistance
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

  set rolloffFactor(value) {
    if (value === undefined) value = defaults.rolloffFactor
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

  set coneInnerAngle(value) {
    if (value === undefined) value = defaults.coneInnerAngle
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

  set coneOuterAngle(value) {
    if (value === undefined) value = defaults.coneOuterAngle
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

  set coneOuterGain(value) {
    if (value === undefined) value = defaults.coneOuterGain
    if (!isNumber(value)) {
      throw new Error('[audio] coneOuterGain not a number')
    }
    this._coneOuterGain = value
    if (this.pannerNode) {
      this.pannerNode.coneOuterGain = this._coneOuterGain
    }
  }

  get loading() {
    return this._loading
  }

  get duration() {
    return this.instance ? this.instance.duration : 0
  }

  get playing() {
    return this.instance ? this.instance.isPlaying : false
  }

  get time() {
    return this.instance ? this.instance.currentTime : 0
  }

  set time(value) {
    if (this.instance) {
      this.instance.currentTime = value
    }
  }

  get material() {
    if (!this._materialProxy) {
      const self = this
      this._materialProxy = {
        get textureX() {
          return self.mesh.material.uniforms.uOffset.value.x
        },
        set textureX(value) {
          self.mesh.material.uniforms.uOffset.value.x = value
        },
        get textureY() {
          return self.mesh.material.uniforms.uOffset.value.y
        },
        set textureY(value) {
          self.mesh.material.uniforms.uOffset.value.y = value
        },
      }
    }
    return this._materialProxy
  }

  set material(value) {
    throw new Error('[video] cannot set material')
  }

  get onLoad() {
    return this._onLoad
  }

  set onLoad(value) {
    this._onLoad = value
  }

  play(restartIfPlaying) {
    if (this.instance) {
      this.instance.play(restartIfPlaying)
    } else {
      this.shouldPlay = true
    }
  }

  pause() {
    this.instance?.pause()
  }

  stop() {
    this.instance?.stop()
  }

  getProxy() {
    var self = this
    if (!this.proxy) {
      let proxy = {
        get screenId() {
          return self.screenId
        },
        set screenId(value) {
          self.screenId = value
        },
        get src() {
          return self.src
        },
        set src(value) {
          self.src = value
        },
        get linked() {
          return self.linked
        },
        set linked(value) {
          self.linked = value
        },
        get loop() {
          return self.loop
        },
        set loop(value) {
          self.loop = value
        },
        get visible() {
          return self.visible
        },
        set visible(value) {
          self.visible = value
        },
        get color() {
          return self.color
        },
        set color(value) {
          self.color = value
        },
        get lit() {
          return self.lit
        },
        set lit(value) {
          self.lit = value
        },
        get doubleside() {
          return self.doubleside
        },
        set doubleside(value) {
          self.doubleside = value
        },
        get castShadow() {
          return self.castShadow
        },
        set castShadow(value) {
          self.castShadow = value
        },
        get receiveShadow() {
          return self.receiveShadow
        },
        set receiveShadow(value) {
          self.receiveShadow = value
        },
        get aspect() {
          return self.aspect
        },
        set aspect(value) {
          self.aspect = value
        },
        get fit() {
          return self.fit
        },
        set fit(value) {
          self.fit = value
        },
        get width() {
          return self.width
        },
        set width(value) {
          self.width = value
        },
        get height() {
          return self.height
        },
        set height(value) {
          self.height = value
        },
        get pivot() {
          return self.pivot
        },
        set pivot(value) {
          self.pivot = value
        },
        get geometry() {
          return self.geometry
        },
        set geometry(value) {
          self.geometry = value
        },
        get volume() {
          return self.volume
        },
        set volume(value) {
          self.volume = value
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
        get loading() {
          return self.loading
        },
        get duration() {
          return self.duration
        },
        get playing() {
          return self.playing
        },
        get isPlaying() {
          // deprecated (use .playing)
          return self.playing
        },
        get time() {
          return self.time
        },
        set time(value) {
          self.time = value
        },
        get currentTime() {
          // deprecated (use .time)
          return self.time
        },
        set currentTime(value) {
          // deprecated (use .time)
          self.time = value
        },
        get material() {
          return self.material
        },
        set material(value) {
          self.material = value
        },
        get onLoad() {
          return self.onLoad
        },
        set onLoad(value) {
          self.onLoad = value
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

function isFit(value) {
  return fits.includes(value)
}

function isPivot(value) {
  return pivots.includes(value)
}

function applyPivot(geometry, width, height, pivot) {
  if (pivot === 'center') return
  let offsetX = 0
  let offsetY = 0
  if (pivot.includes('left')) {
    offsetX = width / 2
  } else if (pivot.includes('right')) {
    offsetX = -width / 2
  }
  if (pivot.includes('top')) {
    offsetY = -height / 2
  } else if (pivot.includes('bottom')) {
    offsetY = height / 2
  }
  if (offsetX !== 0 || offsetY !== 0) {
    geometry.translate(offsetX, offsetY, 0)
  }
}
