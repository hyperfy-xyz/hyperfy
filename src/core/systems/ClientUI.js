import { isBoolean } from 'lodash-es'
import { ControlPriorities } from '../extras/ControlPriorities'
import { System } from './System'

let keys = 0

export class ClientUI extends System {
  constructor(world) {
    super(world)
    this.visible = true
    this.menu = null
    this.apps = false
    this.code = false
    this.conversations = false
    this.control = null
  }

  start() {
    this.control = this.world.controls.bind({ priority: ControlPriorities.CORE_UI })
  }

  update() {
    if (this.control.escape.pressed) {
      if (this.apps) {
        this.toggleApps(false)
      } else if (this.conversations) {
        this.toggleConversations(false)
      } else if (this.menu) {
        this.setMenu(null)
      } else {
        this.setMenu({ type: 'main' })
      }
    }
    if (
      this.control.keyZ.pressed &&
      !this.control.metaLeft.down &&
      !this.control.controlLeft.down &&
      !this.control.shiftLeft.down
    ) {
      this.toggleUI()
    }
    if (
      this.control.keyP.pressed &&
      this.control.shiftLeft.down
    ) {
      this.toggleConversations()
    }
    if (this.control.pointer.locked) {
      if (this.menu?.type === 'main') {
        this.setMenu(null)
      }
    }
    if (this.control.pointer.locked) {
      if (this.menu?.type === 'app' && !this.menu.blur) {
        this.setMenu({ ...this.menu, blur: true })
      }
    } else {
      if (this.menu?.type === 'app' && this.menu.blur) {
        this.setMenu({ ...this.menu, blur: false })
      }
    }
  }

  setMenu(opts) {
    this.menu = opts
    this.world.emit('menu', this.menu)
  }

  toggleMain() {
    if (this.menu?.type === 'main') {
      this.setMenu(null)
    } else {
      this.setMenu({ type: 'main' })
    }
  }

  toggleCode = value => {
    value = isBoolean(value) ? value : !this.code
    this.code = value
    this.world.emit('code', this.code)
  }

  toggleConversations = value => {
    value = isBoolean(value) ? value : !this.conversations
    this.conversations = value
    this.world.emit('conversations', this.conversations)
  }

  toggleUI() {
    this.visible = !this.visible
    this.world.emit('ui', this.visible)
  }

  toggleApps(value) {
    value = isBoolean(value) ? value : !this.apps
    if (this.apps === value) return
    this.apps = value
    this.world.emit('apps', this.apps)
  }
}
