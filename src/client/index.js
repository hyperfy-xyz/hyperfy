import '../core/lockdown'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { css } from '@firebolt-dev/css'

import { createClientWorld } from '../core/createClientWorld'
import { loadPhysX } from './loadPhysX'
import { GUI } from './components/GUI'

function App() {
  const viewportRef = useRef()
  const uiRef = useRef()
  const world = useMemo(() => createClientWorld(), [])
  useEffect(() => {
    const viewport = viewportRef.current
    const ui = uiRef.current
    const wsUrl = process.env.PUBLIC_WS_URL
    const apiUrl = process.env.PUBLIC_API_URL
    world.init({ viewport, ui, wsUrl, apiUrl, loadPhysX })
  }, [])
  useEffect(() => {
    const ui = uiRef.current
    const onEvent = e => {
      e.isGUI = true
    }
    ui.addEventListener('click', onEvent)
    ui.addEventListener('pointerdown', onEvent)
    ui.addEventListener('pointermove', onEvent)
    ui.addEventListener('pointerup', onEvent)
  }, [])
  return (
    <div
      className='App'
      css={css`
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 100vh;
        height: 100dvh;
        .App__viewport {
          position: absolute;
          inset: 0;
        }
        .App__ui {
          position: absolute;
          inset: 0;
          pointer-events: none;
          user-select: none;
        }
      `}
    >
      <div className='App__viewport' ref={viewportRef} />
      <div className='App__ui' ref={uiRef}>
        <GUI world={world} />
      </div>
    </div>
  )
}

const root = createRoot(document.getElementById('root'))
root.render(<App />)
