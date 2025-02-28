import * as THREE from 'three'

const q1 = new THREE.Quaternion()
const restRotationInverse = new THREE.Quaternion()
const parentRestWorldRotation = new THREE.Quaternion()

export function createEmoteFactory(glb, url) {
  // console.time('emote-init')

  const clip = glb.animations[0]

  const scale = glb.scene.children[0].scale.x // armature should be here?

  // no matter what vrm/emote combo we use for some reason avatars
  // levitate roughly 5cm above ground. this is a hack but it works.
  const yOffset = -0.05 / scale

  // we only keep tracks that are:
  // 1. the root position
  // 2. the quaternions
  // scale and other positions are rejected.
  // NOTE: there is a risk that the first position track is not the root but
  // i haven't been able to find one so far.
  let haveRoot

  clip.tracks = clip.tracks.filter(track => {
    if (track instanceof THREE.VectorKeyframeTrack) {
      const [name, type] = track.name.split('.')
      if (type !== 'position') return
      // we need both root and hip bones
      if (name === 'Root') {
        haveRoot = true
        return true
      }
      if (name === 'mixamorigHips') {
        return true
      }
      return false
    }
    return true
  })

  // if (!haveRoot) console.warn(`emote missing root bone: ${url}`)

  // fix new mixamo update normalized bones
  // see: https://github.com/pixiv/three-vrm/pull/1032/files
  clip.tracks.forEach(track => {
    const trackSplitted = track.name.split('.')
    const mixamoRigName = trackSplitted[0]
    const mixamoRigNode = glb.scene.getObjectByName(mixamoRigName)
    mixamoRigNode.getWorldQuaternion(restRotationInverse).invert()
    mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation)
    if (track instanceof THREE.QuaternionKeyframeTrack) {
      // Retarget rotation of mixamoRig to NormalizedBone.
      for (let i = 0; i < track.values.length; i += 4) {
        const flatQuaternion = track.values.slice(i, i + 4)
        q1.fromArray(flatQuaternion)
        // 親のレスト時ワールド回転 * トラックの回転 * レスト時ワールド回転の逆
        q1.premultiply(parentRestWorldRotation).multiply(restRotationInverse)
        q1.toArray(flatQuaternion)
        flatQuaternion.forEach((v, index) => {
          track.values[index + i] = v
        })
      }
    } else if (track instanceof THREE.VectorKeyframeTrack) {
      if (yOffset) {
        track.values = track.values.map((v, i) => {
          // if this is Y then offset it
          if (i % 3 === 1) {
            // console.log(v, v + yOffset)
            return v + yOffset
          }
          return v
        })
      }
    }
  })

  clip.optimize()

  // console.timeEnd('emote-init')
  // console.log(clip)

  return {
    toClip({ rootToHips, version, getBoneName }) {
      // we're going to resize animation to match vrm height
      const height = rootToHips

      const tracks = []

      clip.tracks.forEach(track => {
        const trackSplitted = track.name.split('.')
        const ogBoneName = trackSplitted[0]
        const vrmBoneName = normalizedBoneNames[ogBoneName]
        // TODO: use vrm.bones[name] not getBoneNode
        const vrmNodeName = getBoneName(vrmBoneName)

        // console.log('----')
        // console.log('trackSplitted', trackSplitted)
        // console.log('mixamoRigName', mixamoRigName)
        // console.log('vrmBoneName', vrmBoneName)
        // console.log('vrmNodeName', vrmNodeName)
        // console.log('----')

        // animations come from mixamo X Bot character
        // and we scale based on height of our VRM.
        // usually this would 0.01 if our VRM was for example the X Bot
        // but since we're applying this to any arbitrary sized VRM we
        // need to scale it by height too.
        // i found that feet-to-hips height scales animations almost perfectly
        // and ensures feet stay on the ground
        const scaler = height * scale

        if (vrmNodeName !== undefined) {
          const propertyName = trackSplitted[1]

          if (track instanceof THREE.QuaternionKeyframeTrack) {
            tracks.push(
              new THREE.QuaternionKeyframeTrack(
                `${vrmNodeName}.${propertyName}`,
                track.times,
                track.values.map((v, i) => (version === '0' && i % 2 === 0 ? -v : v))
              )
            )
          } else if (track instanceof THREE.VectorKeyframeTrack) {
            tracks.push(
              new THREE.VectorKeyframeTrack(
                `${vrmNodeName}.${propertyName}`,
                track.times,
                track.values.map((v, i) => {
                  return (version === '0' && i % 3 !== 1 ? -v : v) * scaler
                })
              )
            )
          }
        }
      })

      return new THREE.AnimationClip(
        clip.name, // todo: name variable?
        clip.duration,
        tracks
      )
    },
  }
}

