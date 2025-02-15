import * as THREE from 'three'

import { System } from './System'
import { ControlPriorities } from '../extras/ControlPriorities'

const BATCH_SIZE = 500

export class ClientActions extends System {
  constructor(world) {
    super(world)
    this.nodes = []
    this.cursor = 0
    this.current = {
      node: null,
      distance: Infinity,
    }
    this.action = null
  }

  start() {
    this.action = createAction(this.world)
    this.btnDown = false
    this.control = this.world.controls.bind({ priority: ControlPriorities.ACTION })
  }

  register(node) {
    this.nodes.push(node)
  }

  unregister(node) {
    const idx = this.nodes.indexOf(node)
    if (idx === -1) return
    this.nodes.splice(idx, 1)
    if (this.current.node === node) {
      this.current.node = null
      this.current.distance = Infinity
      this.action.stop()
    }
  }

  update(delta) {
    const cameraPos = this.world.rig.position

    this.btnDown = this.control.keyE.down

    // clear current action if its no longer in distance
    if (this.current.node) {
      const distance = this.current.node.worldPos.distanceTo(cameraPos)
      if (distance > this.current.node._distance) {
        this.current.node = null
        this.current.distance = Infinity
        this.action.stop()
      } else {
        this.current.distance = distance
      }
    }

    // continually check nodes[] in batches to find the one that should be active
    let didChange
    const size = Math.min(this.nodes.length, BATCH_SIZE)
    for (let i = 0; i < size; i++) {
      const idx = (this.cursor + i) % this.nodes.length
      const node = this.nodes[idx]
      if (node.finished) continue
      if (this.current.node === node) continue
      const distance = node.worldPos.distanceTo(cameraPos)
      if (distance <= node._distance && distance < this.current.distance) {
        this.current.node = node
        this.current.distance = distance
        didChange = true
      }
    }
    if (size) {
      this.cursor = (this.cursor + size) % this.nodes.length
    }
    if (didChange) {
      this.action.start(this.current.node)
    }
    this.action.update(delta)
  }

  destroy() {
    this.control.release()
    this.control = null
  }
}

function createAction(world) {
  const widthPx = 300
  const heightPx = 44
  const pxToMeters = 0.01
  const board = createBoard(widthPx, heightPx, pxToMeters, world)

  const draw = (label, ratio) => {
    // console.time('draw')
    const text = board.measureText(47, heightPx / 2, label, '#ffffff', 18, 400)
    const pillWidth = 6 + 4 + 24 + 4 + 6 + 9 + text.width + 13
    const left = (widthPx - pillWidth) / 2
    board.clear()
    board.drawBox(left, 0, pillWidth, heightPx, heightPx / 2, '#000000')
    board.drawPie(left + 6, 6, 16, 100, '#484848') // grey
    board.drawPie(left + 6, 6, 16, ratio * 100, '#ffffff') // white
    board.drawCircle(left + 10, 10, 12, '#000000') // inner
    board.drawText(left + 16, 14, 'E', '#ffffff', 18, 400) // E
    board.drawText(left + 47, 14, label, '#ffffff', 18, 400) // label
    board.commit()
    // console.timeEnd('draw')
  }

  const mesh = board.getMesh()

  // debug
  // board.canvas.style = 'position:absolute; top:70px; left:30px; z-index:999; pointer-events:none; transform:scale(1); transform-origin:top left;' // prettier-ignore
  // document.body.appendChild(board.canvas)

  let node = null
  let cancelled = false

  return {
    start(_node) {
      if (node) console.error('erm node already set')
      node = _node
      world.actions.btnDown = false
      node.progress = 0
      draw(node._label, node.progress / node._duration)
      world.stage.scene.add(mesh)
    },
    update(delta) {
      if (!node) return
      mesh.position.setFromMatrixPosition(node.matrixWorld)
      mesh.quaternion.setFromRotationMatrix(world.camera.matrixWorld)
      world.graphics.scaleUI(mesh, heightPx, pxToMeters)
      if (world.actions.btnDown) {
        if (node.progress === 0) {
          cancelled = false
          try {
            node._onStart()
          } catch (err) {
            console.error('action.onStart:', err)
          }
        }
        node.progress += delta
        if (node.progress > node._duration) node.progress = node._duration
        draw(node._label, node.progress / node._duration)
        if (node.progress === node._duration) {
          node.progress = 0
          try {
            node._onTrigger()
          } catch (err) {
            console.error('action.onTrigger:', err)
          }
        }
      } else if (node.progress > 0) {
        if (!cancelled) {
          try {
            node._onCancel()
          } catch (err) {
            console.error('action.onCancel:', err)
          }
          cancelled = true
        }
        node.progress -= delta
        if (node.progress < 0) node.progress = 0
        draw(node._label, node.progress / node._duration)
      }
    },
    stop() {
      node = null
      if (mesh.parent) {
        world.stage.scene.remove(mesh)
      }
    },
  }
}

