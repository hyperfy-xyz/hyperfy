// import 'ses'
// import '../core/lockdown'
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { css } from '@firebolt-dev/css'

import { createClientWorld } from '../core/createClientWorld'
import { loadPhysX } from './loadPhysX'
import { CoreUI } from './components/CoreUI'

export { System } from '../core/systems/System'

export function Client({ wsUrl, systems = {} }) {
  const viewportRef = useRef()
  const uiRef = useRef()
  const world = useMemo(() => createClientWorld(), [])
  useEffect(() => {
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
    for (const [key, System] of Object.entries(systems)) {
      world.register(key, System)
    }
    world.init({ viewport, ui, wsUrl, loadPhysX, baseEnvironment })
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
      <div className='App__viewport' ref={viewportRef}>
        <div className='App__ui' ref={uiRef}>
          <CoreUI world={world} />
        </div>
      </div>
    </div>
  )
}
