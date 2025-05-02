import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

// Path to the PhysX JS binding file relative to this file's built location in 'build/'
// Adjust if the server PhysX path changes or build structure differs.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Assuming this file will be in build/core/ alongside core.js,
// and the physx files are copied to build/
// Resolve directly from the build directory (__dirname)
const physxJsPath = path.resolve(__dirname, './physx-js-webidl.js')

let promise
let physxWasmPath // Path to the WASM file

/**
 * PhysX Loader for Node.js
 *
 * Assumes physx-js-webidl.js and physx-js-webidl.wasm have been copied
 * to the build directory (e.g., by the build script).
 */
export function loadNodePhysX() {
  if (!promise) {
    promise = new Promise(async (resolve, reject) => {
      try {
        // Dynamically import the PhysX JS binding.
        // This script is expected to define the global `PhysX` factory function.
        // It might also implicitly load the WASM.
        // Using file URL for dynamic import is safer in ESM
        const physxJsFileUrl = pathToFileURL(physxJsPath).href
        const physxModule = await import(physxJsFileUrl)

        // The PhysX module might export the factory, or put it on globalThis.
        // The specific build used determines this. Check both.
        const PhysXFactory = globalThis.PhysX || physxModule.default || physxModule.PhysX

        if (typeof PhysXFactory !== 'function') {
          throw new Error(
            'PhysX factory function not found after importing bindings. Check physx-js-webidl.js build settings (EXPORT_NAME, MODULARIZE).'
          )
        }

        // Resolve the path to the WASM file relative to the JS binding file
        // The binding often expects the WASM file to be in the same directory.
        physxWasmPath = path.resolve(path.dirname(physxJsPath), 'physx-js-webidl.wasm')
        // console.log("PhysX WASM path:", physxWasmPath); // For debugging

        // The PhysX factory might need configuration, especially the WASM path.
        // This depends heavily on how the PhysX JS bindings were built.
        // Common patterns:
        // 1. Factory finds .wasm automatically if in the same dir (or via default locateFile).
        // 2. Factory accepts a config object: PhysX({ locateFile: () => physxWasmPath })
        // 3. Factory needs globalThis.PHYSX_WASM_URL set.

        // Attempt common pattern 1 & 2 (adapt if needed based on PhysX build):
        let physxInstance
        try {
          // Try with locateFile override first
          physxInstance = await PhysXFactory({
            locateFile: file => {
              if (file.endsWith('.wasm')) {
                // console.log(`Locating WASM: ${physxWasmPath}`); // Debug
                return physxWasmPath
              }
              return file
            },
          })
        } catch (configError) {
          console.warn('PhysXFactory with config failed, trying without:', configError)
          // Fallback: Try calling without config (might find WASM automatically)
          physxInstance = await PhysXFactory()
        }

        if (!physxInstance || typeof physxInstance.PHYSICS_VERSION === 'undefined') {
          throw new Error('Failed to initialize PhysX instance.')
        }

        globalThis.PHYSX = physxInstance // Ensure it's globally available like in the client version

        const version = PHYSX.PHYSICS_VERSION
        const allocator = new PHYSX.PxDefaultAllocator()
        const errorCb = new PHYSX.PxDefaultErrorCallback()
        const foundation = PHYSX.CreateFoundation(version, allocator, errorCb)

        console.log(`Node PhysX ${version} loaded successfully.`)
        resolve({ version, allocator, errorCb, foundation })
      } catch (error) {
        console.error('Error loading Node PhysX:', error)
        reject(error)
      }
    })
  }
  return promise
}
