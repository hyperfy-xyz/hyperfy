import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import { fork, execSync } from 'child_process'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'
import { polyfillNode } from 'esbuild-plugin-polyfill-node'

const dev = process.argv.includes('--dev')
const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, '../')
const buildDir = path.join(rootDir, 'build')

await fs.emptyDir(buildDir)

/**
 * Build Node Client
 *
 * This creates a hybrid client build that can in nodejs headlessly, as such it doesn't utilize rendering and other systems
 * that use browser apis
 *
 */

let spawn

{
  const nodeClientCtx = await esbuild.context({
    entryPoints: ['src/node-client/index.js'],
    outfile: 'build/world-node-client.js',
    platform: 'node',
    format: 'esm',
    bundle: true,
    treeShaking: true,
    minify: false,
    sourcemap: true,
    packages: 'external',
    loader: {},
    plugins: [
      {
        name: 'server-finalize-plugin',
        setup(build) {
          build.onEnd(async result => {
            // copy over physx js
            const physxIdlSrc = path.join(rootDir, 'src/server/physx/physx-js-webidl.js')
            const physxIdlDest = path.join(rootDir, 'build/physx-js-webidl.js')
            await fs.copy(physxIdlSrc, physxIdlDest)
            // copy over physx wasm
            const physxWasmSrc = path.join(rootDir, 'src/server/physx/physx-js-webidl.wasm')
            const physxWasmDest = path.join(rootDir, 'build/physx-js-webidl.wasm')
            await fs.copy(physxWasmSrc, physxWasmDest)
            // start the server or stop here
            if (dev) {
              // (re)start server
              spawn?.kill('SIGTERM')
              spawn = fork(path.join(rootDir, 'build/world-node-client.js'))
            } else {
              process.exit(1)
            }
          })
        },
      },
    ],
  })
  if (dev) {
    await nodeClientCtx.watch()
  } else {
    await nodeClientCtx.rebuild()
  }
}
