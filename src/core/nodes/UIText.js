import Yoga from 'yoga-layout'
import { isNumber, isString } from 'lodash-es'

import { Node } from './Node'
import { Display, isDisplay } from '../extras/yoga'
import { fillRoundRect } from '../extras/roundRect'

const textAligns = ['left', 'center', 'right']

const defaults = {
  display: 'flex',
  backgroundColor: null,
  borderRadius: 0,
  margin: 0,
  padding: 0,
  value: '',
  fontSize: 16,
  color: '#000000',
  lineHeight: 1.2,
  textAlign: 'left',
  fontFamily: 'Rubik',
  fontWeight: 'normal',
}

let offscreenContext
const getOffscreenContext = () => {
  if (!offscreenContext) {
    const offscreenCanvas = document.createElement('canvas')
    offscreenContext = offscreenCanvas.getContext('2d')
  }
  return offscreenContext
}

export class UIText extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'uitext'

    this.display = data.display
    this.backgroundColor = data.backgroundColor
    this.borderRadius = data.borderRadius
    this.margin = data.margin
    this.padding = data.padding
    this.value = data.value
    this.fontSize = data.fontSize
    this.color = data.color
    this.lineHeight = data.lineHeight
    this.textAlign = data.textAlign
    this.fontFamily = data.fontFamily
    this.fontWeight = data.fontWeight
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
    ctx.font = `${this._fontWeight} ${this._fontSize * this.ui._res}px ${this._fontFamily}`
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = this._textAlign
    ctx.fillStyle = this._color
    ctx.fillStyle = this._color
    const paddingLeft = this.yogaNode.getComputedPadding(Yoga.EDGE_LEFT)
    const paddingTop = this.yogaNode.getComputedPadding(Yoga.EDGE_TOP)
    const paddingRight = this.yogaNode.getComputedPadding(Yoga.EDGE_RIGHT)
    const innerWidth = width - paddingLeft - paddingRight
    let innerX = left + paddingLeft
    if (this._textAlign === 'center') {
      innerX = left + width / 2
    } else if (this._textAlign === 'right') {
      innerX = left + width - paddingRight
    }
    const lines = wrapText(ctx, this._value, innerWidth)
    let currentBaselineY = 0
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const isFirst = i === 0
      const metrics = ctx.measureText(line)
      const ascent = metrics.actualBoundingBoxAscent
      const descent = metrics.actualBoundingBoxDescent
      const naturalLineHeight = ascent + descent
      const baselineGap = naturalLineHeight * this._lineHeight
      if (isFirst) currentBaselineY += top + paddingTop + metrics.actualBoundingBoxAscent
      ctx.fillText(line, innerX, currentBaselineY)
      currentBaselineY += baselineGap
    }
    this.box = { left, top, width, height }
  }

  mount() {
    if (this.ctx.world.network.isServer) return
    this.ui = this.parent?.ui
    if (!this.ui) return console.error('uitext: must be child of ui node')
    this.yogaNode = Yoga.Node.create()
    this.yogaNode.setMeasureFunc(this.measureTextFunc())
    this.yogaNode.setDisplay(Display[this._display])
    this.yogaNode.setMargin(Yoga.EDGE_ALL, this._margin * this.ui._res)
    this.yogaNode.setPadding(Yoga.EDGE_ALL, this._padding * this.ui._res)
    this.parent.yogaNode.insertChild(this.yogaNode, this.parent.yogaNode.getChildCount())
  }

  commit(didMove) {
    // ...
  }

  unmount() {
    if (this.ctx.world.network.isServer) return
    if (this.yogaNode) {
      this.parent.yogaNode?.removeChild(this.yogaNode)
      this.yogaNode.free()
      this.yogaNode = null
      this.box = null
    }
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._display = source._display
    this._backgroundColor = source._backgroundColor
    this._borderRadius = source._borderRadius
    this._margin = source._margin
    this._padding = source._padding
    this._value = source._value
    this._fontSize = source._fontSize
    this._color = source._color
    this._lineHeight = source._lineHeight
    this._textAlign = source._textAlign
    this._fontFamily = source._fontFamily
    this._fontWeight = source._fontWeight
    return this
  }

  measureTextFunc() {
    const ctx = getOffscreenContext()
    return (width, widthMode, height, heightMode) => {
      ctx.font = `${this._fontWeight} ${this._fontSize * this.ui._res}px ${this._fontFamily}`
      ctx.textBaseline = 'alphabetic'
      let lines
      if (widthMode === Yoga.MEASURE_MODE_EXACTLY || widthMode === Yoga.MEASURE_MODE_AT_MOST) {
        lines = wrapText(ctx, this._value, width)
      } else {
        lines = [this._value]
      }
      let finalHeight = 0
      let finalWidth = 0
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const isFirst = i === 0
        const isLast = i === lines.length - 1
        const metrics = ctx.measureText(line)
        const ascent = metrics.actualBoundingBoxAscent
        const descent = metrics.actualBoundingBoxDescent
        const naturalLineHeight = ascent + descent
        if (metrics.width > finalWidth) {
          finalWidth = metrics.width
        }
        if (isLast) {
          finalHeight += naturalLineHeight
        } else {
          finalHeight += naturalLineHeight * this._lineHeight
        }
      }
      if (widthMode === Yoga.MEASURE_MODE_AT_MOST) {
        finalWidth = Math.min(finalWidth, width)
      }
      return { width: finalWidth, height: finalHeight }
    }
  }

  get display() {
    return this._display
  }

  set display(value = defaults.display) {
    if (!isDisplay(value)) {
      throw new Error(`[uitext] display invalid: ${value}`)
    }
    if (this._display === value) return
    this._display = value
    this.yogaNode?.setDisplay(Display[this._display])
    this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get backgroundColor() {
    return this._backgroundColor
  }

  set backgroundColor(value = defaults.backgroundColor) {
    if (value !== null && !isString(value)) {
      throw new Error(`[uiview] backgroundColor not a string`)
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
      throw new Error(`[uiview] borderRadius not a number`)
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
      throw new Error(`[uiview] margin not a number`)
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
      throw new Error(`[uiview] padding not a number`)
    }
    if (this._padding === value) rturn
    this._padding = value
    this.yogaNode?.setPadding(Yoga.EDGE_ALL, this._padding * this.ui._res)
    this.ui?.redraw()
  }

  get value() {
    return this._value
  }

  set value(val = defaults.value) {
    if (isNumber(val)) {
      val = val + ''
    }
    if (!isString(val)) {
      throw new Error(`[uitext] value not a string`)
    }
    if (this._value === val) return
    this._value = val
    this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get fontSize() {
    return this._fontSize
  }

  set fontSize(value = defaults.fontSize) {
    if (!isNumber(value)) {
      throw new Error(`[uitext] fontSize not a number`)
    }
    if (this._fontSize === value) return
    this._fontSize = value
    this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get color() {
    return this._color
  }

  set color(value = defaults.color) {
    if (!isString(value)) {
      throw new Error(`[uitext] color not a string`)
    }
    if (this._color === value) return
    this._color = value
    this.ui?.redraw()
  }

  get lineHeight() {
    return this._lineHeight
  }

  set lineHeight(value = defaults.lineHeight) {
    if (!isNumber(value)) {
      throw new Error(`[uitext] lineHeight not a number`)
    }
    if (this._lineHeight === value) return
    this._lineHeight = value
    this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get textAlign() {
    return this._textAlign
  }

  set textAlign(value = defaults.textAlign) {
    if (!isTextAlign(value)) {
      throw new Error(`[uitext] textAlign invalid: ${value}`)
    }
    if (this._textAlign === value) return
    this._textAlign = value
    this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get fontFamily() {
    return this._fontFamily
  }

  set fontFamily(value = defaults.fontFamily) {
    if (!isString(value)) {
      throw new Error(`[uitext] fontFamily not a string`)
    }
    if (this._fontFamily === value) return
    this._fontFamily = value
    this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get fontWeight() {
    return this._fontWeight
  }

  set fontWeight(value = defaults.fontWeight) {
    if (!isString(value) && !isNumber(value)) {
      throw new Error(`[uitext] fontWeight invalid`)
    }
    if (this._fontWeight === value) return
    this._fontWeight = value
    this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  getProxy() {
    var self = this
    if (!this.proxy) {
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
        get value() {
          return self.value
        },
        set value(value) {
          self.value = value
        },
        get fontSize() {
          return self.fontSize
        },
        set fontSize(value) {
          self.fontSize = value
        },
        get color() {
          return self.color
        },
        set color(value) {
          self.color = value
        },
        get lineHeight() {
          return self.lineHeight
        },
        set lineHeight(value) {
          self.lineHeight = value
        },
        get textAlign() {
          return self.textAlign
        },
        set textAlign(value) {
          self.textAlign = value
        },
        get fontFamily() {
          return self.fontFamily
        },
        set fontFamily(value) {
          self.fontFamily = value
        },
        get fontWeight() {
          return self.fontWeight
        },
        set fontWeight(value) {
          self.fontWeight = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let currentLine = words[0]

  for (let i = 1; i < words.length; i++) {
    const word = words[i]
    const width = ctx.measureText(currentLine + ' ' + word).width
    if (width <= maxWidth) {
      currentLine += ' ' + word
    } else {
      lines.push(currentLine)
      currentLine = word
    }
  }
  lines.push(currentLine)

  return lines
}

function isTextAlign(value) {
  return textAligns.includes(value)
}
