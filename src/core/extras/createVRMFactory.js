import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

import * as THREE from './three'
import { DEG2RAD } from './general'
import { getTrianglesFromGeometry } from './getTrianglesFromGeometry'
import { getTextureBytesFromMaterial } from './getTextureBytesFromMaterial'

const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()

const DIST_CHECK_RATE = 1 // once every second
const DIST_MIN_RATE = 1 / 5 // 3 times per second
const DIST_MAX_RATE = 1 / 25 // 25 times per second
const DIST_MIN = 30 // <= 15m = min rate
const DIST_MAX = 60 // >= 30m = max rate

const material = new THREE.MeshBasicMaterial()

export function createVRMFactory(glb, setupMaterial) {
  // we'll update matrix ourselves
  glb.scene.matrixAutoUpdate = false
  glb.scene.matrixWorldAutoUpdate = false
  // remove expressions from scene
  const expressions = glb.scene.children.filter(n => n.type === 'VRMExpression') // prettier-ignore
  for (const node of expressions) node.removeFromParent()
  // remove VRMHumanoidRig
  const vrmHumanoidRigs = glb.scene.children.filter(n => n.name === 'VRMHumanoidRig') // prettier-ignore
  for (const node of vrmHumanoidRigs) node.removeFromParent()
  // remove secondary
  const secondaries = glb.scene.children.filter(n => n.name === 'secondary') // prettier-ignore
  for (const node of secondaries) node.removeFromParent()
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
    const skeleton = skinnedMeshes[0].skeleton // should be same across all skinnedMeshes
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

    // debug capsule
    // const foo = new THREE.Mesh(
    //   sItem.geometry,
    //   new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5 })
    // )
    // vrm.scene.add(foo)

    // link back entity for raycasts

    vrm.scene.traverse(o => {
      o.getEntity = getEntity
    })

    // i have no idea how but the mixer only needs one of the skinned meshes
    // and if i set it to vrm.scene it no longer works with detached bind mode
    const mixer = new THREE.AnimationMixer(skinnedMeshes[0])

    // IDEA: we should use a global frame "budget" to distribute across avatars
    // https://chatgpt.com/c/4bbd469d-982e-4987-ad30-97e9c5ee6729

    let elapsed = 0
    let rate = 0
    let rateCheckedAt = 999
    let rateCheck = true
    const update = delta => {
      elapsed += delta
      let should = true
      if (rateCheck) {
        // periodically calculate update rate based on distance to camera
        rateCheckedAt += delta
        if (rateCheckedAt >= DIST_CHECK_RATE) {
          const vrmPos = v1.setFromMatrixPosition(vrm.scene.matrix)
          const camPos = v2.setFromMatrixPosition(hooks.camera.matrixWorld) // prettier-ignore
          const distance = vrmPos.distanceTo(camPos)
          const clampedDistance = Math.max(distance - DIST_MIN, 0)
          const normalizedDistance = Math.min(clampedDistance / (DIST_MAX - DIST_MIN), 1) // prettier-ignore
          rate = DIST_MAX_RATE + normalizedDistance * (DIST_MIN_RATE - DIST_MAX_RATE) // prettier-ignore
          // console.log('distance', distance)
          // console.log('rate per second', 1 / rate)
          rateCheckedAt = 0
        }
        should = elapsed >= rate
      }
      if (should) {
        mixer.update(elapsed)
        skeleton.bones.forEach(bone => bone.updateMatrixWorld())
        skeleton.update = THREE.Skeleton.prototype.update
        // tvrm.humanoid.update(elapsed)
        elapsed = 0
      } else {
        skeleton.update = noop
      }
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

      if (emotes[url]) {
        currentEmote = emotes[url]
        if (currentEmote.action) {
          currentEmote.action.clampWhenFinished = !loop
          currentEmote.action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce)
          currentEmote.action.reset().fadeIn(0.15).play()
        }
      } else {
        const emote = {
          url,
          loading: true,
          action: null,
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
          }
        })
      }
    }

    // console.log('=== vrm ===')
    // console.log('vrm', vrm)
    // console.log('skeleton', skeleton)

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

    let firstPersonActive = false
    const setFirstPerson = active => {
      if (firstPersonActive === active) return
      const head = findBone('neck')
      head.scale.setScalar(active ? 0 : 1)
      firstPersonActive = active
    }

    const m1 = new THREE.Matrix4()
    const getBoneTransform = boneName => {
      const bone = findBone(boneName)
      if (!bone) return null
      // combine the scene's world matrix with the bone's world matrix
      return m1.multiplyMatrices(vrm.scene.matrixWorld, bone.matrixWorld)
    }

    return {
      raw: vrm,
      height,
      headToHeight,
      setEmote,
      setFirstPerson,
      update,
      getBoneTransform,
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
