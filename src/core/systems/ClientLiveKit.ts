import { ParticipantEvent, Room, RoomEvent, ScreenSharePresets } from 'livekit-client'
import type { World } from '../../types/index.js'
import { System } from './System'

export class ClientLiveKit extends System {
  // Properties
  room: Room | null = null
  status: {
    available: boolean
    audio: boolean
    video: boolean
    screen: boolean
  }
  voices: Map<string, any>
  screens: any[]
  screenNodes: Set<any>

  constructor(world: World) {
    super(world)
    this.status = {
      available: false,
      audio: false,
      video: false,
      screen: false,
    }
    this.voices = new Map() // playerId -> PlayerVoice
    this.screens = []
    this.screenNodes = new Set() // Video
  }

  async deserialize(opts: any) {
    if (!opts || !opts.token) {
      console.warn('[ClientLiveKit] No opts or token provided for LiveKit connection');
      return;
    }
    const { token } = opts
    this.status.available = true
    // TODO: check if the token has expired
    this.room = new Room({
      audioCaptureDefaults: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
        // @ts-ignore - audio might not exist on world
        audioContext: (this.world as any).audio?.ctx,
      },
      videoCaptureDefaults: {
        resolution: {
          width: 640,
          height: 360,
          frameRate: 15,
        },
      },
    })
    this.room.on(RoomEvent.TrackMuted, this.onTrackMuted)
    this.room.on(RoomEvent.TrackUnmuted, this.onTrackUnmuted)
    this.room.on(RoomEvent.LocalTrackPublished, this.onLocalTrackPublished)
    this.room.on(RoomEvent.LocalTrackUnpublished, this.onLocalTrackUnpublished)
    this.room.on(RoomEvent.TrackSubscribed, this.onTrackSubscribed)
    this.room.on(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribed)
    this.room.localParticipant.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
      // @ts-ignore - setSpeaking might not exist
      this.world.entities.player?.setSpeaking?.(speaking)
    })
    await this.room.connect(window.env?.LIVEKIT_URL || import.meta.env?.LIVEKIT_URL || '', token)
  }

  async enableAudio() {
    if (!this.room) return
    this.status.audio = true
    await this.room.localParticipant.setMicrophoneEnabled(true)
  }

  async disableAudio() {
    if (!this.room) return
    this.status.audio = false
    await this.room.localParticipant.setMicrophoneEnabled(false)
  }

  async enableVideo() {
    if (!this.room) return
    this.status.video = true
    await this.room.localParticipant.setCameraEnabled(true)
  }

  async disableVideo() {
    if (!this.room) return
    this.status.video = false
    await this.room.localParticipant.setCameraEnabled(false)
  }

  async enableScreen() {
    if (!this.room) return
    this.status.screen = true
    await this.room.localParticipant.setScreenShareEnabled(true, { resolution: ScreenSharePresets.h1080fps15.resolution })
  }

  async disableScreen() {
    if (!this.room) return
    this.status.screen = false
    await this.room.localParticipant.setScreenShareEnabled(false)
  }

  onTrackMuted = (_publication: any, _participant: any) => {
    // console.log('[livekit] track muted', publication, participant)
  }

  onTrackUnmuted = (_publication: any, _participant: any) => {
    // console.log('[livekit] track unmuted', publication, participant)
  }

  onLocalTrackPublished = (_publication: any, _participant: any) => {
    // console.log('[livekit] local track published', publication, participant)
  }

  onLocalTrackUnpublished = (_publication: any, _participant: any) => {
    // console.log('[livekit] local track unpublished', publication, participant)
  }

  onTrackSubscribed = (track: any, _publication: any, participant: any) => {
    // console.log('[livekit] track subscribed', track, publication, participant)
    const playerId = participant.identity
    const player = this.world.entities.players?.get(playerId)
    if (!player) return
    if (track.kind === 'audio') {
      // @ts-ignore - audio might not exist on world
      const audioCtx = (this.world as any).audio?.ctx
      if (!audioCtx) return
      const source = audioCtx.createMediaStreamSource(track.mediaStream)
      const gainNode = audioCtx.createGain()
      const pannerNode = audioCtx.createPanner()
      pannerNode.panningModel = 'HRTF'
      pannerNode.distanceModel = 'exponential'
      pannerNode.refDistance = 1
      pannerNode.maxDistance = 100
      pannerNode.rolloffFactor = 1.5
      pannerNode.coneInnerAngle = 360
      pannerNode.coneOuterAngle = 0
      pannerNode.coneOuterGain = 0
      source.connect(gainNode)
      gainNode.connect(pannerNode)
      pannerNode.connect(audioCtx.destination)
      const voice = { source, gainNode, pannerNode }
      this.voices.set(playerId, voice)
    } else if (track.kind === 'video') {
      const element = track.attach()
      element.style.display = 'none'
      document.body.appendChild(element)
      const screen = { track, element, playerId }
      this.screens.push(screen)
      this.updateScreens()
    }
  }

  onTrackUnsubscribed = (track: any, _publication: any, participant: any) => {
    // console.log('[livekit] track unsubscribed', track, publication, participant)
    const playerId = participant.identity
    if (track.kind === 'audio') {
      const voice = this.voices.get(playerId)
      if (voice) {
        voice.source.disconnect()
        voice.gainNode.disconnect()
        voice.pannerNode.disconnect()
        this.voices.delete(playerId)
      }
    } else if (track.kind === 'video') {
      const screenIndex = this.screens.findIndex(s => s.track === track)
      if (screenIndex !== -1) {
        const screen = this.screens[screenIndex]
        track.detach(screen.element)
        screen.element.remove()
        this.screens.splice(screenIndex, 1)
        this.updateScreens()
      }
    }
  }

  updateScreens() {
    // remove all existing screen nodes
    for (const node of this.screenNodes) {
      node.deactivate()
    }
    this.screenNodes.clear()
    // add new screen nodes
    for (const screen of this.screens) {
      const player = this.world.entities.players?.get(screen.playerId)
      if (!player) continue
      // @ts-ignore - build might not exist
      const node = player.build?.({
        type: 'video',
        src: screen.element,
        position: [0, player.position?.y + 2, 0],
      })
      if (node) {
        this.screenNodes.add(node)
      }
    }
  }

  override fixedUpdate(_delta: number) {
    // update voice positions
    for (const [playerId, voice] of this.voices) {
      const player = this.world.entities.players?.get(playerId)
      if (!player) continue
      // @ts-ignore - position might not exist
      const position = player.position
      if (position) {
        voice.pannerNode.setPosition(position.x, position.y, position.z)
      }
    }
  }

  override destroy() {
    if (this.room) {
      this.room.disconnect()
    }
  }
}

// PlayerVoice class removed - not used
// createPlayerScreen function removed - not used

