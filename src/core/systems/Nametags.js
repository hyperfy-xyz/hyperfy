import { fillRoundRect } from '../extras/fillRoundRect'
import * as THREE from '../extras/three'
import CustomShaderMaterial from '../libs/three-custom-shader-material'
import { uuid } from '../utils'
import { System } from './System'

/**
 * Nametags System
 *
 * - Runs on the client
 * - Utilizes a single atlas to draw names on, and a single instanced mesh to retain 1 draw call at all times
 * - Provides a hook to register and unregister nametag instances which can be moved around independently
 *
 */

const RES = 2
const NAMETAG_WIDTH = 200 * RES
const NAMETAG_HEIGHT = 35 * RES
const NAMETAG_BORDER_RADIUS = 10 * RES

const NAME_FONT_SIZE = 16 * RES
const NAME_OUTLINE_SIZE = 4 * RES

const HEALTH_MAX = 100
const HEALTH_HEIGHT = 12 * RES
const HEALTH_WIDTH = 100 * RES
const HEALTH_BORDER = 1.5 * RES
const HEALTH_BORDER_RADIUS = 20 * RES

const PER_ROW = 5
const PER_COLUMN = 20
const MAX_INSTANCES = PER_ROW * PER_COLUMN

const defaultQuaternion = new THREE.Quaternion(0, 0, 0, 1)
const defaultScale = new THREE.Vector3(1, 1, 1)

const v1 = new THREE.Vector3()