const normalizedBoneNames = {
  // vrm standard
  hips: 'hips',
  spine: 'spine',
  chest: 'chest',
  upperChest: 'upperChest',
  neck: 'neck',
  head: 'head',
  leftShoulder: 'leftShoulder',
  leftUpperArm: 'leftUpperArm',
  leftLowerArm: 'leftLowerArm',
  leftHand: 'leftHand',
  leftThumbProximal: 'leftThumbProximal',
  leftThumbIntermediate: 'leftThumbIntermediate',
  leftThumbDistal: 'leftThumbDistal',
  leftIndexProximal: 'leftIndexProximal',
  leftIndexIntermediate: 'leftIndexIntermediate',
  leftIndexDistal: 'leftIndexDistal',
  leftMiddleProximal: 'leftMiddleProximal',
  leftMiddleIntermediate: 'leftMiddleIntermediate',
  leftMiddleDistal: 'leftMiddleDistal',
  leftRingProximal: 'leftRingProximal',
  leftRingIntermediate: 'leftRingIntermediate',
  leftRingDistal: 'leftRingDistal',
  leftLittleProximal: 'leftLittleProximal',
  leftLittleIntermediate: 'leftLittleIntermediate',
  leftLittleDistal: 'leftLittleDistal',
  rightShoulder: 'rightShoulder',
  rightUpperArm: 'rightUpperArm',
  rightLowerArm: 'rightLowerArm',
  rightHand: 'rightHand',
  rightLittleProximal: 'rightLittleProximal',
  rightLittleIntermediate: 'rightLittleIntermediate',
  rightLittleDistal: 'rightLittleDistal',
  rightRingProximal: 'rightRingProximal',
  rightRingIntermediate: 'rightRingIntermediate',
  rightRingDistal: 'rightRingDistal',
  rightMiddleProximal: 'rightMiddleProximal',
  rightMiddleIntermediate: 'rightMiddleIntermediate',
  rightMiddleDistal: 'rightMiddleDistal',
  rightIndexProximal: 'rightIndexProximal',
  rightIndexIntermediate: 'rightIndexIntermediate',
  rightIndexDistal: 'rightIndexDistal',
  rightThumbProximal: 'rightThumbProximal',
  rightThumbIntermediate: 'rightThumbIntermediate',
  rightThumbDistal: 'rightThumbDistal',
  leftUpperLeg: 'leftUpperLeg',
  leftLowerLeg: 'leftLowerLeg',
  leftFoot: 'leftFoot',
  leftToes: 'leftToes',
  rightUpperLeg: 'rightUpperLeg',
  rightLowerLeg: 'rightLowerLeg',
  rightFoot: 'rightFoot',
  rightToes: 'rightToes',
  // vrm uploaded to mixamo
  // these are latest mixamo bone names
  Hips: 'hips',
  Spine: 'spine',
  Spine1: 'chest',
  Spine2: 'upperChest',
  Neck: 'neck',
  Head: 'head',
  LeftShoulder: 'leftShoulder',
  LeftArm: 'leftUpperArm',
  LeftForeArm: 'leftLowerArm',
  LeftHand: 'leftHand',
  LeftHandThumb1: 'leftThumbProximal',
  LeftHandThumb2: 'leftThumbIntermediate',
  LeftHandThumb3: 'leftThumbDistal',
  LeftHandIndex1: 'leftIndexProximal',
  LeftHandIndex2: 'leftIndexIntermediate',
  LeftHandIndex3: 'leftIndexDistal',
  LeftHandMiddle1: 'leftMiddleProximal',
  LeftHandMiddle2: 'leftMiddleIntermediate',
  LeftHandMiddle3: 'leftMiddleDistal',
  LeftHandRing1: 'leftRingProximal',
  LeftHandRing2: 'leftRingIntermediate',
  LeftHandRing3: 'leftRingDistal',
  LeftHandPinky1: 'leftLittleProximal',
  LeftHandPinky2: 'leftLittleIntermediate',
  LeftHandPinky3: 'leftLittleDistal',
  RightShoulder: 'rightShoulder',
  RightArm: 'rightUpperArm',
  RightForeArm: 'rightLowerArm',
  RightHand: 'rightHand',
  RightHandPinky1: 'rightLittleProximal',
  RightHandPinky2: 'rightLittleIntermediate',
  RightHandPinky3: 'rightLittleDistal',
  RightHandRing1: 'rightRingProximal',
  RightHandRing2: 'rightRingIntermediate',
  RightHandRing3: 'rightRingDistal',
  RightHandMiddle1: 'rightMiddleProximal',
  RightHandMiddle2: 'rightMiddleIntermediate',
  RightHandMiddle3: 'rightMiddleDistal',
  RightHandIndex1: 'rightIndexProximal',
  RightHandIndex2: 'rightIndexIntermediate',
  RightHandIndex3: 'rightIndexDistal',
  RightHandThumb1: 'rightThumbProximal',
  RightHandThumb2: 'rightThumbIntermediate',
  RightHandThumb3: 'rightThumbDistal',
  LeftUpLeg: 'leftUpperLeg',
  LeftLeg: 'leftLowerLeg',
  LeftFoot: 'leftFoot',
  LeftToeBase: 'leftToes',
  RightUpLeg: 'rightUpperLeg',
  RightLeg: 'rightLowerLeg',
  RightFoot: 'rightFoot',
  RightToeBase: 'rightToes',
  // these must be old mixamo names, prefixed with "mixamo"
  mixamorigHips: 'hips',
  mixamorigSpine: 'spine',
  mixamorigSpine1: 'chest',
  mixamorigSpine2: 'upperChest',
  mixamorigNeck: 'neck',
  mixamorigHead: 'head',
  mixamorigLeftShoulder: 'leftShoulder',
  mixamorigLeftArm: 'leftUpperArm',
  mixamorigLeftForeArm: 'leftLowerArm',
  mixamorigLeftHand: 'leftHand',
  mixamorigLeftHandThumb1: 'leftThumbProximal',
  mixamorigLeftHandThumb2: 'leftThumbIntermediate',
  mixamorigLeftHandThumb3: 'leftThumbDistal',
  mixamorigLeftHandIndex1: 'leftIndexProximal',
  mixamorigLeftHandIndex2: 'leftIndexIntermediate',
  mixamorigLeftHandIndex3: 'leftIndexDistal',
  mixamorigLeftHandMiddle1: 'leftMiddleProximal',
  mixamorigLeftHandMiddle2: 'leftMiddleIntermediate',
  mixamorigLeftHandMiddle3: 'leftMiddleDistal',
  mixamorigLeftHandRing1: 'leftRingProximal',
  mixamorigLeftHandRing2: 'leftRingIntermediate',
  mixamorigLeftHandRing3: 'leftRingDistal',
  mixamorigLeftHandPinky1: 'leftLittleProximal',
  mixamorigLeftHandPinky2: 'leftLittleIntermediate',
  mixamorigLeftHandPinky3: 'leftLittleDistal',
  mixamorigRightShoulder: 'rightShoulder',
  mixamorigRightArm: 'rightUpperArm',
  mixamorigRightForeArm: 'rightLowerArm',
  mixamorigRightHand: 'rightHand',
  mixamorigRightHandPinky1: 'rightLittleProximal',
  mixamorigRightHandPinky2: 'rightLittleIntermediate',
  mixamorigRightHandPinky3: 'rightLittleDistal',
  mixamorigRightHandRing1: 'rightRingProximal',
  mixamorigRightHandRing2: 'rightRingIntermediate',
  mixamorigRightHandRing3: 'rightRingDistal',
  mixamorigRightHandMiddle1: 'rightMiddleProximal',
  mixamorigRightHandMiddle2: 'rightMiddleIntermediate',
  mixamorigRightHandMiddle3: 'rightMiddleDistal',
  mixamorigRightHandIndex1: 'rightIndexProximal',
  mixamorigRightHandIndex2: 'rightIndexIntermediate',
  mixamorigRightHandIndex3: 'rightIndexDistal',
  mixamorigRightHandThumb1: 'rightThumbProximal',
  mixamorigRightHandThumb2: 'rightThumbIntermediate',
  mixamorigRightHandThumb3: 'rightThumbDistal',
  mixamorigLeftUpLeg: 'leftUpperLeg',
  mixamorigLeftLeg: 'leftLowerLeg',
  mixamorigLeftFoot: 'leftFoot',
  mixamorigLeftToeBase: 'leftToes',
  mixamorigRightUpLeg: 'rightUpperLeg',
  mixamorigRightLeg: 'rightLowerLeg',
  mixamorigRightFoot: 'rightFoot',
  mixamorigRightToeBase: 'rightToes',
}
