import { World } from './World'

// Core Systems (Shared)
import { Settings } from './systems/Settings'
import { Apps } from './systems/Apps'
import { Anchors } from './systems/Anchors'
import { Events } from './systems/Events'
import { Scripts } from './systems/Scripts'
import { Chat } from './systems/Chat'
import { Blueprints } from './systems/Blueprints'
import { Entities } from './systems/Entities'
import { Physics } from './systems/Physics'
import { Stage } from './systems/Stage'
import { ClientNetwork } from './systems/ClientNetwork'

// Client-Specific Systems
import { Client } from './systems/Client'
import { ClientLiveKit } from './systems/ClientLiveKit'
import { ClientPointer } from './systems/ClientPointer'
import { ClientPrefs } from './systems/ClientPrefs'
import { ClientControls } from './systems/ClientControls'
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

/**
 * Creates a World instance tailored for the specified environment.
 * 
 * @param {{ env: 'browser' | 'node' }} options - Configuration options.
 * @returns {World}
 */
export function createClientWorld() {
  const world = new World()

  // Define registration logic reusable for systems
  function registerSystem(key, SystemClass, proxyHandler = null) {
    const system = new SystemClass(world)
    world[key] = proxyHandler ? new Proxy(system, proxyHandler) : system
    world.systems.push(system) // Push the original system for the update loop
    return system
  }

  // --- Register Core Systems (Common to Client & Agent) ---
  registerSystem('settings', Settings)
  registerSystem('apps', Apps)
  registerSystem('anchors', Anchors)
  registerSystem('events', Events)
  registerSystem('scripts', Scripts)
  registerSystem('chat', Chat)
  registerSystem('blueprints', Blueprints)
  registerSystem('entities', Entities)
  registerSystem('physics', Physics) // Requires PhysX loaded in env
  registerSystem('stage', Stage) // Basic scene graph needed by many systems
  registerSystem('network', ClientNetwork) // Use ClientNetwork for both

  // check if window is undefined
  if (typeof window !== 'undefined') {
    // Client-only systems
    registerSystem('client', Client)
    registerSystem('livekit', ClientLiveKit)
    registerSystem('pointer', ClientPointer)
    registerSystem('prefs', ClientPrefs)
    registerSystem('controls', ClientControls)
    registerSystem('loader', ClientLoader)
    registerSystem('graphics', ClientGraphics)
    registerSystem('environment', ClientEnvironment)
    registerSystem('audio', ClientAudio)
    registerSystem('stats', ClientStats)
    registerSystem('builder', ClientBuilder)
    registerSystem('actions', ClientActions)
    registerSystem('target', ClientTarget)
    registerSystem('ui', ClientUI)
    registerSystem('lods', LODs)
    registerSystem('nametags', Nametags)
    registerSystem('particles', Particles)
    registerSystem('snaps', Snaps)
    registerSystem('wind', Wind)
    registerSystem('xr', XR)
    // ClientPrefs is needed early by ClientAudio, ensure it's registered
    // world.register('prefs', ClientPrefs) // Already registered above? Let's move it earlier if needed

  } else {
    // Agent-only or adapted systems
    // world.register('livekit', AgentLiveKit) // TODO: Create AgentLiveKit or omit
    registerSystem('prefs', ClientPrefs) // Use ClientPrefs, relying on adapted storage.js

    // Systems NOT needed/adapted for Agent:
    // Client, ClientPointer, ClientLoader(mostly), ClientGraphics, ClientEnvironment,
    // ClientAudio, ClientStats, ClientBuilder, ClientActions, ClientTarget, ClientUI,
    // LODs, Nametags, Particles, Snaps, Wind, XR
  }

  return world
}
