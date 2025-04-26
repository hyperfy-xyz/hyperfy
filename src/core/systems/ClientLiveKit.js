import { Participant, ParticipantEvent, Room, RoomEvent, ScreenSharePresets, Track } from 'livekit-client'
import * as THREE from '../extras/three'

import { System } from './System'
import { isBoolean } from 'lodash-es'
import { TrackSource } from 'livekit-server-sdk'

const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()
const q1 = new THREE.Quaternion()

export class ClientLiveKit extends System {
  constructor(world) {
    super(world)
    this.room = null
    this.status = {
      connected: false,
      mic: false,
      screenshare: null,
    }
    this.voices = new Map() // playerId -> PlayerVoice
    this.screens = []
    this.screenNodes = new Set() // Video
  }

  async deserialize(opts) {
    if (!opts) return
    // console.log(opts)
    this.room = new Room({
      webAudioMix: {
        audioContext: this.world.audio.ctx,
      },
      publishDefaults: {
        screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
        screenShareSimulcastLayers: [ScreenSharePresets.h1080fps30],
      },
    })
    this.room.on(RoomEvent.TrackMuted, this.onTrackMuted)
    this.room.on(RoomEvent.TrackUnmuted, this.onTrackUnmuted)
    this.room.on(RoomEvent.LocalTrackPublished, this.onLocalTrackPublished)
    this.room.on(RoomEvent.LocalTrackUnpublished, this.onLocalTrackUnpublished)
    this.room.on(RoomEvent.TrackSubscribed, this.onTrackSubscribed)
    this.room.on(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribed)
    this.room.localParticipant.on(ParticipantEvent.IsSpeakingChanged, speaking => {
      this.world.entities.player.setSpeaking(speaking)
    })
    this.world.audio.ready(async () => {
      await this.room.connect(opts.wsUrl, opts.token)
      this.status.connected = true
      this.emit('status', this.status)
    })
  }

  lateUpdate(delta) {
    this.voices.forEach(voice => {
      voice.lateUpdate(delta)
    })
  }

  setMicrophoneEnabled(value) {
    if (!this.room) return console.error('[livekit] setMicrophoneEnabled failed (not connected)')
    value = isBoolean(value) ? value : !this.room.localParticipant.isMicrophoneEnabled
    if (this.status.mic === value) return
    this.room.localParticipant.setMicrophoneEnabled(value)
  }

  setScreenShareTarget(targetId = null) {
    if (!this.room) return console.error('[livekit] setScreenShareTarget failed (not connected)')
    if (this.status.screenshare === targetId) return
    const metadata = JSON.stringify({
      screenTargetId: targetId,
    })
    this.room.localParticipant.setMetadata(metadata)
    this.room.localParticipant.setScreenShareEnabled(!!targetId, {
      // audio: true,
      // systemAudio: 'include',
    })
  }

  onTrackMuted = track => {
    // console.log('onTrackMuted', track)
    if (track.isLocal && track.source === 'microphone') {
      this.status.mic = false
      this.emit('status', this.status)
    }
  }

  onTrackUnmuted = track => {
    // console.log('onTrackUnmuted', track)
    if (track.isLocal && track.source === 'microphone') {
      this.status.mic = true
      this.emit('status', this.status)
    }
  }

  onLocalTrackPublished = publication => {
    const world = this.world
    const track = publication.track
    const playerId = this.world.network.id
    // console.log('onLocalTrackPublished', publication)
    if (publication.source === 'microphone') {
      this.status.mic = true
      this.emit('status', this.status)
    }
    if (publication.source === 'screen_share') {
      const metadata = JSON.parse(this.room.localParticipant.metadata || '{}')
      const targetId = metadata.screenTargetId
      this.status.screenshare = targetId
      const screen = createPlayerScreen({ world, playerId, targetId, track, publication })
      this.addScreen(screen)
      this.emit('status', this.status)
    }
  }

  onLocalTrackUnpublished = publication => {
    const playerId = this.world.network.id
    // console.log('onLocalTrackUnpublished', pub)
    if (publication.source === 'microphone') {
      this.status.mic = false
      this.emit('status', this.status)
    }
    if (publication.source === 'screen_share') {
      const screen = this.screens.find(s => s.playerId === playerId)
      this.removeScreen(screen)
      this.status.screenshare = null
      this.emit('status', this.status)
    }
  }

  onTrackSubscribed = (track, publication, participant) => {
    // console.log('onTrackSubscribed', track, publication, participant)
    const playerId = participant.identity
    const player = this.world.entities.getPlayer(playerId)
    if (!player) return console.error('onTrackSubscribed failed: no player')
    const world = this.world
    if (track.source === 'microphone') {
      const voice = new PlayerVoice(world, player, track, participant)
      this.voices.set(playerId, voice)
    }
    if (track.source === 'screen_share') {
      const metadata = JSON.parse(participant.metadata || '{}')
      const targetId = metadata.screenTargetId
      const screen = createPlayerScreen({ world, playerId, targetId, track, publication })
      this.addScreen(screen)
    }
  }

  onTrackUnsubscribed = (track, publication, participant) => {
    // console.log('onTrackUnsubscribed todo')
    const playerId = participant.identity
    if (track.source === 'microphone') {
      const voice = this.voices.get(playerId)
      voice?.destroy()
      this.voices.delete(playerId)
    }
    if (track.source === 'screen_share') {
      const screen = this.screens.find(s => s.playerId === playerId)
      this.removeScreen(screen)
    }
  }

