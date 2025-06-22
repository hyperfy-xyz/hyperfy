import { World } from './World'

import { Client } from './systems/Client'
import { ClientLiveKit } from './systems/ClientLiveKit'
import { ClientPointer } from './systems/ClientPointer'
import { ClientPrefs } from './systems/ClientPrefs'
import { ClientControls } from './systems/ClientControls'
import { ClientNetwork } from './systems/ClientNetwork'
import { ClientLoader } from './systems/ClientLoader'
import { ClientGraphics } from './systems/ClientGraphics'
import { ClientEnvironment } from './systems/ClientEnvironment'
import { ClientAudio } from './systems/ClientAudio'
import { ClientStats } from './systems/ClientStats'
import { ClientBuilder } from './systems/ClientBuilder'
import { ClientActions } from './systems/ClientActions'
import { ClientTarget } from './systems/ClientTarget'
import { ClientUI } from './systems/ClientUI'
import { LODs } from './systems/LODs'
import { Nametags } from './systems/Nametags'
import { Particles } from './systems/Particles'
import { Snaps } from './systems/Snaps'
import { Wind } from './systems/Wind'
import { XR } from './systems/XR'

export function createClientWorld() {
  const world = new World()
  world.register('client', Client)
  world.register('livekit', ClientLiveKit)
  world.register('pointer', ClientPointer)
  world.register('prefs', ClientPrefs)
  world.register('controls', ClientControls)
  world.register('network', ClientNetwork)
  world.register('loader', ClientLoader)
  world.register('graphics', ClientGraphics)
  world.register('environment', ClientEnvironment)
  world.register('audio', ClientAudio)
  world.register('stats', ClientStats)
  world.register('builder', ClientBuilder)
  world.register('actions', ClientActions)
  world.register('target', ClientTarget)
  world.register('ui', ClientUI)
  world.register('lods', LODs)
  world.register('nametags', Nametags)
  world.register('particles', Particles)
  world.register('snaps', Snaps)
  world.register('wind', Wind)
  world.register('xr', XR)
  return world
}