const sizes = [128, 256, 512, 2048, 4096]

function createBoard(width, height, pxToMeters, world) {
  const max = Math.max(width, height)
  const size = sizes.find(size => size >= max)
  const pr = 1 // window.devicePixelRatio
  const canvas = document.createElement('canvas')
  canvas.width = size * pr
  canvas.height = size * pr
  // console.log('board', canvas.width, canvas.height)
  const ctx = canvas.getContext('2d')

  let texture
  let mesh

  return {
    canvas,
    drawBox(x, y, width, height, radius, color) {
      x *= pr
      y *= pr
      width *= pr
      height *= pr
      radius *= pr
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x + radius, y) // start left center
      ctx.arcTo(x + width, y, x + width, y + height, radius) // right edge
      ctx.arcTo(x + width, y + height, x, y + height, radius) // bottom edge
      ctx.arcTo(x, y + height, x, y, radius) // left edge
      ctx.arcTo(x, y, x + width, y, radius) // top edge
      ctx.closePath()
      ctx.fill()
    },
    drawCircle(x, y, radius, color) {
      x *= pr
      y *= pr
      radius *= pr
      const centerX = x + radius
      const centerY = y + radius
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()
    },
    drawPie(x, y, radius, percent, color, offset = 0) {
      x *= pr
      y *= pr
      radius *= pr
      const offsetRadians = (offset * Math.PI) / 180
      const startAngle = -0.5 * Math.PI + offsetRadians
      const endAngle = startAngle + (percent / 100) * 2 * Math.PI
      ctx.beginPath()
      ctx.moveTo(x + radius, y + radius)
      ctx.arc(x + radius, y + radius, radius, startAngle, endAngle)
      ctx.lineTo(x + radius, y + radius)
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
    },
    measureText(x, y, text, color, fontSize = 16, fontWeight = 400, font = 'Rubik') {
      fontSize *= pr
      ctx.font = `${fontWeight} ${fontSize}px ${font}`
      const metrics = ctx.measureText(text)
      return {
        width: metrics.width / pr,
      }
    },
    drawText(x, y, text, color, fontSize = 16, fontWeight = 400, font = 'Rubik') {
      x *= pr
      y *= pr
      // y -= fontSize / 2 // no idea why but yup
      fontSize *= pr
      ctx.fillStyle = color
      ctx.font = `${fontWeight} ${fontSize}px ${font}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(text, x, y)
    },
    getMesh() {
      if (mesh) return mesh
      const offsetX = 0 // top left for now
      const offsetY = 0
      texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = world.graphics.maxAnisotropy
      // texture.minFilter = texture.magFilter = THREE.LinearFilter
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      // texture.generateMipmaps = false
      const geometry = new THREE.BufferGeometry()
      const halfWidth = (width * pxToMeters) / 2
      const halfHeight = (height * pxToMeters) / 2
      // prettier-ignore
      const vertices = new Float32Array([
        halfWidth, -halfHeight, 0,  // vertex 3 (bottom right)
        halfWidth, halfHeight, 0,   // vertex 2 (top right)
        -halfWidth, halfHeight, 0,  // vertex 1 (top left)
        -halfWidth, -halfHeight, 0, // vertex 0 (bottom left)
      ])
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
      const uvX1 = offsetX / size
      const uvY1 = 1 - offsetY / size
      const uvX2 = (offsetX + width) / size
      const uvY2 = 1 - (offsetY + height) / size
      // prettier-ignore
      const uvs = new Float32Array([
        uvX2, uvY2,  // UV for vertex 3
        uvX2, uvY1,  // UV for vertex 2
        uvX1, uvY1,  // UV for vertex 1
        uvX1, uvY2,  // UV for vertex 0
      ])
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
      // prettier-ignore
      const indices = new Uint16Array([
        0, 1, 2,  // First triangle
        2, 3, 0   // Second triangle
      ])
      geometry.setIndex(new THREE.BufferAttribute(indices, 1))
      const material = new THREE.MeshBasicMaterial({ map: texture })
      material.toneMapped = false
      // create mesh
      mesh = new THREE.Mesh(geometry, material)
      // console.log(mesh)
      // always on top
      material.depthTest = false
      material.depthWrite = false
      material.transparent = true
      mesh.renderOrder = 999
      return mesh
    },
    commit() {
      if (!texture) return
      texture.needsUpdate = true
    },
    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    },
  }
}