export class Nametags extends System {
  constructor(world) {
    super(world)
    this.nametags = []
    this.canvas = document.createElement('canvas')
    this.canvas.width = NAMETAG_WIDTH * PER_ROW
    this.canvas.height = NAMETAG_HEIGHT * PER_COLUMN
    // console.log(`nametags: atlas is ${this.canvas.width} x ${this.canvas.height}`)

    // DEBUG: show on screen
    // document.body.appendChild(this.canvas)
    // this.canvas.style = `position:absolute;top:0;left:0;z-index:9999;border:1px solid red;transform:scale(${1 / RES});transform-origin:top left;pointer-events:none;`

    this.ctx = this.canvas.getContext('2d')
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.flipY = false
    this.texture.needsUpdate = true
    this.material = new CustomShaderMaterial({
      baseMaterial: THREE.MeshBasicMaterial,
      // all nametags are drawn on top of everything
      // this isn't perfect but we should be improve.
      // also note mesh.renderOrder=9999
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uAtlas: { value: this.texture },
        uOrientation: { value: this.world.rig.quaternion },
      },
      vertexShader: `
        attribute vec2 coords;
        uniform vec4 uOrientation;
        varying vec2 vUv;

        vec3 applyQuaternion(vec3 pos, vec4 quat) {
          vec3 qv = vec3(quat.x, quat.y, quat.z);
          vec3 t = 2.0 * cross(qv, pos);
          return pos + quat.w * t + cross(qv, t);
        }

        void main() {
          // rotate to match camera orientation
          vec3 newPosition = position;
          newPosition = applyQuaternion(newPosition, uOrientation);
          csm_Position = newPosition;
          
          // use uvs just for this slot
          vec2 atlasUV = uv; // original UVs are 0-1 for the plane
          atlasUV.y = 1.0 - atlasUV.y;
          atlasUV /= vec2(${PER_ROW}, ${PER_COLUMN});
          atlasUV += coords;
          vUv = atlasUV;          
        }
      `,
      fragmentShader: `
        uniform sampler2D uAtlas;
        varying vec2 vUv;
        
        void main() {
          vec4 texColor = texture2D(uAtlas, vUv);
          csm_FragColor = texColor;
        }
      `,
    })
    this.geometry = new THREE.PlaneGeometry(1, NAMETAG_HEIGHT / NAMETAG_WIDTH)
    this.geometry.setAttribute('coords', new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES * 2), 2)) // xy coordinates in atlas
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, MAX_INSTANCES)
    this.mesh.renderOrder = 9999
    this.mesh.matrixAutoUpdate = false
    this.mesh.matrixWorldAutoUpdate = false
    this.mesh.frustumCulled = false
    this.mesh.count = 0
  }

  start() {
    this.world.stage.scene.add(this.mesh)
  }

  add({ name, health }) {
    const idx = this.nametags.length
    if (idx >= MAX_INSTANCES) return console.error('nametags: reached max')

    // inc instances
    this.mesh.count++
    this.mesh.instanceMatrix.needsUpdate = true
    // set coords
    const row = Math.floor(idx / PER_ROW)
    const col = idx % PER_ROW
    const coords = this.mesh.geometry.attributes.coords
    coords.setXY(idx, col / PER_ROW, row / PER_COLUMN)
    coords.needsUpdate = true
    // make nametag
    const matrix = new THREE.Matrix4()
    matrix.compose(new THREE.Vector3(), defaultQuaternion, defaultScale)
    const nametag = {
      idx,
      name,
      health,
      matrix,
      move: newMatrix => {
        // copy over just position
        matrix.elements[12] = newMatrix.elements[12] // x position
        matrix.elements[13] = newMatrix.elements[13] // y position
        matrix.elements[14] = newMatrix.elements[14] // z position
        this.mesh.setMatrixAt(nametag.idx, matrix)
        this.mesh.instanceMatrix.needsUpdate = true
      },
      setName: name => {
        if (nametag.name === name) return
        nametag.name = name
        this.draw(nametag)
      },
      setHealth: health => {
        if (nametag.health === health) return
        nametag.health = health
        this.draw(nametag)
        console.log('SET HEALTH', health)
      },
      destroy: () => {
        this.remove(nametag)
      },
    }
    this.nametags[idx] = nametag
    // draw it
    this.draw(nametag)
    return nametag
  }

  remove(nametag) {
    if (!this.nametags.includes(nametag)) {
      return console.warn('nametags: attempted to remove non-existent nametag')
    }
    const last = this.nametags[this.nametags.length - 1]
    const isLast = nametag === last
    if (isLast) {
      // this is the last instance in the buffer, pop it off the end
      this.nametags.pop()
      // clear slot
      this.undraw(nametag)
    } else {
      // there are other instances after this one in the buffer...
      // so we move the last one into this slot
      this.undraw(last)
      // move last to this slot
      last.idx = nametag.idx
      this.draw(last)
      // update coords for swapped instance
      const coords = this.mesh.geometry.attributes.coords
      const row = Math.floor(nametag.idx / PER_ROW)
      const col = nametag.idx % PER_ROW
      coords.setXY(nametag.idx, col / PER_ROW, row / PER_COLUMN)
      coords.needsUpdate = true
      // swap nametag references and update matrix
      this.mesh.setMatrixAt(last.idx, last.matrix)
      this.nametags[last.idx] = last
      this.nametags.pop()
    }
    this.mesh.count--
    this.mesh.instanceMatrix.needsUpdate = true
  }

  draw(nametag) {
    const idx = nametag.idx
    const row = Math.floor(idx / PER_ROW)
    const col = idx % PER_ROW
    const x = col * NAMETAG_WIDTH
    const y = row * NAMETAG_HEIGHT
    // clear any previously drawn stuff
    this.ctx.clearRect(x, y, NAMETAG_WIDTH, NAMETAG_HEIGHT)
    // draw background
    // this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    // fillRoundRect(this.ctx, x, y, NAMETAG_WIDTH, NAMETAG_HEIGHT, NAMETAG_BORDER_RADIUS)
    // draw name
    this.ctx.font = `800 ${NAME_FONT_SIZE}px Rubik`
    this.ctx.fillStyle = 'white'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'top'
    this.ctx.lineWidth = NAME_OUTLINE_SIZE
    this.ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    const text = this.fitText(nametag.name, NAMETAG_WIDTH)
    this.ctx.save()
    this.ctx.globalCompositeOperation = 'xor'
    this.ctx.globalAlpha = 1 // Adjust as needed
    this.ctx.strokeText(text, x + NAMETAG_WIDTH / 2, y + 2)
    this.ctx.restore()
    this.ctx.fillText(text, x + NAMETAG_WIDTH / 2, y + 2)
    // draw health
    if (nametag.health < HEALTH_MAX) {
      // bar
      {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
        const width = HEALTH_WIDTH
        const height = HEALTH_HEIGHT
        const left = x + (NAMETAG_WIDTH - HEALTH_WIDTH) / 2
        const top = y + NAME_FONT_SIZE + 5
        const borderRadius = HEALTH_BORDER_RADIUS
        fillRoundRect(this.ctx, left, top, width, height, borderRadius)
      }
      // health
      {
        this.ctx.fillStyle = '#229710'
        const maxWidth = HEALTH_WIDTH - HEALTH_BORDER * 2
        const perc = nametag.health / HEALTH_MAX
        const width = maxWidth * perc
        const height = HEALTH_HEIGHT - HEALTH_BORDER * 2
        const left = x + (NAMETAG_WIDTH - HEALTH_WIDTH) / 2 + HEALTH_BORDER
        const top = y + NAME_FONT_SIZE + 5 + HEALTH_BORDER
        const borderRadius = HEALTH_BORDER_RADIUS
        fillRoundRect(this.ctx, left, top, width, height, borderRadius)
      }
    }
    // update texture
    this.texture.needsUpdate = true
  }

  fitText(text, maxWidth) {
    // try full text
    const width = this.ctx.measureText(text).width
    if (width <= maxWidth) {
      return text
    }
    // if too long, truncate with ellipsis
    const ellipsis = '...'
    let truncated = text
    const ellipsisWidth = this.ctx.measureText(ellipsis).width
    while (truncated.length > 0) {
      truncated = truncated.slice(0, -1)
      const truncatedWidth = this.ctx.measureText(truncated).width
      if (truncatedWidth + ellipsisWidth <= maxWidth) {
        return truncated + ellipsis
      }
    }
    // fallback
    return ellipsis
  }

  undraw(nametag) {
    const idx = nametag.idx
    const row = Math.floor(idx / PER_ROW)
    const col = idx % PER_ROW
    const x = col * NAMETAG_WIDTH
    const y = row * NAMETAG_HEIGHT
    // clear any previously drawn stuff
    this.ctx.clearRect(x, y, NAMETAG_WIDTH, NAMETAG_HEIGHT)
    // update texture
    this.texture.needsUpdate = true
  }

  setOrientation(quaternion) {
    this.material.uniforms.uOrientation.value = quaternion
    this.material.uniformsNeedUpdate = true
  }
}
