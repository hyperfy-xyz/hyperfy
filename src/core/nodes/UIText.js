import Yoga from 'yoga-layout'
import { every, isArray, isBoolean, isNumber, isString } from 'lodash-es'

import { Node } from './Node'
import { Display, isDisplay } from '../extras/yoga'
import { fillRoundRect } from '../extras/roundRect'

const textAligns = ['left', 'center', 'right']

const defaults = {
  display: 'flex',
  absolute: false,
  top: null,
  right: null,
  bottom: null,
  left: null,
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
  flexBasis: 'auto',
  flexGrow: 0,
  flexShrink: 1,
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
    this.absolute = data.absolute
    this.top = data.top
    this.right = data.right
    this.bottom = data.bottom
    this.left = data.left
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
    this.flexBasis = data.flexBasis
    this.flexGrow = data.flexGrow
    this.flexShrink = data.flexShrink
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
    if (isArray(this._padding)) {
      const [top, right, bottom, left] = this._padding
      this.yogaNode.setPadding(Yoga.EDGE_TOP, top * this.ui._res)
      this.yogaNode.setPadding(Yoga.EDGE_RIGHT, right * this.ui._res)
      this.yogaNode.setPadding(Yoga.EDGE_BOTTOM, bottom * this.ui._res)
      this.yogaNode.setPadding(Yoga.EDGE_LEFT, left * this.ui._res)
    } else {
      this.yogaNode.setPadding(Yoga.EDGE_ALL, this._padding * this.ui._res)
    }
    this.yogaNode.setFlexBasis(this._flexBasis)
    this.yogaNode.setFlexGrow(this._flexGrow)
    this.yogaNode.setFlexShrink(this._flexShrink)
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
    this._absolute = source._absolute
    this._top = source._top
    this._right = source._right
    this._bottom = source._bottom
    this._left = source._left
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
    this._flexBasis = source._flexBasis
    this._flexGrow = source._flexGrow
    this._flexShrink = source._flexShrink
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

  get absolute() {
    return this._absolute
  }

  set absolute(value = defaults.absolute) {
    if (!isBoolean(value)) {
      throw new Error(`[uitext] absolute not a boolean`)
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
      throw new Error(`[uitext] top must be a number or null`)
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
      throw new Error(`[uitext] right must be a number or null`)
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
      throw new Error(`[uitext] bottom must be a number or null`)
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
      throw new Error(`[uitext] left must be a number or null`)
    }
    if (this._left === value) return
    this._left = value
    this.yogaNode?.setPosition(Yoga.EDGE_LEFT, isNum ? this._left * this.ui._res : undefined)
    this.ui?.redraw()
  }

  get backgroundColor() {
    return this._backgroundColor
  }

  set backgroundColor(value = defaults.backgroundColor) {
    if (value !== null && !isString(value)) {
      throw new Error(`[uitext] backgroundColor not a string`)
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
      throw new Error(`[uitext] borderRadius not a number`)
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
      throw new Error(`[uitext] margin not a number or array of numbers`)
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

  get padding() {
    return this._padding
  }

  set padding(value = defaults.padding) {
    if (!isEdge(value)) {
      throw new Error(`[uitext] padding not a number or array of numbers`)
    }
    if (this._padding === value) rturn
    this._padding = value
    if (isArray(this._padding)) {
      const [top, right, bottom, left] = this._padding
      this.yogaNode?.setPadding(Yoga.EDGE_TOP, top * this.ui._res)
      this.yogaNode?.setPadding(Yoga.EDGE_RIGHT, right * this.ui._res)
      this.yogaNode?.setPadding(Yoga.EDGE_BOTTOM, bottom * this.ui._res)
      this.yogaNode?.setPadding(Yoga.EDGE_LEFT, left * this.ui._res)
    } else {
      this.yogaNode?.setPadding(Yoga.EDGE_ALL, this._padding * this.ui._res)
    }
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

  get flexBasis() {
    return this._flexBasis
  }

  set flexBasis(value = defaults.flexBasis) {
    if (!isNumber(value) && !isString(value)) {
      throw new Error(`[uitext] flexBasis invalid`)
    }
    if (this._flexBasis === value) return
    this._flexBasis = value
    this.yogaNode?.setFlexBasis(this._flexBasis)
    this.ui?.redraw()
  }

  get flexGrow() {
    return this._flexGrow
  }

  set flexGrow(value = defaults.flexGrow) {
    if (!isNumber(value)) {
      throw new Error(`[uitext] flexGrow not a number`)
    }
    if (this._flexGrow === value) return
    this._flexGrow = value
    this.yogaNode?.setFlexGrow(this._flexGrow)
    this.ui?.redraw()
  }

  get flexShrink() {
    return this._flexShrink
  }

  set flexShrink(value = defaults.flexShrink) {
    if (!isNumber(value)) {
      throw new Error(`[uitext] flexShrink not a number`)
    }
    if (this._flexShrink === value) return
    this._flexShrink = value
    this.yogaNode?.setFlexShrink(this._flexShrink)
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
        get flexBasis() {
          return self.flexBasis
        },
        set flexBasis(value) {
          self.flexBasis = value
        },
        get flexGrow() {
          return self.flexGrow
        },
        set flexGrow(value) {
          self.flexGrow = value
        },
        get flexShrink() {
          return self.flexShrink
        },
        set flexShrink(value) {
          self.flexShrink = value
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

function isEdge(value) {
  if (isNumber(value)) {
    return true
  }
  if (isArray(value)) {
    return value.length === 4 && every(value, n => isNumber(n))
  }
  return false
}
