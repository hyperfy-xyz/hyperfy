import { System } from './System'
import StatsGL from '../libs/stats-gl'
import Panel from '../libs/stats-gl/panel'
import { isBoolean } from 'lodash-es'
import type { World } from '../../types'

const PING_RATE = 1 / 2

/**
 * Stats System
 *
 * - runs on the client
 * - attaches stats to the ui to see fps/cpu/gpu
 *
 */
export class ClientStats extends System {
  stats: any = null
  ui: any = null
  active: boolean = false
  lastPingAt: number = 0
  pingHistory: number[] = []
  pingHistorySize: number = 30
  maxPing: number = 0.01
  ping!: Panel
  uiHidden: boolean = false
  
  constructor(world: World) {
    super(world)
  }

  async init(options: any): Promise<void> {
    this.ui = options.ui
  }

  start() {
    ;(this.world as any).prefs.on('change', this.onPrefsChange)
    this.world.on?.('ui', this.onUIState)
    this.world.on?.('ready', this.onReady)
  }

  onReady = () => {
    if ((this.world as any).prefs.stats) {
      this.toggle(true)
    }
  }

  toggle(value?: boolean) {
    value = isBoolean(value) ? value : !this.active
    if (this.active === value) return
    this.active = value
    if (this.active) {
      if (!this.stats) {
        this.stats = new StatsGL({
          logsPerSecond: 20,
          samplesLog: 100,
          samplesGraph: 10,
          precision: 2,
          horizontal: true,
          minimal: false,
          mode: 0,
        })
        this.stats.init((this.world as any).graphics.renderer, false)
        this.ping = new Panel('PING', '#f00', '#200')
        this.stats.addPanel(this.ping, 3)
      }
      this.ui.appendChild(this.stats.dom)
    } else {
      this.ui.removeChild(this.stats.dom)
    }
  }

  preTick() {
    if (this.active) {
      this.stats?.begin()
    }
  }

  update(delta: number) {
    if (!this.active) return
    this.lastPingAt += delta
    if (this.lastPingAt > PING_RATE) {
      const time = performance.now()
      ;(this.world as any).network.send('ping', time)
      this.lastPingAt = 0
    }
  }

  postTick() {
    if (this.active) {
      this.stats?.end()
      this.stats?.update()
    }
  }

  onPong(time: number) {
    const rttMs = performance.now() - time
    if (this.active && this.ping) {
      this.pingHistory.push(rttMs)
      if (this.pingHistory.length > this.pingHistorySize) {
        this.pingHistory.shift()
      }
      let sum = 0
      let min = Infinity
      let max = 0
      for (let i = 0; i < this.pingHistory.length; i++) {
        const value = this.pingHistory[i]
        sum += value
        if (value < min) min = value
        if (value > max) max = value
      }
      const avg = sum / this.pingHistory.length
      if (max > this.maxPing) {
        this.maxPing = max
      }
      this.ping.update(
        avg, // current value (average)
        rttMs, // graph value (latest ping)
        max, // max value for text display
        this.maxPing, // max value for graph scaling
        0 // number of decimal places (0 for ping)
      )
    }
    // emit an event so other systems can use ping information
    // if (this.pingHistory.length > 0) {
    //   let sum = 0
    //   let min = Infinity
    //   let max = 0
    //   for (let i = 0; i < this.pingHistory.length; i++) {
    //     const value = this.pingHistory[i]
    //     sum += value
    //     if (value < min) min = value
    //     if (value > max) max = value
    //   }
    //   this.world.emit('ping-update', {
    //     current: rttMs,
    //     average: Math.round(sum / this.pingHistory.length),
    //     min: min,
    //     max: max,
    //   })
    // }
  }

  onPrefsChange = (changes: any) => {
    if (changes.stats) {
      this.toggle(changes.stats.value)
    }
  }

  onUIState = (state: any) => {
    if (this.active && !state.visible) {
      this.uiHidden = true
      this.toggle(false)
    } else if (this.uiHidden && state.visible) {
      this.uiHidden = false
      this.toggle(true)
    }
  }

  destroy() {
    this.toggle(false)
  }
}
