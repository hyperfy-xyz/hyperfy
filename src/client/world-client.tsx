import React from 'react'
// import 'ses'
// import '../core/lockdown'
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
// Removed css utility import

import { createClientWorld } from '../core/createClientWorld'
import { CoreUI } from './components/CoreUI'

export { System } from '../core/systems/System'

interface ClientProps {
  wsUrl?: string | (() => string | Promise<string>);
  onSetup?: (world: any, config: any) => void;
}

export function Client({ wsUrl, onSetup }: ClientProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const uiRef = useRef<HTMLDivElement | null>(null)
  const world = useMemo(() => createClientWorld(), [])
  const [ui, setUI] = useState(world.ui.state)
  useEffect(() => {
    world.on('ui', setUI)
    return () => {
      world.off('ui', setUI)
    }
  }, [])
  useEffect(() => {
    const init = async () => {
      console.log('[Client] Starting initialization...')
      const viewport = viewportRef.current
      const ui = uiRef.current
      const baseEnvironment = {
        model: '/base-environment.glb',
        bg: '/day2-2k.jpg',
        hdr: '/day2.hdr',
        sunDirection: new THREE.Vector3(-1, -2, -2).normalize(),
        sunIntensity: 1,
        sunColor: 0xffffff,
        fogNear: null,
        fogFar: null,
        fogColor: null,
      }
      let finalWsUrl: string
      if (typeof wsUrl === 'function') {
        const result = wsUrl()
        finalWsUrl = result instanceof Promise ? await result : result
      } else {
        // Use PUBLIC_WS_URL if available, otherwise construct from current host
        const publicWsUrl = (import.meta as any).env?.PUBLIC_WS_URL
        if (publicWsUrl) {
          finalWsUrl = publicWsUrl
        } else {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
          const defaultWsUrl = `${protocol}//${window.location.host}/ws`
          finalWsUrl = wsUrl || defaultWsUrl
        }
      }
      console.log('[Client] WebSocket URL:', finalWsUrl)
      const config = { viewport, ui, wsUrl: finalWsUrl, baseEnvironment }
      onSetup?.(world, config)
      console.log('[Client] Initializing world with config:', config)
      ;(world as any).init(config)
    }
    init()
  }, [])
  return (
    <div
      className='App'
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '100vh',
      }}
    >
      <style>{`
        .App__viewport {
          position: absolute;
          inset: 0;
        }
        .App__ui {
          position: absolute;
          inset: 0;
          pointer-events: none;
          user-select: none;
          display: ${ui.visible ? 'block' : 'none'};
        }
      `}</style>
      <div className='App__viewport' ref={viewportRef}>
        <div className='App__ui' ref={uiRef}>
          <CoreUI world={world} />
        </div>
      </div>
    </div>
  )
}
