import { System } from './System'

import * as THREE from '../extras/three'
import { initYoga } from '../extras/yoga'
import type { World } from '../../types'

let worker: Worker | null = null

/**
 * Client System
 *
 * - Runs on the client
 *
 *
 */
export class Client extends System {
  constructor(world: World) {
    super(world)
    ;(window as any).world = world
    ;(window as any).THREE = THREE
  }

  async init(options: any): Promise<void> {
    await options.loadYoga
    initYoga()
  }

  start() {
    ;(this.world as any).graphics?.renderer.setAnimationLoop((this.world as any).tick)
    document.addEventListener('visibilitychange', this.onVisibilityChange)

    ;(this.world.settings as any).on('change', this.onSettingsChange)
  }

  onSettingsChange = (changes: any) => {
    if (changes.title) {
      document.title = changes.title.value || 'World'
    }
  }

  onVisibilityChange = () => {
    // if the tab is no longer active, browsers stop triggering requestAnimationFrame.
    // this is obviously bad because physics stop running and we stop processing websocket messages etc.
    // instead, we stop using requestAnimationFrame and get a worker to tick at a slower rate using setInterval
    // and notify us.
    // this allows us to keep everything running smoothly.
    // See: https://gamedev.stackexchange.com/a/200503 (kinda fucking genius)
    //
    // spawn worker if we haven't yet
    if (!worker) {
      const script = `
        const rate = 1000 / 5 // 5 FPS
        let intervalId = null;
        self.onmessage = e => {
          if (e.data === 'start' && !intervalId) {
            intervalId = setInterval(() => {
              self.postMessage(1);
            }, rate);
            console.log('[worker] tick started')
          }
          if (e.data === 'stop' && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
            console.log('[worker] tick stopped')
          }
        }
      `
      const blob = new Blob([script], { type: 'application/javascript' })
      worker = new Worker(URL.createObjectURL(blob))
      worker.onmessage = () => {
        const time = performance.now()
        ;(this.world as any).tick(time)
      }
    }
    if (document.hidden) {
      // stop rAF
      ;(this.world as any).graphics?.renderer.setAnimationLoop(null)
      // tell the worker to start
      worker.postMessage('start')
    } else {
      // tell the worker to stop
      worker.postMessage('stop')
      // resume rAF
      ;(this.world as any).graphics?.renderer.setAnimationLoop((this.world as any).tick)
    }
  }

  destroy() {
    ;(this.world as any).graphics?.renderer.setAnimationLoop(null)
    worker?.postMessage('stop')
    worker = null
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
  }
}
