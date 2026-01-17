import Hls from 'hls.js/dist/hls.js'
import { Node } from './Node'

export class HttpLiveStreaming extends Node {
  constructor(data = {}) {
    super()
    this.name = 'hls'

    const defaults = {
      url: 'https://5fd5567570c0e.streamlock.net/theretrochannel/stream/playlist.m3u8',
      autoplay: true,
      playsInline: true, // TODO: important for mobile devices ?
      // muted: true, // TODO: essential for autoplay in many modern browsers ?
    }

    this.data = { ...defaults, ...data }
  }

  mount() {
    if (!this.ctx.world.network.isClient) {
      throw new Error('the HttpLiveStreaming Node should only be mounted on clients')
    }

    if (this.hls) {
      return
    }

    this.hls = new Hls()
    this.hls.loadSource(this.data.url)

    const video = document.createElement('video')

    Object.keys(this.data).forEach(key => video[key] = this.data[key])

    this.hls.attachMedia(video)
  }

  unmount() {
    this.hls?.destroy()
    delete this.hls
  }

  getProxy() {
    if (!this.proxy) {
      var self = this
      this.proxy = Object.defineProperties(super.getProxy(), Object.getOwnPropertyDescriptors({
        get hls() { return self.hls },
      }))
    }

    return this.proxy
  }
}
