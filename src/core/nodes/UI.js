import * as THREE from '../extras/three'
import { every, isArray, isBoolean, isNumber, isString } from 'lodash-es'
import Yoga from 'yoga-layout'

import { Node } from './Node'
import { fillRoundRect } from '../extras/roundRect'
import {
  AlignContent,
  AlignItems,
  FlexDirection,
  FlexWrap,
  isAlignContent,
  isAlignItem,
  isFlexDirection,
  isFlexWrap,
  isJustifyContent,
  JustifyContent,
} from '../extras/yoga'
import CustomShaderMaterial from '../libs/three-custom-shader-material'
import { borderRoundRect } from '../extras/borderRoundRect'

const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()
const v3 = new THREE.Vector3()
const q1 = new THREE.Quaternion()
const q2 = new THREE.Quaternion()
const m1 = new THREE.Matrix4()

const iQuaternion = new THREE.Quaternion(0, 0, 0, 1)
const iScale = new THREE.Vector3(1, 1, 1)

const spaces = ['world', 'screen']
const billboards = ['none', 'full', 'y']
const pivots = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

const defaults = {
  space: 'world',
  width: 100,
  height: 100,
  size: 0.01,
  res: 2,

  lit: false,
  doubleside: true,
  billboard: 'none',
  pivot: 'center',
  offset: [0, 0, 0],
  pointerEvents: true,

  transparent: true,
  backgroundColor: null,
  borderWidth: 0,
  borderColor: null,
  borderRadius: 0,
  padding: 0,
  flexDirection: 'column',
  justifyContent: 'flex-start',
  alignItems: 'stretch',
  alignContent: 'flex-start',
  flexWrap: 'no-wrap',
  gap: 0,
}

