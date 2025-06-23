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

// await fs.emptyDir(buildDir)
await fs.emptyDir(path.join(buildDir, 'public'))

/**
 * Build Client
 */

const clientPublicDir = path.join(rootDir, 'src/client/public')
const clientBuildDir = path.join(rootDir, 'build/public')
const clientHtmlSrc = path.join(rootDir, 'src/client/public/index.html')
const clientHtmlDest = path.join(rootDir, 'build/public/index.html')

{
  const clientCtx = await esbuild.context({
    entryPoints: ['src/client/index.js', 'src/client/particles.js'],
    entryNames: '/[name]-[hash]',
    outdir: clientBuildDir,
    platform: 'browser',
    format: 'esm',
    bundle: true,
    treeShaking: true,
    minify: !dev,
    sourcemap: true,
    metafile: true,
    jsx: 'automatic',
          jsxImportSource: 'react',
    define: {
      'process.env.NODE_ENV': dev ? '"development"' : '"production"',
    },
    loader: {
      '.js': 'jsx',
    },
    alias: {
      react: 'react', // always use our own local react (jsx)
    },
    plugins: [
      polyfillNode({}),
      {
        name: 'client-finalize-plugin',
        setup(build) {
          build.onEnd(async result => {
            // copy over public files
            await fs.copy(clientPublicDir, clientBuildDir)
            // copy physx wasm to public
            const physxWasmSrc = path.join(rootDir, 'src/core/physx-js-webidl.wasm')
            const physxWasmDest = path.join(rootDir, 'build/public/physx-js-webidl.wasm')
            await fs.copy(physxWasmSrc, physxWasmDest)
            // find js output files
            const metafile = result.metafile
            const outputFiles = Object.keys(metafile.outputs)
            const jsPath = outputFiles
              .find(file => file.includes('/index-') && file.endsWith('.js'))
              .split('build/public')[1]
            const particlesPath = outputFiles
              .find(file => file.includes('/particles-') && file.endsWith('.js'))
              .split('build/public')[1]
            // inject into html and copy over
            let htmlContent = await fs.readFile(clientHtmlSrc, 'utf-8')
            htmlContent = htmlContent.replace('{jsPath}', jsPath)
            htmlContent = htmlContent.replace('{particlesPath}', particlesPath)
            htmlContent = htmlContent.replaceAll('{buildId}', Date.now())
            await fs.writeFile(clientHtmlDest, htmlContent)
          })
        },
      },
    ],
  })
  if (dev) {
    await clientCtx.watch()
  } else {
    await clientCtx.rebuild()
  }
  const buildResult = await clientCtx.rebuild()
  fs.writeFileSync(path.join(buildDir, 'meta.json'), JSON.stringify(buildResult.metafile, null, 2))
}

/**
 * Build Server
 */

let spawn

{
  const serverCtx = await esbuild.context({
    entryPoints: ['src/server/index.js'],
    outfile: 'build/index.js',
    platform: 'node',
    format: 'esm',
    bundle: true,
    treeShaking: true,
    minify: false,
    sourcemap: true,
    packages: 'external',
    define: {
      'process.env.CLIENT': 'false',
      'process.env.SERVER': 'true',
    },
    plugins: [
      {
        name: 'server-finalize-plugin',
        setup(build) {
          build.onEnd(async result => {
            // copy over physx js
            const physxIdlSrc = path.join(rootDir, 'src/core/physx-js-webidl.js')
            const physxIdlDest = path.join(rootDir, 'build/physx-js-webidl.js')
            await fs.copy(physxIdlSrc, physxIdlDest)
            // copy over physx wasm
            const physxWasmSrc = path.join(rootDir, 'src/core/physx-js-webidl.wasm')
            const physxWasmDest = path.join(rootDir, 'build/physx-js-webidl.wasm')
            await fs.copy(physxWasmSrc, physxWasmDest)
            // start the server or stop here
            if (dev) {
              // (re)start server
              spawn?.kill('SIGTERM')
              spawn = fork(path.join(rootDir, 'build/index.js'))
            } else {
              process.exit(0)
            }
          })
        },
      },
    ],
    loader: {},
  })
  if (dev) {
    await serverCtx.watch()
  } else {
    await serverCtx.rebuild()
  }
}
