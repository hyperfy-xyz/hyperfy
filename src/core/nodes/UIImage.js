import Yoga from 'yoga-layout'
import { isNumber, isString } from 'lodash-es'
import { Node } from './Node'
import { Display, isDisplay } from '../extras/yoga'
import { fillRoundRect, imageRoundRect } from '../extras/roundRect'

const objectFits = ['contain', 'cover', 'fill']

const defaults = {
  display: 'flex',
  src: null,
  width: null,
  height: null,
  objectFit: 'contain',
  backgroundColor: null,
  borderRadius: 0,
}

export class UIImage extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'uiimage'

    this.display = data.display
    this.src = data.src
    this.width = data.width
    this.height = data.height
    this.objectFit = data.objectFit
    this.backgroundColor = data.backgroundColor
    this.borderRadius = data.borderRadius

    this.img = null
  }

  draw(ctx, offsetLeft, offsetTop) {
    if (this._display === 'none' || !this.img) return
    const left = offsetLeft + this.yogaNode.getComputedLeft()
    const top = offsetTop + this.yogaNode.getComputedTop()
    const width = this.yogaNode.getComputedWidth()
    const height = this.yogaNode.getComputedHeight()
    if (this._backgroundColor) {
      fillRoundRect(ctx, left, top, width, height, this._borderRadius * this.ui._res, this._backgroundColor)
    }
    if (this.img) {
      const drawParams = this.calculateDrawParameters(this.img.width, this.img.height, width, height)
      imageRoundRect(
        ctx,
        left + drawParams.x,
        top + drawParams.y,
        drawParams.width,
        drawParams.height,
        this._borderRadius * this.ui._res,
        this.img
      )
    }
    this.box = { left, top, width, height }
  }

  mount() {
    if (this.ctx.world.network.isServer) return
    this.ui = this.parent?.ui
    if (!this.ui) return console.error('uiimage: must be child of ui node')
    this.yogaNode = Yoga.Node.create()
    this.yogaNode.setDisplay(Display[this._display])
    // measure function
    this.yogaNode.setMeasureFunc((width, widthMode, height, heightMode) => {
      // no image? zero size
      if (!this.img) {
        return { width: 0, height: 0 }
      }
      const imgAspectRatio = this.img.width / this.img.height
      let finalWidth
      let finalHeight
      // handle explicitly set dimensions first
      if (this._width !== null && this._height !== null) {
        return {
          width: this._width * this.ui._res,
          height: this._height * this.ui._res,
        }
      }
      // handle cases where one dimension is specified
      if (this._width !== null) {
        finalWidth = this._width * this.ui._res
        finalHeight = finalWidth / imgAspectRatio
      } else if (this._height !== null) {
        finalHeight = this._height * this.ui._res
        finalWidth = finalHeight * imgAspectRatio
      } else {
        // neither dimension specified - use natural size with constraints
        if (widthMode === Yoga.MEASURE_MODE_EXACTLY) {
          finalWidth = width
          finalHeight = width / imgAspectRatio
        } else if (widthMode === Yoga.MEASURE_MODE_AT_MOST) {
          finalWidth = Math.min(this.img.width * this.ui._res, width)
          finalHeight = finalWidth / imgAspectRatio
        } else {
          // use natural size
          finalWidth = this.img.width * this.ui._res
          finalHeight = this.img.height * this.ui._res
        }
        // apply height constraints if any
        if (heightMode === Yoga.MEASURE_MODE_EXACTLY) {
          finalHeight = height
          if (this._objectFit === 'contain') {
            finalWidth = Math.min(finalWidth, height * imgAspectRatio)
          }
        } else if (heightMode === Yoga.MEASURE_MODE_AT_MOST && finalHeight > height) {
          finalHeight = height
          finalWidth = height * imgAspectRatio
        }
      }
      return { width: finalWidth, height: finalHeight }
    })
    this.parent.yogaNode.insertChild(this.yogaNode, this.parent.yogaNode.getChildCount())
    if (this._src && !this.img) {
      this.loadImage(this._src)
    }
  }

  commit() {
    // ...
  }

  unmount() {
    if (this.ctx.world.network.isServer) return
    if (this.yogaNode) {
      this.parent.yogaNode?.removeChild(this.yogaNode)
      this.yogaNode.free()
      this.yogaNode = null
      this.box = null
      this.img = null
      this.ui?.redraw()
    }
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._display = source._display
    this._src = source._src
    this._width = source._width
    this._height = source._height
    this._objectFit = source._objectFit
    this._backgroundColor = source._backgroundColor
    return this
  }

  loadImage(src) {
    return new Promise(async (resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (!this.ui) return
        this.img = img
        this.yogaNode?.markDirty()
        this.ui?.redraw()
        resolve(img)
      }
      img.onerror = error => {
        console.error('uiimage: failed to load:', error)
        reject(error)
      }
      img.src = this.ctx?.world.resolveURL(src)
    })
  }

  calculateDrawParameters(imgWidth, imgHeight, containerWidth, containerHeight) {
    const aspectRatio = imgWidth / imgHeight
    switch (this._objectFit) {
      case 'cover': {
        // Scale to cover entire container while maintaining aspect ratio
        if (containerWidth / containerHeight > aspectRatio) {
          const width = containerWidth
          const height = width / aspectRatio
          return {
            width,
            height,
            x: 0,
            y: (containerHeight - height) / 2,
          }
        } else {
          const height = containerHeight
          const width = height * aspectRatio
          return {
            width,
            height,
            x: (containerWidth - width) / 2,
            y: 0,
          }
        }
      }
      case 'contain': {
        // Scale to fit within container while maintaining aspect ratio
        if (containerWidth / containerHeight > aspectRatio) {
          const height = containerHeight
          const width = height * aspectRatio
          return {
            width,
            height,
            x: (containerWidth - width) / 2,
            y: 0,
          }
        } else {
          const width = containerWidth
          const height = width / aspectRatio
          return {
            width,
            height,
            x: 0,
            y: (containerHeight - height) / 2,
          }
        }
      }
      case 'fill':
      default:
        // Stretch to fill container
        return {
          width: containerWidth,
          height: containerHeight,
          x: 0,
          y: 0,
        }
    }
  }

  get display() {
    return this._display
  }

  set display(value = defaults.display) {
    if (!isDisplay(value)) {
      throw new Error(`[uiimage] display invalid: ${value}`)
    }
    if (this._display === value) return
    this._display = value
    this.yogaNode?.setDisplay(Display[this._display])
    this.ui?.redraw()
  }

  get src() {
    return this._src
  }

  set src(value = defaults.src) {
    if (value !== null && !isString(value)) {
      throw new Error(`[uiimage] src not a string`)
    }
    if (this._src === value) return
    this._src = value
    if (this._src) {
      this.loadImage(this._src)
    } else {
      this.img = null
      this.ui?.redraw()
    }
  }

  get width() {
    return this._width
  }

  set width(value = defaults.width) {
    if (value !== null && !isNumber(value)) {
      throw new Error(`[uiimage] width not a number`)
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
      throw new Error(`[uiimage] height not a number`)
    }
    if (this._height === value) return
    this._height = value
    this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get objectFit() {
    return this._objectFit
  }

  set objectFit(value = defaults.objectFit) {
    if (!isObjectFit(value)) {
      throw new Error(`[uiimage] objectFit invalid: ${value}`)
    }
    if (this._objectFit === value) return
    this._objectFit = value
    this.ui?.redraw()
  }

  get backgroundColor() {
    return this._backgroundColor
  }

  set backgroundColor(value = defaults.backgroundColor) {
    if (value !== null && !isString(value)) {
      throw new Error(`[uiimage] backgroundColor not a string`)
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
      throw new Error('[uiimage] borderRadius not a number')
    }
    if (this._borderRadius === value) return
    this._borderRadius = value
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
        get objectFit() {
          return self.objectFit
        },
        set objectFit(value) {
          self.objectFit = value
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
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

function isObjectFit(value) {
  return objectFits.includes(value)
}