export class UI extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'ui'

    this.space = data.space
    this.width = data.width
    this.height = data.height
    this.size = data.size
    this.res = data.res

    this.lit = data.lit
    this.doubleside = data.doubleside
    this.billboard = data.billboard
    this.pivot = data.pivot
    this._offset = new THREE.Vector3().fromArray(data.offset || defaults.offset)
    this.pointerEvents = data.pointerEvents

    this.transparent = data.transparent
    this.backgroundColor = data.backgroundColor
    this.borderWidth = data.borderWidth
    this.borderColor = data.borderColor
    this.borderRadius = data.borderRadius
    this.padding = data.padding
    this.flexDirection = data.flexDirection
    this.justifyContent = data.justifyContent
    this.alignItems = data.alignItems
    this.alignContent = data.alignContent
    this.flexWrap = data.flexWrap
    this.gap = data.gap

    this.ui = this

    this._offset._onChange = () => this.rebuild()
  }

  build() {
    this.unbuild()
    this.canvas = document.createElement('canvas')
    this.canvas.width = this._width * this._res
    this.canvas.height = this._height * this._res
    this.canvasCtx = this.canvas.getContext('2d')
    if (this._space === 'world') {
      // world-space
      this.texture = new THREE.CanvasTexture(this.canvas)
      this.texture.colorSpace = THREE.SRGBColorSpace
      this.texture.anisotropy = this.ctx.world.graphics.maxAnisotropy
      // this.texture.minFilter = THREE.LinearFilter // or THREE.NearestFilter for pixel-perfect but potentially aliased text
      // this.texture.magFilter = THREE.LinearFilter
      // this.texture.generateMipmaps = true
      this.geometry = new THREE.PlaneGeometry(this._width, this._height)
      this.geometry.scale(this._size, this._size, this._size)
      pivotGeometry(this._pivot, this.geometry, this._width * this._size, this._height * this._size)
      this.pivotOffset = getPivotOffset(this._pivot, this._width, this._height)
      this.material = this.createMaterial(this._lit, this.texture, this._billboard, this._transparent, this._doubleside)
      this.mesh = new THREE.Mesh(this.geometry, this.material)
      this.mesh.matrixAutoUpdate = false
      this.mesh.matrixWorldAutoUpdate = false
      if (this._billboard !== 'none') {
        v1.setFromMatrixPosition(this.matrixWorld)
        this.mesh.matrixWorld.compose(v1, iQuaternion, iScale)
      } else {
        this.mesh.matrixWorld.copy(this.matrixWorld)
      }
      this.ctx.world.stage.scene.add(this.mesh)
      if (this._pointerEvents) {
        this.sItem = {
          matrix: this.matrixWorld,
          geometry: this.geometry,
          material: this.material,
          getEntity: () => this.ctx.entity,
          node: this,
        }
        this.ctx.world.stage.octree.insert(this.sItem)
      }
    } else {
      // screen-space
      this.canvas.style.position = 'absolute'
      this.canvas.style.width = this._width + 'px'
      this.canvas.style.height = this._height + 'px'
      pivotCanvas(this._pivot, this.canvas, this._width, this._height)
      this.canvas.style.left = `calc(${this.position.x * 100}% + ${this._offset.x}px)`
      this.canvas.style.top = `calc(${this.position.y * 100}% + ${this._offset.y}px)`
      this.canvas.style.pointerEvents = this._pointerEvents ? 'auto' : 'none'
      if (this._pointerEvents) {
        let hit
        const canvas = this.canvas
        const world = this.ctx.world
        const onPointerEnter = e => {
          hit = {
            node: this,
            coords: new THREE.Vector3(0, 0, 0),
          }
          world.pointer.setScreenHit(hit)
        }
        const onPointerMove = e => {
          const rect = canvas.getBoundingClientRect()
          const x = (e.clientX - rect.left) * this._res
          const y = (e.clientY - rect.top) * this._res
          hit.coords.x = x
          hit.coords.y = y
        }
        const onPointerLeave = e => {
          hit = null
          world.pointer.setScreenHit(null)
        }
        canvas.addEventListener('pointerenter', onPointerEnter)
        canvas.addEventListener('pointermove', onPointerMove)
        canvas.addEventListener('pointerleave', onPointerLeave)
        this.cleanupPointer = () => {
          if (hit) world.pointer.setScreenHit(null)
          canvas.removeEventListener('pointerenter', onPointerEnter)
          canvas.removeEventListener('pointermove', onPointerMove)
          canvas.removeEventListener('pointerleave', onPointerLeave)
        }
      }
      this.ctx.world.pointer.ui.prepend(this.canvas)
    }
    this.needsRebuild = false
  }

  unbuild() {
    if (this.mesh) {
      this.ctx.world.stage.scene.remove(this.mesh)
      this.texture.dispose()
      this.mesh.material.dispose()
      this.mesh.geometry.dispose()
      this.mesh = null
      this.canvas = null
      if (this.sItem) {
        this.ctx.world.stage.octree.remove(this.sItem)
        this.sItem = null
      }
    }
    if (this.canvas) {
      this.ctx.world.pointer.ui.removeChild(this.canvas)
      this.canvas = null
    }
    this.cleanupPointer?.()
    this.cleanupPointer = null
  }

  draw() {
    this.yogaNode.calculateLayout(this._width * this._res, this._height * this._res, Yoga.DIRECTION_LTR)
    const ctx = this.canvasCtx
    ctx.clearRect(0, 0, this._width * this._res, this._height * this._res)
    const left = this.yogaNode.getComputedLeft()
    const top = this.yogaNode.getComputedTop()
    const width = this.yogaNode.getComputedWidth()
    const height = this.yogaNode.getComputedHeight()
    if (this._backgroundColor) {
      // when theres a border, slightly inset to prevent bleeding
      const inset = this._borderColor && this._borderWidth ? 1 * this._res : 0
      const radius = this._borderRadius * this._res - inset
      const insetLeft = left + inset
      const insetTop = top + inset
      const insetWidth = width - inset * 2
      const insetHeight = height - inset * 2
      fillRoundRect(ctx, insetLeft, insetTop, insetWidth, insetHeight, radius, this._backgroundColor)
    }
    if (this._borderWidth && this._borderColor) {
      const radius = this._borderRadius * this._res
      const thickness = this._borderWidth * this._res
      ctx.strokeStyle = this._borderColor
      ctx.lineWidth = thickness
      if (this._borderRadius) {
        borderRoundRect(ctx, left, top, width, height, radius, thickness)
      } else {
        const insetLeft = left + thickness / 2
        const insetTop = top + thickness / 2
        const insetWidth = width - thickness
        const insetHeight = height - thickness
        ctx.strokeRect(insetLeft, insetTop, insetWidth, insetHeight)
      }
    }
    this.box = { left, top, width, height }
    this.children.forEach(child => child.draw(ctx, left, top))
    if (this.texture) this.texture.needsUpdate = true
    this.needsRedraw = false
  }

  mount() {
    if (this.ctx.world.network.isServer) return
    if (this.parent?.ui) return console.error('ui: cannot be nested inside another ui')
    this.yogaNode = Yoga.Node.create()
    this.yogaNode.setWidth(this._width * this._res)
    this.yogaNode.setHeight(this._height * this._res)
    this.yogaNode.setBorder(Yoga.EDGE_ALL, this._borderWidth * this._res)
    if (isArray(this._padding)) {
      const [top, right, bottom, left] = this._padding
      this.yogaNode.setPadding(Yoga.EDGE_TOP, top * this._res)
      this.yogaNode.setPadding(Yoga.EDGE_RIGHT, right * this._res)
      this.yogaNode.setPadding(Yoga.EDGE_BOTTOM, bottom * this._res)
      this.yogaNode.setPadding(Yoga.EDGE_LEFT, left * this._res)
    } else {
      this.yogaNode.setPadding(Yoga.EDGE_ALL, this._padding * this._res)
    }
    this.yogaNode.setFlexDirection(FlexDirection[this._flexDirection])
    this.yogaNode.setJustifyContent(JustifyContent[this._justifyContent])
    this.yogaNode.setAlignItems(AlignItems[this._alignItems])
    this.yogaNode.setAlignContent(AlignContent[this._alignContent])
    this.yogaNode.setFlexWrap(FlexWrap[this._flexWrap])
    this.yogaNode.setGap(Yoga.GUTTER_ALL, this._gap * this._res)
    this.build()
    this.needsRedraw = true
    this.setDirty()
  }

  commit(didMove) {
    if (this.ctx.world.network.isServer) {
      return
    }
    if (this.needsRebuild) {
      this.build()
    }
    if (this.needsRedraw) {
      this.draw()
    }
    if (didMove) {
      if (this._billboard !== 'none') {
        v1.setFromMatrixPosition(this.matrixWorld)
        this.mesh.matrixWorld.compose(v1, iQuaternion, iScale)
      } else {
        this.mesh.matrixWorld.copy(this.matrixWorld)
        this.ctx.world.stage.octree.move(this.sItem)
      }
    }
  }

  unmount() {
    if (this.ctx.world.network.isServer) return
    this.unbuild()
    this.needRebuild = false
    this.needsRedraw = false
    this.yogaNode?.free()
    this.yogaNode = null
    this.box = null
  }

  rebuild() {
    this.needsRebuild = true
    this.needsRedraw = true
    this.setDirty()
  }

  redraw() {
    this.needsRedraw = true
    this.setDirty()
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._space = source._space
    this._width = source._width
    this._height = source._height
    this._size = source._size
    this._res = source._res

    this._lit = source._lit
    this._doubleside = source._doubleside
    this._billboard = source._billboard
    this._pivot = source._pivot
    this._pointerEvents = source._pointerEvents

    this._transparent = source._transparent
    this._backgroundColor = source._backgroundColor
    this._borderWidth = source._borderWidth
    this._borderColor = source._borderColor
    this._borderRadius = source._borderRadius
    this._padding = source._padding
    this._flexDirection = source._flexDirection
    this._justifyContent = source._justifyContent
    this._alignItems = source._alignItems
    this._alignContent = source._alignContent
    this._flexWrap = source._flexWrap
    this._gap = source._gap
    return this
  }

  resolveHit(hit) {
    if (hit?.point) {
      const inverseMatrix = m1.copy(this.mesh.matrixWorld).invert()
      // convert world hit point to canvas coordinates (0,0 is top left x,y)
      v1.copy(hit.point)
        .applyMatrix4(inverseMatrix)
        .multiplyScalar(1 / this._size)
        .sub(this.pivotOffset)
      const x = v1.x * this._res
      const y = -v1.y * this._res
      return this.findNodeAt(x, y)
    }
    if (hit?.coords) {
      return this.findNodeAt(hit.coords.x, hit.coords.y)
    }
    return null
  }

  findNodeAt(x, y) {
    const findHitNode = (node, offsetX = 0, offsetY = 0) => {
      if (!node.box || node._display === 'none') return null
      const left = offsetX + node.box.left
      const top = offsetY + node.box.top
      const width = node.box.width
      const height = node.box.height
      if (x < left || x > left + width || y < top || y > top + height) {
        return null
      }
      // Check children from front to back
      for (let i = node.children.length - 1; i >= 0; i--) {
        const childHit = findHitNode(node.children[i], offsetX, offsetY)
        if (childHit) return childHit
      }
      return node
    }
    return findHitNode(this)
  }

  createMaterial(lit, texture, billboard, transparent, doubleside) {
    if (billboard === 'none') {
      const material = lit
        ? new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 })
        : new THREE.MeshBasicMaterial({})
      material.color.set('white')
      material.transparent = transparent
      material.map = texture
      material.side = doubleside ? THREE.DoubleSide : THREE.FrontSide
      this.ctx.world.setupMaterial(material)
      return material
    }
    const uniforms = {
      uBillboard: { value: billboard === 'full' ? 1 : billboard === 'y' ? 2 : 0 },
      uOrientation: { value: this.ctx.world.rig.quaternion },
    }
    const material = new CustomShaderMaterial({
      baseMaterial: lit ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial,
      ...(lit ? { roughness: 1, metalness: 0 } : {}),
      color: 'white',
      transparent,
      // depthTest: true,
      // depthWrite: false,
      map: texture,
      side: THREE.DoubleSide,
      uniforms,
      vertexShader: `
        uniform vec4 uOrientation;
        uniform int uBillboard; // 0: none, 1: full, 2: y

        vec3 applyQuaternion(vec3 pos, vec4 quat) {
          vec3 qv = vec3(quat.x, quat.y, quat.z);
          vec3 t = 2.0 * cross(qv, pos);
          return pos + quat.w * t + cross(qv, t);
        }

        void main() {
          if (uBillboard == 1) { 
             // full billboard
             csm_Position = applyQuaternion(position, uOrientation);
          } 
          else if (uBillboard == 2) { 
            // y-axis billboard
            vec3 objToCam = normalize(cameraPosition - modelMatrix[3].xyz);
            objToCam.y = 0.0; // Project onto XZ plane
            objToCam = normalize(objToCam);            
            float cosAngle = objToCam.z;
            float sinAngle = objToCam.x;            
            mat3 rotY = mat3(
              cosAngle, 0.0, -sinAngle,
              0.0, 1.0, 0.0,
              sinAngle, 0.0, cosAngle
            );            
            csm_Position = rotY * position;
          }
        }
      `,
    })
    this.ctx.world.setupMaterial(material)
    return material
  }

  get space() {
    return this._space
  }

  set space(value = defaults.space) {
    if (!isSpace(value)) {
      throw new Error('[ui] space not valid')
    }
    if (this._space === value) return
    this._space = value
    this.rebuild()
  }

  get width() {
    return this._width
  }

  set width(value = defaults.width) {
    if (!isNumber(value)) {
      throw new Error('[ui] width not a number')
    }
    if (this._width === value) return
    this._width = value
    this.yogaNode?.setWidth(this._width * this._res)
    this.rebuild()
  }

  get height() {
    return this._height
  }

  set height(value = defaults.height) {
    if (!isNumber(value)) {
      throw new Error('[ui] height not a number')
    }
    if (this._height === value) return
    this._height = value
    this.yogaNode?.setHeight(this._height * this._res)
    this.rebuild()
  }

  get size() {
    return this._size
  }

  set size(value = defaults.size) {
    if (!isNumber(value)) {
      throw new Error('[ui] size not a number')
    }
    if (this._size === value) return
    this._size = value
    this.rebuild()
  }

  get res() {
    return this._res
  }

  set res(value = defaults.res) {
    if (!isNumber(value)) {
      throw new Error('[ui] res not a number')
    }
    if (this._res === value) return
    this._res = value
    this.rebuild()
  }

  get lit() {
    return this._lit
  }

  set lit(value = defaults.lit) {
    if (!isBoolean(value)) {
      throw new Error('[ui] lit not a boolean')
    }
    if (this._lit === value) return
    this._lit = value
    this.rebuild()
  }

  get doubleside() {
    return this._doubleside
  }

  set doubleside(value = defaults.doubleside) {
    if (!isBoolean(value)) {
      throw new Error('[ui] doubleside not a boolean')
    }
    if (this._doubleside === value) return
    this._doubleside = value
    this.rebuild()
  }

  get billboard() {
    return this._billboard
  }

  set billboard(value = defaults.billboard) {
    if (!isBillboard(value)) {
      throw new Error(`[ui] billboard invalid: ${value}`)
    }
    if (this._billboard === value) return
    this._billboard = value
    this.rebuild()
  }

  get pivot() {
    return this._pivot
  }

  set pivot(value = defaults.pivot) {
    if (!isPivot(value)) {
      throw new Error(`[ui] pivot invalid: ${value}`)
    }
    if (this._pivot === value) return
    this._pivot = value
    this.rebuild()
  }

  get offset() {
    return this._offset
  }

  get pointerEvents() {
    return this._pointerEvents
  }

  set pointerEvents(value = defaults.pointerEvents) {
    if (!isBoolean(value)) {
      throw new Error('[ui] pointerEvents not a boolean')
    }
    if (this._pointerEvents === value) return
    this._pointerEvents = value
    this.redraw()
  }

  get transparent() {
    return this._transparent
  }

  set transparent(value = defaults.transparent) {
    if (!isBoolean(value)) {
      throw new Error('[ui] transparent not a boolean')
    }
    if (this._transparent === value) return
    this._transparent = value
    this.redraw()
  }

  get backgroundColor() {
    return this._backgroundColor
  }

  set backgroundColor(value = defaults.backgroundColor) {
    if (value !== null && !isString(value)) {
      throw new Error('[ui] backgroundColor not a string')
    }
    if (this._backgroundColor === value) return
    this._backgroundColor = value
    this.redraw()
  }

  get borderWidth() {
    return this._borderWidth
  }

  set borderWidth(value = defaults.borderWidth) {
    if (!isNumber(value)) {
      throw new Error('[ui] borderWidth not a number')
    }
    if (this._borderWidth === value) return
    this._borderWidth = value
    this.redraw()
  }

  get borderColor() {
    return this._borderColor
  }

  set borderColor(value = defaults.borderColor) {
    if (value !== null && !isString(value)) {
      throw new Error('[ui] borderColor not a string')
    }
    if (this._borderColor === value) return
    this._borderColor = value
    this.redraw()
  }

  get borderRadius() {
    return this._borderRadius
  }

  set borderRadius(value = defaults.borderRadius) {
    if (!isNumber(value)) {
      throw new Error('[ui] borderRadius not a number')
    }
    if (this._borderRadius === value) return
    this._borderRadius = value
    this.redraw()
  }

  get padding() {
    return this._padding
  }

  set padding(value = defaults.padding) {
    if (!isEdge(value)) {
      throw new Error(`[ui] padding not a number or array of numbers`)
    }
    if (this._padding === value) return
    this._padding = value
    if (isArray(this._padding)) {
      const [top, right, bottom, left] = this._padding
      this.yogaNode?.setPadding(Yoga.EDGE_TOP, top * this._res)
      this.yogaNode?.setPadding(Yoga.EDGE_RIGHT, right * this._res)
      this.yogaNode?.setPadding(Yoga.EDGE_BOTTOM, bottom * this._res)
      this.yogaNode?.setPadding(Yoga.EDGE_LEFT, left * this._res)
    } else {
      this.yogaNode?.setPadding(Yoga.EDGE_ALL, this._padding * this._res)
    }
    this.redraw()
  }

  get flexDirection() {
    return this._flexDirection
  }

  set flexDirection(value = defaults.flexDirection) {
    if (!isFlexDirection(value)) {
      throw new Error(`[ui] flexDirection invalid: ${value}`)
    }
    if (this._flexDirection === value) return
    this._flexDirection = value
    this.yogaNode?.setFlexDirection(FlexDirection[this._flexDirection])
    this.redraw()
  }

  get justifyContent() {
    return this._justifyContent
  }

  set justifyContent(value = defaults.justifyContent) {
    if (!isJustifyContent(value)) {
      throw new Error(`[ui] justifyContent invalid: ${value}`)
    }
    if (this._justifyContent === value) return
    this._justifyContent = value
    this.yogaNode?.setJustifyContent(JustifyContent[this._justifyContent])
    this.redraw()
  }

  get alignItems() {
    return this._alignItems
  }

  set alignItems(value = defaults.alignItems) {
    if (!isAlignItem(value)) {
      throw new Error(`[ui] alignItems invalid: ${value}`)
    }
    if (this._alignItems === value) return
    this._alignItems = value
    this.yogaNode?.setAlignItems(AlignItems[this._alignItems])
    this.redraw()
  }

  get alignContent() {
    return this._alignContent
  }

  set alignContent(value = defaults.alignContent) {
    if (!isAlignContent(value)) {
      throw new Error(`[ui] alignContent invalid: ${value}`)
    }
    if (this._alignContent === value) return
    this._alignContent = value
    this.yogaNode?.setAlignContent(AlignContent[this._alignContent])
    this.redraw()
  }

  get flexWrap() {
    return this.flexWrap
  }

  set flexWrap(value = defaults.flexWrap) {
    if (!isFlexWrap(value)) {
      throw new Error(`[uiview] flexWrap invalid: ${value}`)
    }
    if (this._flexWrap === value) return
    this._flexWrap = value
    this.yogaNode?.setFlexWrap(FlexWrap[this._flexWrap])
    this.redraw()
  }

  get gap() {
    return this._gap
  }

  set gap(value = defaults.gap) {
    if (!isNumber(value)) {
      throw new Error(`[uiview] gap not a number`)
    }
    if (this._gap === value) return
    this._gap = value
    this.yogaNode?.setGap(Yoga.GUTTER_ALL, this._gap * this._res)
    this.redraw()
  }

  getProxy() {
    if (!this.proxy) {
      var self = this
      let proxy = {
        get space() {
          return self.space
        },
        set space(value) {
          self.space = value
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
        get size() {
          return self.size
        },
        set size(value) {
          self.size = value
        },
        get res() {
          return self.res
        },
        set res(value) {
          self.res = value
        },
        get lit() {
          return self.lit
        },
        set lit(value) {
          self.lit = value
        },
        get doubleside() {
          return self.doubleside
        },
        set doubleside(value) {
          self.doubleside = value
        },
        get billboard() {
          return self.billboard
        },
        set billboard(value) {
          self.billboard = value
        },
        get pivot() {
          return self.pivot
        },
        set pivot(value) {
          self.pivot = value
        },
        get offset() {
          return self.offset
        },
        get pointerEvents() {
          return self.pointerEvents
        },
        set pointerEvents(value) {
          self.pointerEvents = value
        },
        get transparent() {
          return self.transparent
        },
        set transparent(value) {
          self.transparent = value
        },
        get backgroundColor() {
          return self.backgroundColor
        },
        set backgroundColor(value) {
          self.backgroundColor = value
        },
        get borderWidth() {
          return self.borderWidth
        },
        set borderWidth(value) {
          self.borderWidth = value
        },
        get borderColor() {
          return self.borderColor
        },
        set borderColor(value) {
          self.borderColor = value
        },
        get borderRadius() {
          return self.borderRadius
        },
        set borderRadius(value) {
          self.borderRadius = value
        },
        get padding() {
          return self.padding
        },
        set padding(value) {
          self.padding = value
        },
        get flexDirection() {
          return self.flexDirection
        },
        set flexDirection(value) {
          self.flexDirection = value
        },
        get justifyContent() {
          return self.justifyContent
        },
        set justifyContent(value) {
          self.justifyContent = value
        },
        get alignItems() {
          return self.alignItems
        },
        set alignItems(value) {
          self.alignItems = value
        },
        get alignContent() {
          return self.alignContent
        },
        set alignContent(value) {
          self.alignContent = value
        },
        get flexWrap() {
          return self.flexWrap
        },
        set flexWrap(value) {
          self.flexWrap = value
        },
        get gap() {
          return self.gap
        },
        set gap(value) {
          self.gap = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

function pivotGeometry(pivot, geometry, width, height) {
  const halfWidth = width / 2
  const halfHeight = height / 2
  switch (pivot) {
    case 'top-left':
      geometry.translate(halfWidth, -halfHeight, 0)
      break
    case 'top-center':
      geometry.translate(0, -halfHeight, 0)
      break
    case 'top-right':
      geometry.translate(-halfWidth, -halfHeight, 0)
      break
    case 'center-left':
      geometry.translate(halfWidth, 0, 0)
      break
    case 'center-right':
      geometry.translate(-halfWidth, 0, 0)
      break
    case 'bottom-left':
      geometry.translate(halfWidth, halfHeight, 0)
      break
    case 'bottom-center':
      geometry.translate(0, halfHeight, 0)
      break
    case 'bottom-right':
      geometry.translate(-halfWidth, halfHeight, 0)
      break
    case 'center':
    default:
      break
  }
}

function pivotCanvas(pivot, canvas, width, height) {
  // const halfWidth = width / 2
  // const halfHeight = height / 2
  switch (pivot) {
    case 'top-left':
      canvas.style.transform = `translate(0%, 0%)`
      break
    case 'top-center':
      canvas.style.transform = `translate(-50%, 0%)`
      break
    case 'top-right':
      canvas.style.transform = `translate(-100%, 0%)`
      break
    case 'center-left':
      canvas.style.transform = `translate(0%, -50%)`
      break
    case 'center-right':
      canvas.style.transform = `translate(-100%, -50%)`
      break
    case 'bottom-left':
      canvas.style.transform = `translate(0%, -100%)`
      break
    case 'bottom-center':
      canvas.style.transform = `translate(-50%, -100%)`
      break
    case 'bottom-right':
      canvas.style.transform = `translate(-100%, -100%)`
      break
    case 'center':
    default:
      canvas.style.transform = `translate(-50%, -50%)`
      break
  }
}

function isBillboard(value) {
  return billboards.includes(value)
}

function isPivot(value) {
  return pivots.includes(value)
}

function isSpace(value) {
  return spaces.includes(value)
}

// pivotOffset == ( - pivotX, - pivotY )
// i.e., the negative of whatever pivotGeometry just did.
function getPivotOffset(pivot, width, height) {
  // The top-left corner is originally (-halfW, +halfH).
  // Then pivotGeometry adds the following translation:
  const halfW = width / 2
  const halfH = height / 2
  let tx = 0,
    ty = 0
  switch (pivot) {
    case 'top-left':
      tx = +halfW
      ty = -halfH
      break
    case 'top-center':
      tx = 0
      ty = -halfH
      break
    case 'top-right':
      tx = -halfW
      ty = -halfH
      break
    case 'center-left':
      tx = +halfW
      ty = 0
      break
    case 'center-right':
      tx = -halfW
      ty = 0
      break
    case 'bottom-left':
      tx = +halfW
      ty = +halfH
      break
    case 'bottom-center':
      tx = 0
      ty = +halfH
      break
    case 'bottom-right':
      tx = -halfW
      ty = +halfH
      break
    case 'center':
    default:
      tx = 0
      ty = 0
      break
  }

  // So the final local coordinate of top-left corner is:
  //   originalTopLeft + pivotTranslation
  // = (-halfW + tx, +halfH + ty)
  return new THREE.Vector2(-halfW + tx, +halfH + ty)
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
