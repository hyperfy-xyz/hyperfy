import * as THREE from 'three'

import { System } from './System'

export class ClientTarget extends System {
  constructor(world) {
    super(world)
  }

  init({ ui }) {
    this.ui = ui
  }

  start() {
    this.guide = document.createElement('div')
    this.guide.style.position = 'absolute'
    this.guide.style.width = '30px'
    this.guide.style.height = '30px'
    this.guide.style.display = 'flex'
    this.guide.style.alignItems = 'center'
    this.guide.style.justifyContent = 'center'
    this.guide.style.transform = 'translate(-50%, -50%)'
    this.guide.style.filter = 'drop-shadow(0px 0px 4px rgba(0, 0, 0, 0.25))'
    this.guide.innerHTML = targetSVG
  }

  show(vec3) {
    this.target = vec3
    this.ui.appendChild(this.guide)
    this.bounds = this.ui.getBoundingClientRect()
  }

  hide() {
    if (this.target) {
      this.target = null
      this.ui.removeChild(this.guide)
    }
  }

  lateUpdate() {
    if (!this.target) return

    const vector = new THREE.Vector3().copy(this.target)
    vector.project(this.world.camera)

    const x = ((vector.x + 1) * this.bounds.width) / 2
    const y = ((-vector.y + 1) * this.bounds.height) / 2

    // Point behind camera => hide
    if (vector.z > 1) {
      this.guide.style.display = 'none'
      return
    }

    // If within -1..1 in clip space => on-screen
    if (vector.x >= -1 && vector.x <= 1 && vector.y >= -1 && vector.y <= 1) {
      // Directly place
      this.guide.style.left = `${x}px`
      this.guide.style.top = `${y}px`
      this.guide.style.display = 'block'
    } else {
      // Offscreen => pin to edge
      const centerX = this.bounds.width / 2
      const centerY = this.bounds.height / 2

      const pt = intersectLineWithRect(
        centerX,
        centerY,
        x,
        y,
        this.bounds.width,
        this.bounds.height,
        /* optional padding */ 10
      )

      if (!pt) {
        // No valid intersection => hide
        this.guide.style.display = 'none'
        return
      }

      this.guide.style.left = `${pt.x}px`
      this.guide.style.top = `${pt.y}px`
      this.guide.style.display = 'block'
    }
  }
}

const targetSVG = `
<svg
  xmlns='http://www.w3.org/2000/svg'
  width='24'
  height='24'
  viewBox='0 0 24 24'
  fill='none'
  stroke='currentColor'
  stroke-width='2'
  stroke-linecap='round'
  stroke-linejoin='round'
  class='lucide lucide-crosshair'
>
  <circle cx='12' cy='12' r='10' />
  <line x1='22' x2='18' y1='12' y2='12' />
  <line x1='6' x2='2' y1='12' y2='12' />
  <line x1='12' x2='12' y1='6' y2='2' />
  <line x1='12' x2='12' y1='22' y2='18' />
</svg>
`

/**
 * Intersect a line from (cx, cy) to (x, y) with the 2D rectangle
 * [0, width] x [0, height].
 *
 * Returns { x, y } of the intersection on the rectangle's boundary.
 * If the line is strictly outside or parallel in that direction,
 * we won't get a valid intersection => returns null.
 */
function intersectLineWithRect(cx, cy, x, y, width, height, padding = 0) {
  // Parametric form: P(t) = center + t*(dx, dy)
  const dx = x - cx
  const dy = y - cy

  // If (x, y) == (cx, cy), there's no direction
  if (dx === 0 && dy === 0) return { x: cx, y: cy }

  let tMin = Number.POSITIVE_INFINITY

  // For each boundary, solve for t where we intersect
  // 1) Left boundary: X = 0
  if (dx !== 0) {
    const t = (0 - cx) / dx
    if (t > 0) {
      const iy = cy + t * dy
      // Must be within [0, height]
      if (iy >= 0 && iy <= height) {
        tMin = Math.min(tMin, t)
      }
    }
  }
  // 2) Right boundary: X = width
  if (dx !== 0) {
    const t = (width - cx) / dx
    if (t > 0) {
      const iy = cy + t * dy
      if (iy >= 0 && iy <= height) {
        tMin = Math.min(tMin, t)
      }
    }
  }
  // 3) Top boundary: Y = 0
  if (dy !== 0) {
    const t = (0 - cy) / dy
    if (t > 0) {
      const ix = cx + t * dx
      if (ix >= 0 && ix <= width) {
        tMin = Math.min(tMin, t)
      }
    }
  }
  // 4) Bottom boundary: Y = height
  if (dy !== 0) {
    const t = (height - cy) / dy
    if (t > 0) {
      const ix = cx + t * dx
      if (ix >= 0 && ix <= width) {
        tMin = Math.min(tMin, t)
      }
    }
  }

  if (tMin === Number.POSITIVE_INFINITY) {
    // Could not find intersection in front of center
    return null
  }

  // Intersection point
  const ix = cx + tMin * dx
  const iy = cy + tMin * dy

  // Optionally clamp to [padding, width - padding], etc.
  const clampedX = Math.min(Math.max(ix, padding), width - padding)
  const clampedY = Math.min(Math.max(iy, padding), height - padding)

  return { x: clampedX, y: clampedY }
}
