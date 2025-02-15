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

const RES = 1
const NAMETAG_WIDTH = 200 * RES
const NAMETAG_HEIGHT = 24 * RES
const FONT_SIZE = 16 * RES
const BORDER_RADIUS = 10 * RES

const PER_ROW = 5
const PER_COLUMN = 20
const MAX_INSTANCES = PER_ROW * PER_COLUMN

const defaultQuaternion = new THREE.Quaternion(0, 0, 0, 1)
const defaultScale = new THREE.Vector3(1, 1, 1)

const v1 = new THREE.Vector3()

export class Nametags extends System {
  constructor(world) {
    super(world)
    this.handles = []
    this.canvas = document.createElement('canvas')
    this.canvas.width = NAMETAG_WIDTH * PER_ROW
    this.canvas.height = NAMETAG_HEIGHT * PER_COLUMN
    // console.log(`nametags: atlas is ${this.canvas.width} x ${this.canvas.height}`)
    // document.body.appendChild(this.canvas)
    // this.canvas.style = `position:absolute;top:0;left:0;z-index:9999;border:1px solid red;transform:scale(${1 / RES});transform-origin:top left;pointer-events:none;`
    this.ctx = this.canvas.getContext('2d')
    this.texture = new THREE.CanvasTexture(this.canvas)
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

  add(name) {
    const idx = this.handles.length
    if (idx >= MAX_INSTANCES) return console.error('nametags: reached max')
    // draw name in slot
    this.draw(idx, name)
    // inc instances
    this.mesh.count++
    this.mesh.instanceMatrix.needsUpdate = true
    // set coords
    const row = Math.floor(idx / PER_ROW)
    const col = idx % PER_ROW
    const coords = this.mesh.geometry.attributes.coords
    coords.setXY(idx, col / PER_ROW, row / PER_COLUMN)
    coords.needsUpdate = true
    // make a handle
    const matrix = new THREE.Matrix4()
    matrix.compose(new THREE.Vector3(), defaultQuaternion, defaultScale)
    const handle = {
      idx,
      name,
      matrix,
      move: newMatrix => {
        // copy over just position
        matrix.elements[12] = newMatrix.elements[12] // x position
        matrix.elements[13] = newMatrix.elements[13] // y position
        matrix.elements[14] = newMatrix.elements[14] // z position
        this.mesh.setMatrixAt(handle.idx, matrix)
        this.mesh.instanceMatrix.needsUpdate = true
      },
      rename: name => {
        handle.name = name
        this.draw(handle.idx, name)
      },
      destroy: () => {
        this.remove(handle)
      },
    }
    this.handles[idx] = handle
    return handle
  }

  remove(handle) {
    if (!this.handles.includes(handle)) {
      return console.warn('nametags: attempted to remove non-existent handle')
    }
    const last = this.handles[this.handles.length - 1]
    const isLast = handle === last
    if (isLast) {
      // this is the last instance in the buffer, pop it off the end
      this.handles.pop()
      // clear slot
      this.undraw(handle.idx)
    } else {
      // there are other instances after this one in the buffer, swap it with the last one and pop it off the end
      // undraw last slot
      this.undraw(last.idx)
      // draw last name in this slot
      this.draw(handle.idx, last.name)
      // update coords for swapped instance
      const coords = this.mesh.geometry.attributes.coords
      const row = Math.floor(handle.idx / PER_ROW)
      const col = handle.idx % PER_ROW
      coords.setXY(handle.idx, col / PER_ROW, row / PER_COLUMN)
      coords.needsUpdate = true
      // swap handle references and update matrix
      this.mesh.setMatrixAt(handle.idx, last.matrix)
      last.idx = handle.idx
      this.handles[handle.idx] = last
      this.handles.pop()
    }
    this.mesh.count--
    this.mesh.instanceMatrix.needsUpdate = true
  }

  draw(idx, name) {
    const row = Math.floor(idx / PER_ROW)
    const col = idx % PER_ROW
    const x = col * NAMETAG_WIDTH
    const y = row * NAMETAG_HEIGHT
    // clear any previously drawn stuff
    this.ctx.clearRect(x, y, NAMETAG_WIDTH, NAMETAG_HEIGHT)
    // draw background
    // this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    // fillRoundRect(this.ctx, x, y, NAMETAG_WIDTH, NAMETAG_HEIGHT, BORDER_RADIUS)
    // draw name
    this.ctx.font = `400 ${FONT_SIZE}px Rubik`
    this.ctx.fillStyle = 'white'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    const text = this.fitText(name, NAMETAG_WIDTH)
    this.ctx.fillText(text, x + NAMETAG_WIDTH / 2, y + NAMETAG_HEIGHT / 2)
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

  undraw(idx) {
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
