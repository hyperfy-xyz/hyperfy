import 'ses'
import '../core/lockdown'
import '../server/bootstrap'

import * as THREE from 'three'

import { createNodeClientWorld } from '../core/createNodeClientWorld'
import { loadPhysX } from '../server/physx/loadPhysX'

const world = createNodeClientWorld()

// const wsUrl = ''

world.init({
  viewport: null, // no rendering
  ui: null, // no ui
  wsUrl: 'ws://localhost:3000/ws', // todo: configurable
  baseEnvironment: {
    model: null, // '/base-environment.glb',
    bg: null, // '/day2-2k.jpg',
    hdr: null, // '/day2.hdr',
    sunDirection: new THREE.Vector3(-1, -2, -2).normalize(),
    sunIntensity: 1,
    sunColor: 0xffffff,
    fogNear: null,
    fogFar: null,
    fogColor: null,
  },
  loadPhysX,
})

// world.init({ db, storage, loadPhysX })

console.log('lets go')
