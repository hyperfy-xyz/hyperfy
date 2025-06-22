import type { World } from '../../types'
import { ControlPriorities } from '../extras/ControlPriorities'
import { System } from './System'

/**
 *
 * This system handles pointer events.
 * It handles pointer events while the pointer is locked via reticle raycasting.
 * It handles pointer events while the cursor is being used, via world UI.
 *
 */

export class ClientPointer extends System {
  pointerState: PointerState
  ui: any
  control: any
  screenHit: any
  
  constructor(world: World) {
    super(world)
    this.pointerState = new PointerState()
  }

  async init(options: any): Promise<void> {
    this.ui = options.ui
  }

  start() {
    this.control = (this.world as any).controls.bind({
      priority: ControlPriorities.POINTER,
    })
  }

  update(delta: number) {
    const hit = this.control.pointer.locked ? (this.world.stage as any).raycastReticle()[0] : this.screenHit
    this.pointerState.update(hit, this.control.mouseLeft.pressed, this.control.mouseLeft.released)
  }

  setScreenHit(screenHit: any) {
    this.screenHit = screenHit
    // capture all mouse click events if our pointer is interacting with world UI
    this.control.mouseLeft.capture = !!screenHit
  }

  destroy() {
    this.control?.release()
    this.control = null
  }
}

const PointerEvents = {
  ENTER: 'pointerenter',
  LEAVE: 'pointerleave',
  DOWN: 'pointerdown',
  UP: 'pointerup',
}

const CURSOR_DEFAULT = 'default'

class PointerEvent {
  type: string | null
  _propagationStopped: boolean
  
  constructor() {
    this.type = null
    this._propagationStopped = false
  }

  set(type: string) {
    this.type = type
    this._propagationStopped = false
  }

  stopPropagation() {
    this._propagationStopped = true
  }
}

class PointerState {
  activePath: Set<any>
  event: PointerEvent
  cursor: string
  pressedNodes: Set<any>
  
  constructor() {
    this.activePath = new Set()
    this.event = new PointerEvent()
    this.cursor = CURSOR_DEFAULT
    this.pressedNodes = new Set()
  }

  update(hit: any, pointerPressed: boolean, pointerReleased: boolean) {
    const newPath = hit ? this.getAncestorPath(hit) : []
    const oldPath = Array.from(this.activePath)

    // find divergence point
    let i = 0
    while (i < newPath.length && i < oldPath.length && newPath[i] === oldPath[i]) i++

    // pointer leave events bubble up from leaf
    for (let j = oldPath.length - 1; j >= i; j--) {
      if (oldPath[j].onPointerLeave) {
        this.event.set(PointerEvents.LEAVE)
        try {
          oldPath[j].onPointerLeave?.(this.event)
        } catch (err) {
          console.error(err)
        }
        // if (this.event._propagationStopped) break
      }
      this.activePath.delete(oldPath[j])
    }

    // pointer enter events bubble down from divergence
    for (let j = i; j < newPath.length; j++) {
      if (newPath[j].onPointerEnter) {
        this.event.set(PointerEvents.ENTER)
        try {
          newPath[j].onPointerEnter?.(this.event)
        } catch (err) {
          console.error(err)
        }
        if (this.event._propagationStopped) break
      }
      this.activePath.add(newPath[j])
    }

    // set cursor - check from leaf to root for first defined cursor
    let cursor = CURSOR_DEFAULT
    if (newPath.length > 0) {
      for (let i = newPath.length - 1; i >= 0; i--) {
        if (newPath[i].cursor) {
          cursor = newPath[i].cursor
          break
        }
      }
    }
    if (cursor !== this.cursor) {
      document.body.style.cursor = cursor
      this.cursor = cursor
    }

    // handle pointer down events
    if (pointerPressed) {
      for (let i = newPath.length - 1; i >= 0; i--) {
        const node = newPath[i]
        if (node.onPointerDown) {
          this.event.set(PointerEvents.DOWN)
          try {
            node.onPointerDown(this.event)
          } catch (err) {
            console.error(err)
          }
          this.pressedNodes.add(node)
          if (this.event._propagationStopped) break
        }
      }
    }

    // handle pointer up events
    if (pointerReleased) {
      for (const node of this.pressedNodes) {
        if (node.onPointerUp) {
          this.event.set(PointerEvents.UP)
          try {
            node.onPointerUp(this.event)
          } catch (err) {
            console.error(err)
          }
          if (this.event._propagationStopped) break
        }
      }
      this.pressedNodes.clear()
    }
  }

  getAncestorPath(hit: any): any[] {
    const path: any[] = []
    let node = hit.node?.resolveHit?.(hit) || hit.node
    while (node) {
      path.unshift(node)
      node = node.parent
    }
    return path
  }
}
