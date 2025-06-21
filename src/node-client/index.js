import 'ses'
import '../core/lockdown'
import path from 'path'
import { fileURLToPath } from 'url'

// support `__dirname` in ESM
globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url))


export * as THREE from 'three';

export { createNodeClientWorld } from '../core/createNodeClientWorld'
export { storage } from '../core/storage'
export { World } from '../core/World.js'
export { loadPhysX } from '../core/loadPhysX.js'
export { uuid } from '../core/utils.js'

export { System } from '../core/systems/System'
export { NodeClient } from '../core/systems/NodeClient.js'
export { ClientControls } from '../core/systems/ClientControls.js'
export { ClientNetwork } from '../core/systems/ClientNetwork.js'
export { ServerLoader } from '../core/systems/ServerLoader.js'
export { NodeEnvironment } from '../core/systems/NodeEnvironment.js'

export { Node } from '../core/nodes/Node.js'

export { Emotes } from '../core/extras/playerEmotes.js'
export { createEmoteFactory } from '../core/extras/createEmoteFactory.js'
export { createNode } from '../core/extras/createNode.js'
export { glbToNodes } from '../core/extras/glbToNodes.js'
export { Vector3Enhanced } from '../core/extras/Vector3Enhanced.js'

export { GLTFLoader } from '../core/libs/gltfloader/GLTFLoader.js'
export { CSM } from '../core/libs/csm/CSM'

/**
 * Returns the absolute path to a PhysX asset within the packaged 'vendor' directory.
 * This assumes that the 'vendor' directory is at the root of the installed package.
 * @param assetName The name of the PhysX asset (e.g., 'physx.wasm').
 */
export function getPhysXAssetPath(assetName) {
  // In ESM, __dirname is not available directly like in CJS.
  // This constructs a path relative to the current module file.
  // Assumes index.js is at the root of the dist/npm package.
  // If index.js is nested, this path needs adjustment (e.g., path.join(__dirname, '../vendor', assetName))
  const currentModulePath = fileURLToPath(import.meta.url);
  const packageRootPath = path.dirname(currentModulePath);
  return path.join(packageRootPath, 'vendor', assetName);
}
