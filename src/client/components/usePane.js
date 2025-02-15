import { debounce } from 'lodash-es'
import { useEffect } from 'react'
import { storage } from '../../core/storage'

const STORAGE_KEY = 'panes'

let info = storage.get(STORAGE_KEY)

if (!info || info.v !== 1) {
  info = {
    v: 1,
    count: 0,
    configs: {
      // [id]: { x, y, width, height }
    },
  }
}

const persist = debounce(() => storage.set(STORAGE_KEY, info), 300)

let layer = 0

export function usePane(id, paneRef, headRef, resizable = false) {
  useEffect(() => {
    let config = info.configs[id]

    // hack: for some reason width and height can end up zero
    // so if they are, we just clear it and rebuild
    if (config && (config.width === 0 || config.height === 0)) {
      config = null
    }

    if (!config) {
      const count = ++info.count
      config = {
        y: count * 20,
        x: count * 20,
        width: paneRef.current.offsetWidth,
        height: paneRef.current.offsetHeight,
        layer: 0,
      }
      info.configs[id] = config
      persist()
    }

    if (!resizable) {
      config.width = paneRef.current.offsetWidth
      config.height = paneRef.current.offsetHeight
    }

    layer++
    const pane = paneRef.current

    // ensure pane is within screen bounds so it can't get lost
    const maxX = window.innerWidth - config.width
    const maxY = window.innerHeight - config.height
    config.x = Math.min(Math.max(0, config.x), maxX)
    config.y = Math.min(Math.max(0, config.y), maxY)

    pane.style.top = `${config.y}px`
    pane.style.left = `${config.x}px`
    if (resizable) {
      pane.style.width = `${config.width}px`
      pane.style.height = `${config.height}px`
    }
    pane.style.zIndex = `${layer}`

    const head = headRef.current

    const onPanePointerDown = () => {
      layer++
      pane.style.zIndex = `${layer}`
    }

    let moving = false
    const onHeadPointerDown = e => {
      moving = true
    }

    const onPointerMove = e => {
      if (!moving) return
      config.x += e.movementX
      config.y += e.movementY
      pane.style.top = `${config.y}px`
      pane.style.left = `${config.x}px`
      persist()
    }

    const onPointerUp = e => {
      moving = false
    }

    const resizer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) {
        config.width = entry.contentRect.width
        config.height = entry.contentRect.height
        persist()
      }
    })

    head.addEventListener('pointerdown', onHeadPointerDown)
    pane.addEventListener('pointerdown', onPanePointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    resizer.observe(pane)

    return () => {
      head.removeEventListener('pointerdown', onHeadPointerDown)
      pane.removeEventListener('pointerdown', onPanePointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      resizer.disconnect()
    }
  }, [])
}
