import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

import * as THREE from './three'
import { DEG2RAD } from './general'
import { getTrianglesFromGeometry } from './getTrianglesFromGeometry'
import { getTextureBytesFromMaterial } from './getTextureBytesFromMaterial'
import { Emotes } from './playerEmotes'

const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()
const q1 = new THREE.Quaternion()
const m1 = new THREE.Matrix4()

const FORWARD = new THREE.Vector3(0, 0, -1)

const DIST_MIN_RATE = 1 / 5 // 5 times per second
const DIST_MAX_RATE = 1 / 60 // 40 times per second
const DIST_MIN = 5 // <= 5m = max rate
const DIST_MAX = 60 // >= 60m = min rate

const MAX_GAZE_DISTANCE = 40

const material = new THREE.MeshBasicMaterial()

const AimAxis = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1),
  NEG_X: new THREE.Vector3(-1, 0, 0),
  NEG_Y: new THREE.Vector3(0, -1, 0),
  NEG_Z: new THREE.Vector3(0, 0, -1),
}

const UpAxis = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1),
  NEG_X: new THREE.Vector3(-1, 0, 0),
  NEG_Y: new THREE.Vector3(0, -1, 0),
  NEG_Z: new THREE.Vector3(0, 0, -1),
}

// TODO: de-dup PlayerLocal.js has a copy
const Modes = {
  IDLE: 0,
  WALK: 1,
  RUN: 2,
  JUMP: 3,
  FALL: 4,
  FLY: 5,
  TALK: 6,
  FLIP: 7,
}

