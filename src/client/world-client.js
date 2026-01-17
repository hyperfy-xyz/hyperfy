// import 'ses'
// import '../core/lockdown'
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { css } from '@firebolt-dev/css'

import { createClientWorld } from '../core/createClientWorld'
import { CoreUI } from './components/CoreUI'

export { System } from '../core/systems/System'

export function Client({ wsUrl, onSetup }) {
  const viewportRef = useRef()
  const uiRef = useRef()
  const world = useMemo(() => createClientWorld(), [])
  const [ui, setUI] = useState(world.ui.state)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    world.on('ui', setUI)
    return () => {
      world.off('ui', setUI)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        console.log('[client] Initializing world...')

        const viewport = viewportRef.current
        const ui = uiRef.current
        const baseEnvironment = {
          model: '/base-environment.glb',
          bg: null, // '/day2-2k.jpg',
          hdr: '/Clear_08_4pm_LDR.hdr',
          rotationY: 0,
          sunDirection: new THREE.Vector3(-1, -2, -2).normalize(),
          sunIntensity: 1,
          sunColor: 0xffffff,
          fogNear: null,
          fogFar: null,
          fogColor: null,
        }

        if (typeof wsUrl === 'function') {
          wsUrl = wsUrl()
          if (wsUrl instanceof Promise) wsUrl = await wsUrl
        }

        const config = { viewport, ui, wsUrl, baseEnvironment }
        onSetup?.(world, config)
        world.init(config)

        // Wait for snapshot from server
        console.log('[client] Waiting for snapshot...')
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Snapshot timeout (30s)'))
          }, 30000)

          world.once('snapshot:loaded', () => {
            clearTimeout(timeout)
            resolve()
          })

          world.once('error', (err) => {
            clearTimeout(timeout)
            reject(err)
          })
        })

        // Validate critical data received
        const mobCount = world.mobs.getMobBlueprints?.()?.length || 0
        if (mobCount === 0) {
          console.warn('[client] No mobs received from server')
        }

        console.log('[client] ✓ All data loaded')
        console.log(`[client] ✓ ${mobCount} mob(s) ready`)

        setReady(true)

      } catch (error) {
        console.error('[FATAL] Client initialization failed:', error)
        setError(error.message)
      }
    }

    init()
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
          display: ${ready && !error ? 'block' : 'none'};
        }
        .App__ui {
          position: absolute;
          inset: 0;
          pointer-events: none;
          user-select: none;
          display: ${ui.visible && ready && !error ? 'block' : 'none'};
        }
        .App__loading,
        .App__error {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #1a1a1a;
          color: white;
          flex-direction: column;
          gap: 20px;
        }
        .loading-title,
        .error-title {
          font-size: 32px;
          font-weight: bold;
        }
        .error-title {
          color: #ff4444;
        }
        .loading-message,
        .error-message {
          font-size: 16px;
          color: #cccccc;
        }
        .error-message {
          max-width: 500px;
          text-align: center;
        }
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #333;
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .error-button {
          padding: 10px 20px;
          font-size: 16px;
          background: #444;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          &:hover {
            background: #555;
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}
    >
      {/* Always render viewport for refs, but hide during loading/error */}
      <div className='App__viewport' ref={viewportRef}>
        <div className='App__ui' ref={uiRef}>
          <CoreUI world={world} />
        </div>
      </div>

      {/* Error overlay */}
      {error && (
        <div className='App__error'>
          <div className='error-title'>Failed to Load</div>
          <div className='error-message'>{error}</div>
          <button className='error-button' onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {!ready && !error && (
        <div className='App__loading'>
          <div className='loading-spinner'></div>
          <div className='loading-title'>Loading...</div>
          <div className='loading-message'>Initializing world systems...</div>
        </div>
      )}
    </div>
  )
}
