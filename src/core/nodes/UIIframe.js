import { isNumber, isString } from 'lodash-es'
import { Node } from './Node'
import { Display, isDisplay } from '../extras/yoga'
import { fillRoundRect } from '../extras/fillRoundRect'

const defaults = {
  display: 'flex',
  backgroundColor: null,
  borderRadius: 0,
  margin: 0,
  padding: 0,
  src: null,
  width: null,
  height: null,
  sandbox: 'allow-scripts allow-same-origin'
}

export class UIIframe extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'uiiframe'

    this.display = data.display
    this.backgroundColor = data.backgroundColor
    this.borderRadius = data.borderRadius
    this.margin = data.margin
    this.padding = data.padding
    this.src = data.src
    this.width = data.width
    this.height = data.height
    this.sandbox = data.sandbox || defaults.sandbox

    this.iframe = null
    this.container = null
  }

  draw(ctx, offsetLeft, offsetTop) {
    if (this._display === 'none') return

    const left = offsetLeft + this.yogaNode.getComputedLeft()
    const top = offsetTop + this.yogaNode.getComputedTop()
    const width = this.yogaNode.getComputedWidth()
    const height = this.yogaNode.getComputedHeight()

    // Draw background
    if (this._backgroundColor) {
      ctx.fillStyle = this._backgroundColor
      if (this._borderRadius) {
        fillRoundRect(ctx, left, top, width, height, this._borderRadius * this.ui._res)
      } else {
        ctx.fillRect(left, top, width, height)
      }
    }

    // Create or update container
    if (!this.container && this.ui?.mesh) {
      this.container = document.createElement('div')
      this.container.style.position = 'absolute'
      this.container.style.pointerEvents = 'auto'
      if (this._borderRadius) {
        this.container.style.borderRadius = `${this._borderRadius * this.ui._res}px`
        this.container.style.overflow = 'hidden'
      }
      document.body.appendChild(this.container)
    }

    if (this.container) {
      // Update container styles
      this.container.style.left = `${left}px`
      this.container.style.top = `${top}px`
      this.container.style.width = `${width}px`
      this.container.style.height = `${height}px`

      // Create or update iframe
      if (!this.iframe && this._src) {
        this.iframe = document.createElement('iframe')
        this.iframe.style.border = 'none'
        this.iframe.style.width = '100%'
        this.iframe.style.height = '100%'
        this.iframe.sandbox = this._sandbox
        this.container.appendChild(this.iframe)
      }

      if (this.iframe && this.iframe.src !== this._src) {
        this.iframe.src = this._src
      }
    }

    this.box = { left, top, width, height }
  }

  mount() {
    if (this.ctx.world.network.isServer) return
    this.ui = this.parent?.ui
    if (!this.ui) return console.error('uiiframe: must be child of ui node')
    
    this.yogaNode = Yoga.Node.create()
    this.yogaNode.setDisplay(Display[this._display])
    this.yogaNode.setMargin(Yoga.EDGE_ALL, this._margin * this.ui._res)
    this.yogaNode.setPadding(Yoga.EDGE_ALL, this._padding * this.ui._res)

    this.yogaNode.setMeasureFunc((width, widthMode, height, heightMode) => {
      let finalWidth = this._width !== null ? this._width * this.ui._res : width
      let finalHeight = this._height !== null ? this._height * this.ui._res : height

      if (widthMode === Yoga.MEASURE_MODE_UNDEFINED) {
        finalWidth = 300 * this.ui._res
      }
      if (heightMode === Yoga.MEASURE_MODE_UNDEFINED) {
        finalHeight = 150 * this.ui._res
      }

      return { width: finalWidth, height: finalHeight }
    })

    this.parent.yogaNode.insertChild(this.yogaNode, this.parent.yogaNode.getChildCount())
  }

  unmount() {
    if (this.ctx.world.network.isServer) return
    if (this.yogaNode) {
      this.parent.yogaNode?.removeChild(this.yogaNode)
      this.yogaNode.free()
      this.yogaNode = null
      this.box = null
    }
    if (this.container) {
      this.container.remove()
      this.container = null
      this.iframe = null
    }
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._display = source._display
    this._backgroundColor = source._backgroundColor
    this._borderRadius = source._borderRadius
    this._margin = source._margin
    this._padding = source._padding
    this._src = source._src
    this._width = source._width
    this._height = source._height
    this._sandbox = source._sandbox
    return this
  }

  get display() {
    return this._display
  }

  set display(value = defaults.display) {
    if (!isDisplay(value)) {
      throw new Error(`[uiiframe] display invalid: ${value}`)
    }
    if (this._display === value) return
    this._display = value
    this.yogaNode?.setDisplay(Display[this._display])
    this.ui?.redraw()
  }

  get backgroundColor() {
    return this._backgroundColor
  }

  set backgroundColor(value = defaults.backgroundColor) {
    if (value !== null && !isString(value)) {
      throw new Error(`[uiiframe] backgroundColor not a string`)
    }
    if (this._backgroundColor === value) return
    this._backgroundColor = value
    this.ui?.redraw()
  }

  get borderRadius() {
    return this._borderRadius
  }

  set borderRadius(value = defaults.borderRadius) {
    if (!isNumber(value)) {
      throw new Error(`[uiiframe] borderRadius not a number`)
    }
    if (this._borderRadius === value) return
    this._borderRadius = value
    this.ui?.redraw()
  }

  get margin() {
    return this._margin
  }

  set margin(value = defaults.margin) {
    if (!isNumber(value)) {
      throw new Error(`[uiiframe] margin not a number`)
    }
    if (this._margin === value) return
    this._margin = value
    this.yogaNode?.setMargin(Yoga.EDGE_ALL, this._margin * this.ui._res)
    this.ui?.redraw()
  }

  get padding() {
    return this._padding
  }

  set padding(value = defaults.padding) {
    if (!isNumber(value)) {
      throw new Error(`[uiiframe] padding not a number`)
    }
    if (this._padding === value) return
    this._padding = value
    this.yogaNode?.setPadding(Yoga.EDGE_ALL, this._padding * this.ui._res)
    this.ui?.redraw()
  }

  get src() {
    return this._src
  }

  set src(value = defaults.src) {
    if (value !== null && !isString(value)) {
      throw new Error(`[uiiframe] src not a string`)
    }
    if (this._src === value) return
    this._src = value
    this.ui?.redraw()
  }

  get width() {
    return this._width
  }

  set width(value = defaults.width) {
    if (value !== null && !isNumber(value)) {
      throw new Error(`[uiiframe] width not a number`)
    }
    if (this._width === value) return
    this._width = value
    this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get height() {
    return this._height
  }

  set height(value = defaults.height) {
    if (value !== null && !isNumber(value)) {
      throw new Error(`[uiiframe] height not a number`)
    }
    if (this._height === value) return
    this._height = value
    this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get sandbox() {
    return this._sandbox
  }

  set sandbox(value = defaults.sandbox) {
    if (!isString(value)) {
      throw new Error(`[uiiframe] sandbox not a string`)
    }
    if (this._sandbox === value) return
    this._sandbox = value
    this.ui?.redraw()
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get display() {
          return self.display
        },
        set display(value) {
          self.display = value
        },
        get backgroundColor() {
          return self.backgroundColor
        },
        set backgroundColor(value) {
          self.backgroundColor = value
        },
        get borderRadius() {
          return self.borderRadius
        },
        set borderRadius(value) {
          self.borderRadius = value
        },
        get margin() {
          return self.margin
        },
        set margin(value) {
          self.margin = value
        },
        get padding() {
          return self.padding
        },
        set padding(value) {
          self.padding = value
        },
        get src() {
          return self.src
        },
        set src(value) {
          self.src = value
        },
        get width() {
          return self.width
        },
        set width(value) {
          self.width = value
        },
        get height() {
          return self.height
        },
        set height(value) {
          self.height = value
        },
        get sandbox() {
          return self.sandbox
        },
        set sandbox(value) {
          self.sandbox = value
        }
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy()))
      this.proxy = proxy
    }
    return this.proxy
  }
} 