export function createVRMFactory(glb, setupMaterial) {
  // we'll update matrix ourselves
  glb.scene.matrixAutoUpdate = false
  glb.scene.matrixWorldAutoUpdate = false
  // NOTE: Preserve VRMExpression nodes so facial expressions (blink/viseme) can work
  // remove VRMHumanoidRig
  const vrmHumanoidRigs = glb.scene.children.filter(n => n.name === 'VRMHumanoidRig') // prettier-ignore
  for (const node of vrmHumanoidRigs) node.removeFromParent()
  // keep `secondary` (VRM0 spring bone container). Previously removed; needed for spring bones to function.
  // const secondaries = glb.scene.children.filter(n => n.name === 'secondary')
  // for (const node of secondaries) node.removeFromParent()
  // enable shadows
  glb.scene.traverse(obj => {
    if (obj.isMesh) {
      obj.castShadow = true
      obj.receiveShadow = true
    }
  })
  // calculate root to hips
  const bones = glb.userData.vrm.humanoid._rawHumanBones.humanBones
  const hipsPosition = v1.setFromMatrixPosition(bones.hips.node.matrixWorld)
  const rootPosition = v2.set(0, 0, 0) //setFromMatrixPosition(bones.root.node.matrixWorld)
  const rootToHips = hipsPosition.y - rootPosition.y
  // get vrm version
  const version = glb.userData.vrm.meta?.metaVersion
  // convert skinned mesh to detached bind mode
  // this lets us remove root bone from scene and then only perform matrix updates on the whole skeleton
  // when we actually need to  for massive performance
  const skinnedMeshes = []
  glb.scene.traverse(node => {
    if (node.isSkinnedMesh) {
      node.bindMode = THREE.DetachedBindMode
      node.bindMatrix.copy(node.matrixWorld)
      node.bindMatrixInverse.copy(node.bindMatrix).invert()
      skinnedMeshes.push(node)
    }
    if (node.isMesh) {
      // bounds tree
      node.geometry.computeBoundsTree()
      // fix csm shadow banding
      node.material.shadowSide = THREE.BackSide
      // csm material setup
      setupMaterial(node.material)
    }
  })
  // remove root bone from scene
  // const rootBone = glb.scene.getObjectByName('RootBone')
  // console.log({ rootBone })
  // rootBone.parent.remove(rootBone)
  // rootBone.updateMatrixWorld(true)

  const skeleton = skinnedMeshes[0].skeleton // should be same across all skinnedMeshes

  // pose arms down
  const normBones = glb.userData.vrm.humanoid._normalizedHumanBones.humanBones
  const leftArm = normBones.leftUpperArm.node
  leftArm.rotation.z = 75 * DEG2RAD
  const rightArm = normBones.rightUpperArm.node
  rightArm.rotation.z = -75 * DEG2RAD
  glb.userData.vrm.humanoid.update(0)
  skeleton.update()

  // get height
  let height = 0.5 // minimum
  for (const mesh of skinnedMeshes) {
    if (!mesh.boundingBox) mesh.computeBoundingBox()
    if (height < mesh.boundingBox.max.y) {
      height = mesh.boundingBox.max.y
    }
  }

  // this.headToEyes = this.eyePosition.clone().sub(headPos)
  const headPos = normBones.head.node.getWorldPosition(new THREE.Vector3())
  const headToHeight = height - headPos.y

  const getBoneName = vrmBoneName => {
    return glb.userData.vrm.humanoid.getRawBoneNode(vrmBoneName)?.name
  }

  const noop = () => {
    // ...
  }

  return {
    create,
    applyStats(stats) {
      glb.scene.traverse(obj => {
        if (obj.geometry && !stats.geometries.has(obj.geometry.uuid)) {
          stats.geometries.add(obj.geometry.uuid)
          stats.triangles += getTrianglesFromGeometry(obj.geometry)
        }
        if (obj.material && !stats.materials.has(obj.material.uuid)) {
          stats.materials.add(obj.material.uuid)
          stats.textureBytes += getTextureBytesFromMaterial(obj.material)
        }
      })
    },
  }

  function create(matrix, hooks, node) {
    const vrm = cloneGLB(glb)
    const tvrm = vrm.userData.vrm
    const skinnedMeshes = getSkinnedMeshes(vrm.scene)
    const skeleton = skinnedMeshes[0].skeleton // primary skeleton
    const cloneSkeletons = Array.from(new Set(skinnedMeshes.map(m => m.skeleton)))
    const rootBone = skeleton.bones[0] // should always be 0
    rootBone.parent.remove(rootBone)
    rootBone.updateMatrixWorld(true)
    vrm.scene.matrix = matrix // synced!
    vrm.scene.matrixWorld = matrix // synced!
    hooks.scene.add(vrm.scene)

    const getEntity = () => node?.ctx.entity

    // spatial capsule
    const cRadius = 0.3
    const sItem = {
      matrix,
      geometry: createCapsule(cRadius, height - cRadius * 2),
      material,
      getEntity,
    }
    hooks.octree?.insert(sItem)

    // link back entity for raycasts

    vrm.scene.traverse(o => {
      o.getEntity = getEntity
    })

    // i have no idea how but the mixer only needs one of the skinned meshes
    // and if i set it to vrm.scene it no longer works with detached bind mode
    const mixer = new THREE.AnimationMixer(skinnedMeshes[0])

    const bonesByName = {}
    const findBone = name => {
      // name is the official vrm bone name eg 'leftHand'
      // actualName is the actual bone name used in the skeleton which may different across vrms
      if (!bonesByName[name]) {
        const actualName = glb.userData.vrm.humanoid.getRawBoneNode(name)?.name
        bonesByName[name] = skeleton.getBoneByName(actualName)
      }
      return bonesByName[name]
    }

    const mt = new THREE.Matrix4()
    const getBoneTransform = boneName => {
      const bone = findBone(boneName)
      if (!bone) return null
      // combine the scene's world matrix with the bone's world matrix
      return mt.multiplyMatrices(vrm.scene.matrixWorld, bone.matrixWorld)
    }

    // expressions setup (blink + mouth/viseme)
    const origVRM = glb.userData.vrm
    try {
      const sm = origVRM?.springBoneManager
      console.log('[vrmFactory] spring manager:', !!sm, 'joints:', sm?.joints?.size ?? 0)
    } catch (_) { }
    const expressionManager = origVRM?.expressionManager || null
    // expressions from the cloned scene (fallback path if no manager)
    // expressions live on the top-level scene of the GLB, not the skinned subtree
    // when we cloned, `vrm.scene` is the cloned top-level scene, so look directly there
    const expressionsByName = (() => {
      const map = new Map()
      // expressions are added as direct children in the VRM loader
      for (const child of vrm.scene.children) {
        if (child && child.type === 'VRMExpression') {
          // cloning may drop the custom .expressionName; derive from .name if needed
          let exprName = child.expressionName
          if (!exprName && typeof child.name === 'string' && child.name.startsWith('VRMExpression_')) {
            exprName = child.name.substring('VRMExpression_'.length)
          }
          if (exprName) map.set(exprName, child)
        }
      }
      return map
    })()
    const expressionWeights = {
      blink: 0,
      blinkLeft: 0,
      blinkRight: 0,
      aa: 0,
      ee: 0,
      ih: 0,
      oh: 0,
      ou: 0,
    }
    const expressionsEnabled = !!expressionManager || expressionsByName.size > 0
    // map canonical names -> actual names present in this VRM
    const resolveName = (...candidates) => {
      // prefer manager lookup
      for (const c of candidates) {
        const v = expressionManager?.getValue?.(c)
        if (v !== null && v !== undefined) return c
      }
      // fallback to cloned expression nodes
      for (const c of candidates) {
        if (expressionsByName.has(c)) return c
      }
      return null
    }
    const nameMap = {
      blink: resolveName('blink', 'Blink', 'BLINK'),
      aa: resolveName('aa', 'A'),
      ee: resolveName('ee', 'E'),
      ih: resolveName('ih', 'I'),
      oh: resolveName('oh', 'O'),
      ou: resolveName('ou', 'U'),
    }
    let blinkingEnabled = true
    // blink state
    let blinkCooldown = 0
    let blinkPhase = 0 // 0 = idle, 1 = closing, 2 = opening
    let blinkTime = 0
    const BLINK_INTERVAL_MIN = 2.5
    const BLINK_INTERVAL_MAX = 5.0
    const BLINK_CLOSE_DURATION = 0.06
    const BLINK_OPEN_DURATION = 0.12
    function resetBlinkCooldown() {
      blinkCooldown = THREE.MathUtils.lerp(BLINK_INTERVAL_MIN, BLINK_INTERVAL_MAX, Math.random())
    }
    resetBlinkCooldown()
    // mouth/viseme state (driven when talking)
    const visemes = ['aa', 'ih', 'oh', 'ee', 'ou']
    let currentViseme = 'aa'
    let visemeTimer = 0
    let visemeSwitchInterval = 0.18 + Math.random() * 0.12 // 180-300ms
    let mouthTime = 0

    function setExpression(name, weight) {
      if (!expressionsEnabled) return
      if (expressionWeights[name] === undefined) return
      const clamped = THREE.MathUtils.clamp(weight, 0, 1)
      expressionWeights[name] = clamped
      const actual = nameMap[name] || name
      expressionManager?.setValue?.(actual, clamped)
    }

    function clearMouth() {
      setExpression('aa', 0)
      setExpression('ee', 0)
      setExpression('ih', 0)
      setExpression('oh', 0)
      setExpression('ou', 0)
    }

    function updateBlink(delta) {
      if (!expressionsEnabled || !blinkingEnabled) return
      if (blinkPhase === 0) {
        blinkCooldown -= delta
        if (blinkCooldown <= 0) {
          blinkPhase = 1
          blinkTime = 0
        }
      }
      if (blinkPhase === 1) {
        blinkTime += delta
        const t = THREE.MathUtils.clamp(blinkTime / BLINK_CLOSE_DURATION, 0, 1)
        const w = t // linear close
        setExpression('blink', w)
        if (t >= 1) {
          blinkPhase = 2
          blinkTime = 0
        }
      } else if (blinkPhase === 2) {
        blinkTime += delta
        const t = THREE.MathUtils.clamp(blinkTime / BLINK_OPEN_DURATION, 0, 1)
        const w = 1 - t // open back to 0
        setExpression('blink', w)
        if (t >= 1) {
          blinkPhase = 0
          resetBlinkCooldown()
        }
      }
    }

    function updateMouth(delta, isTalking) {
      if (!expressionsEnabled) return
      if (!isTalking) {
        clearMouth()
        return
      }
      mouthTime += delta
      visemeTimer += delta
      if (visemeTimer >= visemeSwitchInterval) {
        visemeTimer = 0
        visemeSwitchInterval = 0.18 + Math.random() * 0.12
        currentViseme = visemes[(Math.random() * visemes.length) | 0]
      }
      // simple oscillation for mouth opening while speaking
      const oscillation = (Math.sin(mouthTime * 12 + Math.random() * 0.5) + 1) * 0.5 // 0..1
      const weight = 0.4 + 0.6 * oscillation
      clearMouth()
      setExpression(currentViseme, weight)
    }

    const loco = {
      mode: Modes.IDLE,
      axis: new THREE.Vector3(),
      gazeDir: null,
    }
    const setLocomotion = (mode, axis, gazeDir) => {
      loco.mode = mode
      loco.axis = axis
      loco.gazeDir = gazeDir
    }

    // speaking state (drives mouth and optional talk overlay)
    let talking = false
    const setSpeaking = value => {
      talking = !!value
    }

    // world.updater.add(update)
    const emotes = {
      // [url]: {
      //   url: String
      //   loading: Boolean
      //   action: AnimationAction
      // }
    }
    let currentEmote
    // auto-clear currentEmote when a non-looping emote finishes
    mixer.addEventListener('finished', e => {
      if (!currentEmote) return
      if (e?.action === currentEmote.action) {
        if (!currentEmote.loop) {
          try { currentEmote.action?.fadeOut?.(0.15) } catch (_) { }
          currentEmote = null
        }
      }
    })
    const setEmote = url => {
      if (currentEmote?.url === url) return
      if (currentEmote) {
        currentEmote.action?.fadeOut(0.15)
        currentEmote = null
      }
      if (!url) return
      const opts = getQueryParams(url)
      const loop = opts.l !== '0'
      const speed = parseFloat(opts.s || 1)
      const gaze = opts.g == '1'

      if (emotes[url]) {
        currentEmote = emotes[url]
        if (currentEmote.action) {
          currentEmote.loop = loop
          currentEmote.action.clampWhenFinished = !loop
          currentEmote.action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce)
          currentEmote.action.reset().fadeIn(0.15).play()
          clearLocomotion()
        }
      } else {
        const emote = {
          url,
          loading: true,
          action: null,
          gaze,
          loop,
        }
        emotes[url] = emote
        currentEmote = emote
        hooks.loader.load('emote', url).then(emo => {
          const clip = emo.toClip({
            rootToHips,
            version,
            getBoneName,
          })
          const action = mixer.clipAction(clip)
          action.timeScale = speed
          emote.action = action
          // if its still this emote, play it!
          if (currentEmote === emote) {
            action.clampWhenFinished = !loop
            action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce)
            action.play()
            clearLocomotion()
          }
        })
      }
    }

    // IDEA: we should use a global frame "budget" to distribute across avatars
    // https://chatgpt.com/c/4bbd469d-982e-4987-ad30-97e9c5ee6729

    let elapsed = 0
    let rate = 0
    let rateCheck = true
    let distance

    const updateRate = () => {
      const vrmPos = v1.setFromMatrixPosition(vrm.scene.matrix)
      const camPos = v2.setFromMatrixPosition(hooks.camera.matrixWorld) // prettier-ignore
      distance = vrmPos.distanceTo(camPos)
      const clampedDistance = Math.max(distance - DIST_MIN, 0)
      const normalizedDistance = Math.min(clampedDistance / (DIST_MAX - DIST_MIN), 1) // prettier-ignore
      rate = DIST_MAX_RATE + normalizedDistance * (DIST_MIN_RATE - DIST_MAX_RATE) // prettier-ignore
      // console.log('distance', distance)
      // console.log('rate per second', 1 / rate)
    }

    // build morph mirroring map (original -> clone) once
    let morphMirrorInit = false
    const morphPairs = []
    function initMorphMirror() {
      if (morphMirrorInit) return
      if (!origVRM?.scene) return
      const src = []
      const dst = []
      origVRM.scene.traverse(o => {
        if (o.isSkinnedMesh && o.morphTargetInfluences) src.push(o)
      })
      vrm.scene.traverse(o => {
        if (o.isSkinnedMesh && o.morphTargetInfluences) dst.push(o)
      })
      for (let i = 0; i < src.length; i++) {
        const s = src[i]
        const d = dst.find(x => x.name === s.name) || dst[i]
        if (d) morphPairs.push([s, d])
      }
      morphMirrorInit = true
    }

    // spring bone mirroring (original -> clone) and drive original with clone pose
    let springMirrorInit = false
    let hasSprings = false
    const springPairs = []
    const drivePairs = []
    function initSpringMirror() {
      if (springMirrorInit) return
      const spring = origVRM?.springBoneManager
      if (!spring) {
        springMirrorInit = true
        return
      }
      try {
        hasSprings = spring.joints && spring.joints.size > 0
        // optional global tuning (neutral by default; use hooks.springTuning to tweak)
        const tuning = hooks.springTuning || { stiffness: 1.0, dragForce: 1.0, gravityPower: 1.0, hitRadius: 1.0 }
        try {
          spring.joints.forEach(joint => {
            const s = joint.settings
            if (!s) return
            if (tuning.stiffness != null) s.stiffness *= tuning.stiffness
            if (tuning.dragForce != null) s.dragForce *= tuning.dragForce
            if (tuning.gravityPower != null) s.gravityPower *= tuning.gravityPower
            if (tuning.hitRadius != null) s.hitRadius *= tuning.hitRadius
            // Only disable colliders if explicitly requested
            if (hooks.disableSpringColliders === true) {
              joint.colliderGroups = []
            }
          })
        } catch (_) { }
        // re-init after tuning/collider changes so initial state is consistent
        try { spring.setInitState() } catch (_) { }
        // build spring joint pairs (orig -> clone) using clone skeleton lookup by name
        spring.joints.forEach(joint => {
          const src = joint.bone
          if (!src || !src.name) return
          let dst = skeleton.getBoneByName(src.name)
          if (dst) springPairs.push([src, dst])
        })
        // build drive pairs (clone skeleton -> original bones) for joint ancestors
        const origMeshes = []
        glb.scene.traverse(o => { if (o.isSkinnedMesh && o.skeleton) origMeshes.push(o) })
        const origSkeleton = origMeshes[0]?.skeleton
        const addDrivePair = (origObj) => {
          if (!origObj || !origObj.name) return
          const cloneBone = skeleton.getBoneByName(origObj.name)
          if (cloneBone) drivePairs.push([cloneBone, origObj])
        }
        spring.joints.forEach(joint => {
          let p = joint.bone
          while (p && p !== glb.scene) {
            addDrivePair(p)
            p = p.parent
          }
        })
        // targeted alias mapping to help common hair/tail chains and path-based fallback
        const alias = new Map([
          ['Hair1', ['hair1', 'hair_1', 'Hair_1']],
          ['Hair2', ['hair2', 'hair_2', 'Hair_2']],
          ['Tail', ['tail', 'Tail_1', 'tail_1']],
        ])
        // rebuild springPairs using alias + path fallback for better coverage
        springPairs.length = 0
        spring.joints.forEach(joint => {
          const src = joint.bone
          if (!src || !src.name) return
          let dst = skeleton.getBoneByName(src.name)
          if (!dst) {
            for (const [key, alts] of alias.entries()) {
              if (src.name.toLowerCase().startsWith(key.toLowerCase())) {
                for (const a of alts) {
                  dst = skeleton.getBoneByName(a)
                  if (dst) break
                }
                if (dst) break
              }
            }
          }
          if (!dst) {
            // path fallback
            const path = []
            let n = src
            while (n && n !== glb.scene) {
              const p = n.parent
              if (!p) break
              const i = p.children.indexOf(n)
              if (i < 0) break
              path.push(i)
              n = p
            }
            if (n === glb.scene) {
              path.reverse()
              let m = vrm.scene
              for (const i of path) {
                m = m.children?.[i]
                if (!m) break
              }
              if (m && m.isBone) dst = m
            }
          }
          if (dst) springPairs.push([src, dst])
        })
        // re-initialize springs after mapping (safe if already initialized)
        try {
          spring.setInitState()
        } catch (_) { }
        console.log('[vrmFactory] spring mapping counts', 'springs:', spring.joints.size, 'pairs:', springPairs.length, 'drive:', drivePairs.length)
      } catch (_) {
        // ignore
      }
      springMirrorInit = true
    }

    const update = delta => {
      elapsed += delta
      // If the avatar has springs, always animate every frame for consistent driving
      const doAnim = hasSprings ? true : (rateCheck ? elapsed >= rate : true)
      if (doAnim) {
        mixer.update(hasSprings ? delta : elapsed)
        skeleton.bones.forEach(bone => bone.updateMatrixWorld())
        skeleton.update = THREE.Skeleton.prototype.update
        if (!currentEmote) {
          updateLocomotion(delta)
        }
        // facial expressions per frame
        if (expressionsEnabled) {
          updateBlink(elapsed)
          updateMouth(elapsed, talking)
          if (expressionManager) {
            // push values to manager and update
            for (const [canon, weight] of Object.entries(expressionWeights)) {
              const actual = nameMap[canon] || canon
              expressionManager.setValue(actual, weight)
            }
            expressionManager.update()
            // mirror morph target influences from original to clone
            if (!morphMirrorInit) initMorphMirror()
            for (const [s, d] of morphPairs) {
              const a = s.morphTargetInfluences
              const b = d.morphTargetInfluences
              if (!a || !b) continue
              const len = Math.min(a.length, b.length)
              for (let j = 0; j < len; j++) b[j] = a[j]
            }
          } else {
            // fallback: apply directly to cloned VRMExpression nodes
            expressionsByName.forEach(expr => expr.clearAppliedWeight())
            for (const [canon, weight] of Object.entries(expressionWeights)) {
              const actual = nameMap[canon] || canon
              const expr = expressionsByName.get(actual)
              if (!expr) continue
              expr.weight = weight
              if (weight > 0) expr.applyWeight({ multiplier: 1.0 })
            }
          }
        }

        // spring bones will also be stepped below every frame (not rate-limited)

        if (loco.gazeDir && distance < MAX_GAZE_DISTANCE && (currentEmote ? currentEmote.gaze : true)) {
          // aimBone('chest', loco.gazeDir, delta, {
          //   minAngle: -90,
          //   maxAngle: 90,
          //   smoothing: 0.7,
          //   weight: 0.7,
          // })
          aimBone('neck', loco.gazeDir, delta, {
            minAngle: -30,
            maxAngle: 30,
            smoothing: 0.4,
            weight: 0.6,
          })
          aimBone('head', loco.gazeDir, delta, {
            minAngle: -30,
            maxAngle: 30,
            smoothing: 0.4,
            weight: 0.6,
          })
        }
        // tvrm.humanoid.update(delta)
        elapsed = 0
      } else {
        skeleton.update = noop
      }

      // spring bones per frame (not rate-limited): drive orig with clone pose, simulate, mirror back
      if (!springMirrorInit) initSpringMirror()
      if (origVRM && (springPairs.length || drivePairs.length)) {
        const _pos = new THREE.Vector3()
        const _quat = new THREE.Quaternion()
        const _scl = new THREE.Vector3()
        vrm.scene.matrix.decompose(_pos, _quat, _scl)
        origVRM.scene.position.copy(_pos)
        origVRM.scene.quaternion.copy(_quat)
        origVRM.scene.scale.copy(_scl)
        origVRM.scene.updateMatrixWorld(true)
        // copy clone bone rotations into original skeleton so springs have correct inputs
        for (const [cloneBone, origBone] of drivePairs) {
          if (origBone && cloneBone) {
            // many VRM spring bones have matrixAutoUpdate=false; force local matrix rebuild
            origBone.quaternion.copy(cloneBone.quaternion)
            origBone.updateMatrix()
            origBone.updateMatrixWorld(true)
          }
        }
        // advance VRM systems (includes node constraints + spring bones)
        origVRM.update(delta)
        // mirror spring joints back to clone only
        for (const [src, dst] of springPairs) {
          if (dst) {
            dst.quaternion.copy(src.quaternion)
            dst.updateMatrix()
            dst.updateMatrixWorld(true)
          }
        }
        // ensure skinned mesh bone matrices reflect new spring rotations
        for (const m of skinnedMeshes) {
          THREE.Skeleton.prototype.update.call(m.skeleton)
        }
      }
    }

    const aimBone = (() => {
      const smoothedRotations = new Map()
      const normalizedDir = new THREE.Vector3()
      const parentWorldMatrix = new THREE.Matrix4()
      const parentWorldRotationInverse = new THREE.Quaternion()
      const localDir = new THREE.Vector3()
      const currentAimDir = new THREE.Vector3()
      const rot = new THREE.Quaternion()
      const worldUp = new THREE.Vector3()
      const localUp = new THREE.Vector3()
      const rotatedUp = new THREE.Vector3()
      const projectedUp = new THREE.Vector3()
      const upCorrection = new THREE.Quaternion()
      const cross = new THREE.Vector3()
      const targetRotation = new THREE.Quaternion()
      const restToTarget = new THREE.Quaternion()

      return function aimBone(boneName, targetDir, delta, options = {}) {
        // default options
        const {
          aimAxis = AimAxis.NEG_Z,
          upAxis = UpAxis.Y,
          smoothing = 0.7, // smoothing factor (0-1)
          weight = 1.0,
          maintainOffset = false,
          minAngle = -180,
          maxAngle = 180,
        } = options
        const bone = findBone(boneName)
        const parentBone = glb.userData.vrm.humanoid.humanBones[boneName].node.parent
        if (!bone) return console.warn(`aimBone: missing bone (${boneName})`)
        if (!parentBone) return console.warn(`aimBone: no parent bone`)
        // get or create smoothed state for this bone
        const boneId = bone.uuid
        if (!smoothedRotations.has(boneId)) {
          smoothedRotations.set(boneId, {
            current: bone.quaternion.clone(),
            target: new THREE.Quaternion(),
          })
        }
        const smoothState = smoothedRotations.get(boneId)
        // normalize target direction
        normalizedDir.copy(targetDir).normalize()
        // get parent's world matrix
        parentWorldMatrix.multiplyMatrices(vrm.scene.matrixWorld, parentBone.matrixWorld)
        // extract parent's world rotation
        parentWorldMatrix.decompose(v1, parentWorldRotationInverse, v2)
        parentWorldRotationInverse.invert()
        // convert world direction to parent's local space
        localDir.copy(normalizedDir).applyQuaternion(parentWorldRotationInverse)
        // store initial offset if needed
        if (maintainOffset && !bone.userData.initialRotationOffset) {
          bone.userData.initialRotationOffset = bone.quaternion.clone()
        }
        // calc rotation needed to align aimAxis with localDir
        currentAimDir.copy(aimAxis)
        if (maintainOffset && bone.userData.initialRotationOffset) {
          currentAimDir.applyQuaternion(bone.userData.initialRotationOffset)
        }
        // create rotation
        rot.setFromUnitVectors(aimAxis, localDir)
        // get up direction in parent's local space
        worldUp.copy(upAxis)
        localUp.copy(worldUp).applyQuaternion(parentWorldRotationInverse)
        // apply up axis correction
        rotatedUp.copy(upAxis).applyQuaternion(rot)
        projectedUp.copy(localUp)
        projectedUp.sub(v1.copy(localDir).multiplyScalar(localDir.dot(localUp)))
        projectedUp.normalize()
        if (projectedUp.lengthSq() > 0.001) {
          upCorrection.setFromUnitVectors(rotatedUp, projectedUp)
          const angle = rotatedUp.angleTo(projectedUp)
          cross.crossVectors(rotatedUp, projectedUp)
          if (cross.dot(localDir) < 0) {
            upCorrection.setFromAxisAngle(localDir, -angle)
          } else {
            upCorrection.setFromAxisAngle(localDir, angle)
          }
          rot.premultiply(upCorrection)
        }
        // apply initial offset if maintaining it
        targetRotation.copy(rot)
        if (maintainOffset && bone.userData.initialRotationOffset) {
          targetRotation.multiply(bone.userData.initialRotationOffset)
        }
        // apply angle limits
        if (minAngle > -180 || maxAngle < 180) {
          if (!bone.userData.restRotation) {
            bone.userData.restRotation = bone.quaternion.clone()
          }
          restToTarget.copy(bone.userData.restRotation).invert().multiply(targetRotation)
          const w = restToTarget.w
          const angle = 2 * Math.acos(Math.min(Math.max(w, -1), 1))
          const angleDeg = THREE.MathUtils.radToDeg(angle)
          if (angleDeg > maxAngle || angleDeg < minAngle) {
            const clampedAngleDeg = THREE.MathUtils.clamp(angleDeg, minAngle, maxAngle)
            const clampedAngleRad = THREE.MathUtils.degToRad(clampedAngleDeg)
            const scale = clampedAngleRad / angle
            q1.copy(targetRotation)
            targetRotation.slerpQuaternions(bone.userData.restRotation, q1, scale)
          }
        }
        // apply weight
        if (weight < 1.0) {
          targetRotation.slerp(bone.quaternion, 1.0 - weight)
        }
        // update smooth state target
        smoothState.target.copy(targetRotation)
        // smoothly interpolate from current to target
        smoothState.current.slerp(smoothState.target, smoothing)
        // apply smoothed rotation to bone
        bone.quaternion.copy(smoothState.current)
        bone.updateMatrixWorld(true)
      }
    })()

    // position target equivalent of aimBone()
    const aimBoneDir = new THREE.Vector3()
    function aimBoneAt(boneName, targetPos, delta, options = {}) {
      const bone = findBone(boneName)
      if (!bone) return console.warn(`aimBone: missing bone (${boneName})`)
      const boneWorldMatrix = getBoneTransform(boneName)
      const boneWorldPos = v1.setFromMatrixPosition(boneWorldMatrix)
      aimBoneDir.subVectors(targetPos, boneWorldPos).normalize()
      aimBone(boneName, aimBoneDir, delta, options)
    }

    const poses = {}
    function addPose(key, url) {
      const opts = getQueryParams(url)
      const speed = parseFloat(opts.s || 1)
      const pose = {
        loading: true,
        active: false,
        action: null,
        weight: 0,
        target: 0,
        setWeight: value => {
          pose.weight = value
          if (pose.action) {
            pose.action.weight = value
            if (!pose.active) {
              pose.action.reset().fadeIn(0.15).play()
              pose.active = true
            }
          }
        },
        fadeOut: () => {
          pose.weight = 0
          pose.action?.fadeOut(0.15)
          pose.active = false
        },
      }
      hooks.loader.load('emote', url).then(emo => {
        const clip = emo.toClip({
          rootToHips,
          version,
          getBoneName,
        })
        pose.action = mixer.clipAction(clip)
        pose.action.timeScale = speed
        pose.action.weight = pose.weight
        pose.action.play()
      })
      poses[key] = pose
    }
    addPose('idle', Emotes.IDLE)
    addPose('walk', Emotes.WALK)
    addPose('walkLeft', Emotes.WALK_LEFT)
    addPose('walkBack', Emotes.WALK_BACK)
    addPose('walkRight', Emotes.WALK_RIGHT)
    addPose('run', Emotes.RUN)
    addPose('runLeft', Emotes.RUN_LEFT)
    addPose('runBack', Emotes.RUN_BACK)
    addPose('runRight', Emotes.RUN_RIGHT)
    addPose('jump', Emotes.JUMP)
    addPose('fall', Emotes.FALL)
    addPose('fly', Emotes.FLY)
    addPose('talk', Emotes.TALK)
    function clearLocomotion() {
      for (const key in poses) {
        poses[key].fadeOut()
      }
    }
    function updateLocomotion(delta) {
      const { mode, axis } = loco
      for (const key in poses) {
        poses[key].target = 0
      }
      if (mode === Modes.IDLE) {
        poses.idle.target = 1
      } else if (mode === Modes.WALK || mode === Modes.RUN) {
        const angle = Math.atan2(axis.x, -axis.z)
        const angleDeg = ((angle * 180) / Math.PI + 360) % 360
        const prefix = mode === Modes.RUN ? 'run' : 'walk'
        const forwardKey = prefix // This should be "walk" or "run"
        const leftKey = `${prefix}Left`
        const backKey = `${prefix}Back`
        const rightKey = `${prefix}Right`
        if (axis.length() > 0.01) {
          if (angleDeg >= 337.5 || angleDeg < 22.5) {
            // Pure forward
            poses[forwardKey].target = 1
          } else if (angleDeg >= 22.5 && angleDeg < 67.5) {
            // Forward-right blend
            const blend = (angleDeg - 22.5) / 45
            poses[forwardKey].target = 1 - blend
            poses[rightKey].target = blend
          } else if (angleDeg >= 67.5 && angleDeg < 112.5) {
            // Pure right
            poses[rightKey].target = 1
          } else if (angleDeg >= 112.5 && angleDeg < 157.5) {
            // Right-back blend
            const blend = (angleDeg - 112.5) / 45
            poses[rightKey].target = 1 - blend
            poses[backKey].target = blend
          } else if (angleDeg >= 157.5 && angleDeg < 202.5) {
            // Pure back
            poses[backKey].target = 1
          } else if (angleDeg >= 202.5 && angleDeg < 247.5) {
            // Back-left blend
            const blend = (angleDeg - 202.5) / 45
            poses[backKey].target = 1 - blend
            poses[leftKey].target = blend
          } else if (angleDeg >= 247.5 && angleDeg < 292.5) {
            // Pure left
            poses[leftKey].target = 1
          } else if (angleDeg >= 292.5 && angleDeg < 337.5) {
            // Left-forward blend
            const blend = (angleDeg - 292.5) / 45
            poses[leftKey].target = 1 - blend
            poses[forwardKey].target = blend
          }
        }
      } else if (mode === Modes.JUMP) {
        poses.jump.target = 1
      } else if (mode === Modes.FALL) {
        poses.fall.target = 1
      } else if (mode === Modes.FLY) {
        poses.fly.target = 1
      } else if (mode === Modes.TALK) {
        poses.talk.target = 1
      } else if (mode === Modes.FLIP) {
        // play the dedicated flip emote; locomotion poses will be cleared by setEmote
        setEmote(Emotes.FLIP)
      }
      const lerpSpeed = 16
      for (const key in poses) {
        const pose = poses[key]
        const weight = THREE.MathUtils.lerp(pose.weight, pose.target, 1 - Math.exp(-lerpSpeed * delta))
        pose.setWeight(weight)
      }
    }

    let firstPersonActive = false
    const setFirstPerson = active => {
      if (firstPersonActive === active) return
      const head = findBone('neck')
      head.scale.setScalar(active ? 0 : 1)
      firstPersonActive = active
    }

    return {
      raw: vrm,
      height,
      headToHeight,
      setEmote,
      setSpeaking,
      // expression controls
      setExpression,
      setBlinkEnabled(active) {
        blinkingEnabled = !!active
      },
      setFirstPerson,
      update,
      updateRate,
      getBoneTransform,
      setLocomotion,
      setVisible(visible) {
        vrm.scene.traverse(o => {
          o.visible = visible
        })
      },
      move(_matrix) {
        matrix.copy(_matrix)
        hooks.octree?.move(sItem)
      },
      disableRateCheck() {
        rateCheck = false
      },
      destroy() {
        hooks.scene.remove(vrm.scene)
        // world.updater.remove(update)
        hooks.octree?.remove(sItem)
      },
    }
  }
}

function cloneGLB(glb) {
  // returns a shallow clone of the gltf but a deep clone of the scene.
  // uses SkeletonUtils.clone which is the same as Object3D.clone except also clones skinned meshes etc
  return { ...glb, scene: SkeletonUtils.clone(glb.scene) }
}

function getSkinnedMeshes(scene) {
  let meshes = []
  scene.traverse(o => {
    if (o.isSkinnedMesh) {
      meshes.push(o)
    }
  })
  return meshes
}

function createCapsule(radius, height) {
  const fullHeight = radius + height + radius
  const geometry = new THREE.CapsuleGeometry(radius, height)
  geometry.translate(0, fullHeight / 2, 0)
  return geometry
}

let queryParams = {}
function getQueryParams(url) {
  if (!queryParams[url]) {
    url = new URL(url)
    const params = {}
    for (const [key, value] of url.searchParams.entries()) {
      params[key] = value
    }
    queryParams[url] = params
  }
  return queryParams[url]
}