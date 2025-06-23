/// <reference path="../types/physx.d.ts" />

import PhysXModule from './physx-js-webidl.js'
import { extendThreePhysX } from './extras/extendThreePhysX.js'

/**
 * PhysX Loader
 *
 * We are currently using a fork of physx-js-webidl with a custom build, modifying `PhysXWasmBindings.cmake` options to work on both node and browser environments
 *
 */
let promise: Promise<any> | undefined
export function loadPhysX(): Promise<any> {
  if (!promise) {
    promise = new Promise(async (resolve) => {
      (globalThis as any).PHYSX = await PhysXModule()
      
      // Extend Three.js objects with physics methods immediately after PhysX loads
      extendThreePhysX()
      
      const version = (PHYSX as any).PHYSICS_VERSION
      const allocator = new (PHYSX as any).PxDefaultAllocator()
      const errorCb = new (PHYSX as any).PxDefaultErrorCallback()
      const foundation = (PHYSX as any).CreateFoundation(version, allocator, errorCb)
      resolve({ version, allocator, errorCb, foundation })
    })
  }
  return promise
}
