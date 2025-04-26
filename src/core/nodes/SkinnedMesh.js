import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

import { Node } from './Node'
import * as THREE from '../extras/three'
import { isBoolean } from 'lodash-es'

const defaults = {
  object3d: null,
  animations: [],
  castShadow: true,
  receiveShadow: true,
}

const m1 = new THREE.Matrix4()

const defaultStopOpts = { fade: 0.15 }

export class SkinnedMesh extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'skinnedmesh'

    this._object3d = data.object3d
    this._animations = data.animations

    this.castShadow = data.castShadow
    this.receiveShadow = data.receiveShadow

    this.clips = {}
    this.actions = {}
    this.bones = null
    this.animNames = []
  }

  mount() {
    this.obj = SkeletonUtils.clone(this._object3d)
    this.obj.matrixWorld.copy(this.matrixWorld)
    this.obj.matrixAutoUpdate = false
    this.obj.matrixWorldAutoUpdate = false
    this.obj.traverse(n => {
      if (n.isMesh) {
        n.castShadow = this._castShadow
        n.receiveShadow = this._receiveShadow
      }
    })
    this.ctx.world.stage.scene.add(this.obj)
    for (const clip of this._animations) {
      this.clips[clip.name] = clip
      this.animNames.push(clip.name)
    }
    this.needsRebuild = false
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.unmount()
      this.mount()
    }
    if (didMove) {
      if (this.obj) {
        this.obj.matrixWorld.copy(this.matrixWorld)
      }
    }
  }

  unmount() {
    if (this.obj) {
      if (this.mixer) {
        this.mixer.stopAllAction()
        this.mixer.uncacheRoot(this.obj)
        this.mixer = null
        this.ctx.world.setHot(this, false)
        this.clips = {}
        this.actions = {}
      }
      this.ctx.world.stage.scene.remove(this.obj)
      this.obj = null
      this.bones = null
      this.animNames = []
    }
  }

  update(delta) {
    this.mixer?.update(delta)
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._object3d = source._object3d
    this._animations = source._animations
    this._castShadow = source._castShadow
    this._receiveShadow = source._receiveShadow
    return this
  }

  get anims() {
    return this.animNames.slice()
  }

  get castShadow() {
    return this._castShadow
  }

  set castShadow(value = defaults.castShadow) {
    if (!isBoolean(value)) {
      throw new Error('[skinnedmesh] castShadow not a boolean')
    }
    if (this._castShadow === value) return
    this._castShadow = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get receiveShadow() {
    return this._receiveShadow
  }

  set receiveShadow(value = defaults.receiveShadow) {
    if (!isBoolean(value)) {
      throw new Error('[skinnedmesh] receiveShadow not a boolean')
    }
    if (this._receiveShadow === value) return
    this._receiveShadow = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  play({ name, fade = 0.15, speed, loop = true }) {
    if (!this.mixer) {
      this.mixer = new THREE.AnimationMixer(this.obj)
      this.ctx.world.setHot(this, true)
    }
    if (this.action?._clip.name === name) {
      return
    }
    if (this.action) {
      this.action.fadeOut(fade)
    }
    this.action = this.actions[name]
    if (!this.action) {
      const clip = this.clips[name]
      if (!clip) return console.warn(`[skinnedmesh] animation not found: ${name}`)
      this.action = this.mixer.clipAction(clip)
      this.actions[name] = this.action
    }
    if (speed !== undefined) this.action.timeScale = speed
    this.action.clampWhenFinished = !loop
    this.action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce)
    this.action.reset().fadeIn(fade).play()
  }

  stop(opts = defaultStopOpts) {
    if (!this.action) return
    this.action.fadeOut(opts.fade)
    this.action = null
  }

  getBoneTransform(name) {
    if (!this.obj) return null
    if (!this.bones) {
      this.bones = {}
      this.obj.traverse(child => {
        if (child.isBone) this.bones[child.name] = child
      })
    }
    const bone = this.bones[name]
    if (!bone) {
      console.warn(`[skinnedmesh] bone not found: ${name}`)
      return null
    }
    // combine the skinned mesh's world matrix with the bone's world matrix
    // return m1.multiplyMatrices(this.matrixWorld, bone.matrixWorld)
    bone.updateMatrixWorld(true)
    return m1.copy(bone.matrixWorld)
  }

  getProxy() {
    var self = this
    if (!this.proxy) {
      let proxy = {
        get anims() {
          return self.anims
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
        play(opts) {
          self.play(opts)
        },
        stop(opts) {
          self.stop(opts)
        },
        getBoneTransform(name) {
          return self.getBoneTransform(name)
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}
