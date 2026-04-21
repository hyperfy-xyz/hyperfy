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
  const cssLayerRef = useRef()
  const uiRef = useRef()
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
      const viewport = viewportRef.current
      const cssLayer = cssLayerRef.current
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

      // For offline/static mode, compute an absolute base URL so assets
      // resolve correctly on sub-paths (e.g. GitHub Pages at /hyperfy/).
      // resolveURL() passes https:// URLs through unchanged; bare filenames
      // and absolute paths both break at sub-paths.
      const base = wsUrl ? null : new URL('./', location.href).href

      if (base) {
        baseEnvironment.model = `${base}base-environment.glb`
        baseEnvironment.hdr = `${base}Clear_08_4pm_LDR.hdr`
      }

      const config = { viewport, cssLayer, ui, wsUrl, assetsUrl: base ? `${base}assets` : undefined, baseEnvironment }
      onSetup?.(world, config)
      await world.init(config)

      // Offline bootstrap: deserialize empty defaults, spawn a local
      // player, and load the base environment so the world is usable.
      if (!wsUrl) {
        world.settings.deserialize({})
        world.collections.deserialize([])
        world.blueprints.deserialize([])
        world.chat.deserialize([])
        // Preload avatar before creating the player entity
        world.loader.preload('avatar', 'asset://avatar.vrm')
        world.loader.execPreload()
        // Spawn a local player — mirrors ServerNetwork.onConnection
        const playerId = world.network.id
        world.entities.deserialize([
          {
            id: playerId,
            type: 'player',
            position: [0, 0, 0],
            quaternion: [0, 0, 0, 1],
            owner: playerId,
            userId: playerId,
            name: 'Player',
            health: 100,
            avatar: 'asset://avatar.vrm',
            sessionAvatar: null,
            rank: 2, // admin
            enteredAt: Date.now(),
          },
        ])
        // Load ground model and HDR sky in parallel.
        // updateSky only sets scene.environment (reflections); scene.background
        // must be set explicitly for the HDR to be visible as the sky.
        const [glb, hdr] = await Promise.all([
          world.loader.load('model', `${base}base-environment.glb`),
          world.loader.load('hdr', `${base}Clear_08_4pm_LDR.hdr`),
        ])
        const root = glb.toNodes()
        root.activate({ world })
        hdr.mapping = THREE.EquirectangularReflectionMapping
        world.stage.scene.background = hdr
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
        }
        .App__cssLayer {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }
        .App__ui {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          user-select: none;
          display: ${ui.visible ? 'block' : 'none'};
        }
      `}
    >
      <div className='App__viewport' ref={viewportRef}>
        <div className='App__cssLayer' ref={cssLayerRef} />
        <div className='App__ui' ref={uiRef}>
          <CoreUI world={world} />
        </div>
      </div>
    </div>
  )
}
