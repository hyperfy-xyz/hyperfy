import Yoga from 'yoga-layout'
import { every, isArray, isBoolean, isNumber, isString } from 'lodash-es'
import { Node } from './Node'
import { Display, isDisplay } from '../extras/yoga'
import { fillRoundRect, imageRoundRect } from '../extras/roundRect'

const objectFits = ['contain', 'cover', 'fill']

const defaults = {
  display: 'flex',
  src: null,
  width: null,
  height: null,
  absolute: false,
  top: null,
  right: null,
  bottom: null,
  left: null,
  objectFit: 'contain',
  backgroundColor: null,
  borderRadius: 0,
  margin: 0,
}

export class UIImage extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'uiimage'

    this.display = data.display
    this.src = data.src
    this.width = data.width
    this.height = data.height
    this.absolute = data.absolute
    this.top = data.top
    this.right = data.right
    this.bottom = data.bottom
    this.left = data.left
    this.objectFit = data.objectFit
    this.backgroundColor = data.backgroundColor
    this.borderRadius = data.borderRadius
    this.margin = data.margin

    this.img = null
  }

  draw(ctx, offsetLeft, offsetTop) {
    if (this._display === 'none') return
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
        left,
        top,
        width,
        height,
        this._borderRadius * this.ui._res,
        this.img,
        left + drawParams.x,
        top + drawParams.y,
        drawParams.width,
        drawParams.height
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
    this.yogaNode.setPositionType(this._absolute ? Yoga.POSITION_TYPE_ABSOLUTE : Yoga.POSITION_TYPE_RELATIVE)
    this.yogaNode.setPosition(Yoga.EDGE_TOP, isNumber(this._top) ? this._top * this.ui._res : undefined)
    this.yogaNode.setPosition(Yoga.EDGE_RIGHT, isNumber(this._right) ? this._right * this.ui._res : undefined)
    this.yogaNode.setPosition(Yoga.EDGE_BOTTOM, isNumber(this._bottom) ? this._bottom * this.ui._res : undefined)
    this.yogaNode.setPosition(Yoga.EDGE_LEFT, isNumber(this._left) ? this._left * this.ui._res : undefined)
    if (isArray(this._margin)) {
      const [top, right, bottom, left] = this._margin
      this.yogaNode.setMargin(Yoga.EDGE_TOP, top * this.ui._res)
      this.yogaNode.setMargin(Yoga.EDGE_RIGHT, right * this.ui._res)
      this.yogaNode.setMargin(Yoga.EDGE_BOTTOM, bottom * this.ui._res)
      this.yogaNode.setMargin(Yoga.EDGE_LEFT, left * this.ui._res)
    } else {
      this.yogaNode.setMargin(Yoga.EDGE_ALL, this._margin * this.ui._res)
    }
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
    this.ui?.redraw()
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
    this._absolute = source._absolute
    this._top = source._top
    this._right = source._right
    this._bottom = source._bottom
    this._left = source._left
    this._objectFit = source._objectFit
    this._backgroundColor = source._backgroundColor
    this._margin = source._margin
    return this
  }

  async loadImage(src) {
    if (!this.ctx?.world) return
    const url = this.ctx.world.resolveURL(src)
    this.img = this.ctx.world.loader.get('image', url)
    if (!this.img) {
      this.img = await this.ctx.world.loader.load('image', url)
    }
    if (!this.ui) return
    this.yogaNode?.markDirty()
    this.ui?.redraw()
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

  get absolute() {
    return this._absolute
  }

  set absolute(value = defaults.absolute) {
    if (!isBoolean(value)) {
      throw new Error(`[uiimage] absolute not a boolean`)
    }
    if (this._absolute === value) return
    this._absolute = value
    this.yogaNode?.setPositionType(this._absolute ? Yoga.POSITION_TYPE_ABSOLUTE.ABSOLUTE : Yoga.POSITION_TYPE_RELATIVE)
    this.ui?.redraw()
  }

  get top() {
    return this._top
  }

  set top(value = defaults.top) {
    const isNum = isNumber(value)
    if (value !== null && !isNum) {
      throw new Error(`[uiimage] top must be a number or null`)
    }
    if (this._top === value) return
    this._top = value
    this.yogaNode?.setPosition(Yoga.EDGE_TOP, isNum ? this._top * this.ui._res : undefined)
    this.ui?.redraw()
  }

  get right() {
    return this._right
  }

  set right(value = defaults.right) {
    const isNum = isNumber(value)
    if (value !== null && !isNum) {
      throw new Error(`[uiimage] right must be a number or null`)
    }
    if (this._right === value) return
    this._right = value
    this.yogaNode?.setPosition(Yoga.EDGE_RIGHT, isNum ? this._right * this.ui._res : undefined)
    this.ui?.redraw()
  }

  get bottom() {
    return this._bottom
  }

  set bottom(value = defaults.bottom) {
    const isNum = isNumber(value)
    if (value !== null && !isNum) {
      throw new Error(`[uiimage] bottom must be a number or null`)
    }
    if (this._bottom === value) return
    this._bottom = value
    this.yogaNode?.setPosition(Yoga.EDGE_BOTTOM, isNum ? this._bottom * this.ui._res : undefined)
    this.ui?.redraw()
  }

  get left() {
    return this._left
  }

  set left(value = defaults.left) {
    const isNum = isNumber(value)
    if (value !== null && !isNum) {
      throw new Error(`[uiimage] left must be a number or null`)
    }
    if (this._left === value) return
    this._left = value
    this.yogaNode?.setPosition(Yoga.EDGE_LEFT, isNum ? this._left * this.ui._res : undefined)
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

  get margin() {
    return this._margin
  }

  set margin(value = defaults.margin) {
    if (!isEdge(value)) {
      throw new Error(`[uiimage] margin not a number or array of numbers`)
    }
    if (this._margin === value) return
    this._margin = value
    if (isArray(this._margin)) {
      const [top, right, bottom, left] = this._margin
      this.yogaNode?.setMargin(Yoga.EDGE_TOP, top * this.ui._res)
      this.yogaNode?.setMargin(Yoga.EDGE_RIGHT, right * this.ui._res)
      this.yogaNode?.setMargin(Yoga.EDGE_BOTTOM, bottom * this.ui._res)
      this.yogaNode?.setMargin(Yoga.EDGE_LEFT, left * this.ui._res)
    } else {
      this.yogaNode?.setMargin(Yoga.EDGE_ALL, this._margin * this.ui._res)
    }
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
        get absolute() {
          return self.absolute
        },
        set absolute(value) {
          self.absolute = value
        },
        get top() {
          return self.top
        },
        set top(value) {
          self.top = value
        },
        get right() {
          return self.right
        },
        set right(value) {
          self.right = value
        },
        get bottom() {
          return self.bottom
        },
        set bottom(value) {
          self.bottom = value
        },
        get left() {
          return self.left
        },
        set left(value) {
          self.left = value
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
        get margin() {
          return self.margin
        },
        set margin(value) {
          self.margin = value
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

function isEdge(value) {
  if (isNumber(value)) {
    return true
  }
  if (isArray(value)) {
    return value.length === 4 && every(value, n => isNumber(n))
  }
  return false
}