  addScreen(screen) {
    this.screens.push(screen)
    for (const node of this.screenNodes) {
      if (node._screenId === screen.targetId) {
        node.needsRebuild = true
        node.setDirty()
      }
    }
  }

  removeScreen(screen) {
    screen.destroy()
    this.screens = this.screens.filter(s => s !== screen)
    for (const node of this.screenNodes) {
      if (node._screenId === screen.targetId) {
        node.needsRebuild = true
        node.setDirty()
      }
    }
  }

  registerScreenNode(node) {
    this.screenNodes.add(node)
    let match
    for (const screen of this.screens) {
      if (screen.targetId === node._screenId) {
        match = screen
      }
    }
    return match
  }

  unregisterScreenNode(node) {
    this.screenNodes.delete(node)
  }
}

class PlayerVoice {
  constructor(world, player, track, participant) {
    this.world = world
    this.player = player
    this.track = track
    this.participant = participant
    this.track.setAudioContext(world.audio.ctx)
    this.spatial = true // todo: switch to global
    this.panner = world.audio.ctx.createPanner()
    this.panner.panningModel = 'HRTF'
    this.panner.panningModel = 'HRTF'
    this.panner.distanceModel = 'inverse'
    this.panner.refDistance = 1
    this.panner.maxDistance = 40
    this.panner.rolloffFactor = 3
    this.panner.coneInnerAngle = 360
    this.panner.coneOuterAngle = 360
    this.panner.coneOuterGain = 0
    this.gain = world.audio.groupGains.voice
    this.panner.connect(this.gain)
    this.track.attach()
    this.track.setWebAudioPlugins([this.spatial ? this.panner : this.gain])
    this.participant.on(ParticipantEvent.IsSpeakingChanged, speaking => {
      this.player.setSpeaking(speaking)
    })
  }

  lateUpdate(delta) {
    const audio = this.world.audio
    const matrix = this.player.base.matrixWorld
    const pos = v1.setFromMatrixPosition(matrix)
    const qua = q1.setFromRotationMatrix(matrix)
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

  destroy() {
    this.player.setSpeaking(false)
    this.track.detach()
  }
}

function createPlayerScreen({ world, playerId, targetId, track, participant }) {
  // NOTE: this follows the same construct in ClientLoader.js -> createVideoFactory
  // so that it is automatically compatible with the video node
  const elem = document.createElement('video')
  elem.playsInline = true
  elem.muted = true
  // elem.style.width = '1px'
  // elem.style.height = '1px'
  // elem.style.position = 'absolute'
  // elem.style.opacity = '0'
  // elem.style.zIndex = '-1000'
  // elem.style.pointerEvents = 'none'
  // elem.style.overflow = 'hidden'
  // document.body.appendChild(elem)
  track.attach(elem)
  // elem.play()
  const texture = new THREE.VideoTexture(elem)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = world.graphics.maxAnisotropy
  texture.needsUpdate = true
  let width
  let height
  let ready = false
  const prepare = (function () {
    /**
     *
     * A regular video will load data automatically BUT a stream
     * needs to hit play() before it gets that data.
     *
     * The following code handles this for us, and when streaming
     * will hit play just until we get the data needed, then pause.
     */
    return new Promise(async resolve => {
      let playing = false
      let data = false
      elem.addEventListener(
        'loadeddata',
        async () => {
          // if we needed to hit play to fetch data then revert back to paused
          // console.log('[video] loadeddata', { playing })
          if (playing) elem.pause()
          data = true
          // await new Promise(resolve => setTimeout(resolve, 2000))
          width = elem.videoWidth
          height = elem.videoHeight
          console.log({ width, height })
          ready = true
          resolve()
        },
        { once: true }
      )
      elem.addEventListener(
        'loadedmetadata',
        async () => {
          // we need a gesture before we can potentially hit play
          // console.log('[video] ready')
          // await this.engine.driver.gesture
          // if we already have data do nothing, we're done!
          // console.log('[video] gesture', { data })
          if (data) return
          // otherwise hit play to force data loading for streams
          // elem.play()
          // playing = true
        },
        { once: true }
      )
    })
  })()
  function isPlaying() {
    return true
    // return elem.currentTime > 0 && !elem.paused && !elem.ended && elem.readyState > 2
  }
  function play(restartIfPlaying = false) {
    // if (restartIfPlaying) elem.currentTime = 0
    // elem.play()
  }
  function pause() {
    // elem.pause()
  }
  function stop() {
    // elem.currentTime = 0
    // elem.pause()
  }
  function release() {
    // stop()
    // audio.disconnect()
    // track.detach()
    // texture.dispose()
    // document.body.removeChild(elem)
  }
  function destroy() {
    console.log('destory')
    texture.dispose()
    // help to prevent chrome memory leaks
    // see: https://github.com/facebook/react/issues/15583#issuecomment-490912533
    // elem.src = ''
    // elem.load()
  }
  const handle = {
    isScreen: true,
    playerId,
    targetId,
    elem,
    audio: null,
    texture,
    prepare,
    get ready() {
      return ready
    },
    get width() {
      return width
    },
    get height() {
      return height
    },
    get loop() {
      return false
      // return elem.loop
    },
    set loop(value) {
      // elem.loop = value
    },
    get isPlaying() {
      return isPlaying()
    },
    get currentTime() {
      return elem.currentTime
    },
    set currentTime(value) {
      elem.currentTime = value
    },
    play,
    pause,
    stop,
    release,
    destroy,
  }
  return handle
}
