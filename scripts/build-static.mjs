/**
 * build-static.mjs — Builds a self-contained static client for GitHub Pages.
 *
 * No server required. The client boots into offline mode automatically
 * because PUBLIC_WS_URL is absent from the baked env.js.
 *
 * Usage:
 *   node scripts/build-static.mjs
 *
 * Output: build/static/  (ready to deploy)
 */
import fs from 'fs-extra'
import path from 'path'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'
import { polyfillNode } from 'esbuild-plugin-polyfill-node'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, '../')
const outDir = path.join(rootDir, 'build/static')
const clientPublicDir = path.join(rootDir, 'src/client/public')
const htmlSrc = path.join(rootDir, 'src/client/public/index.html')

// Public env vars to bake into the static build.
// No PUBLIC_WS_URL → client auto-detects offline mode.
// Users can still override via ?connect=ws://... or ?mode=offline
const publicEnvs = {
  PUBLIC_ALLOW_WS_OVERRIDE: 'true', // allow ?connect= on static builds
  PUBLIC_MAX_UPLOAD_SIZE: '0',
  ...(process.env.PUBLIC_WS_URL && { PUBLIC_WS_URL: process.env.PUBLIC_WS_URL }),
}

await fs.emptyDir(outDir)

const ctx = await esbuild.context({
  entryPoints: ['src/client/index.js', 'src/client/particles.js'],
  entryNames: '/[name]-[hash]',
  outdir: outDir,
  platform: 'browser',
  format: 'esm',
  bundle: true,
  treeShaking: true,
  minify: true,
  sourcemap: true,
  metafile: true,
  jsx: 'automatic',
  jsxImportSource: '@firebolt-dev/jsx',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  loader: {
    '.js': 'jsx',
  },
  alias: {
    react: 'react',
  },
  plugins: [
    polyfillNode({}),
    {
      name: 'static-finalize-plugin',
      setup(build) {
        build.onEnd(async result => {
          // copy public assets
          await fs.copy(clientPublicDir, outDir)

          // copy physx wasm
          await fs.copy(
            path.join(rootDir, 'src/core/physx-js-webidl.wasm'),
            path.join(outDir, 'physx-js-webidl.wasm')
          )

          // copy default world assets (avatar, emotes, animations)
          await fs.copy(
            path.join(rootDir, 'src/world/assets'),
            path.join(outDir, 'assets')
          )

          // generate static env.js
          const envCode = `globalThis.env = ${JSON.stringify(publicEnvs)}`
          await fs.writeFile(path.join(outDir, 'env.js'), envCode)

          // find hashed JS filenames (relative paths, no leading /)
          const outputs = Object.keys(result.metafile.outputs)
          const relativePath = f => f.split('build/static')[1].replace(/^\//, '')
          const jsPath = relativePath(outputs.find(f => f.includes('/index-') && f.endsWith('.js')))
          const particlesPath = relativePath(outputs.find(f => f.includes('/particles-') && f.endsWith('.js')))

          // fill HTML template
          const buildId = Date.now()
          let html = await fs.readFile(htmlSrc, 'utf-8')
          html = html.replace('{jsPath}', jsPath)
          html = html.replace('{particlesPath}', particlesPath)
          html = html.replaceAll('{buildId}', buildId)
          html = html.replaceAll('{title}', 'Hyperfy — Offline')
          html = html.replaceAll('{desc}', 'Interactive 3D world running in offline mode')
          html = html.replaceAll('{url}', '')
          html = html.replaceAll('{image}', '')
          await fs.writeFile(path.join(outDir, 'index.html'), html)

          // GitHub Pages SPA fallback: copy index.html → 404.html
          await fs.copy(path.join(outDir, 'index.html'), path.join(outDir, '404.html'))

          // create .nojekyll to prevent GitHub Pages from ignoring _files
          await fs.writeFile(path.join(outDir, '.nojekyll'), '')

          console.log(`\nStatic build ready → build/static/`)
          console.log(`  ${Object.keys(result.metafile.outputs).length} output files`)
          console.log(`\nTo test locally:`)
          console.log(`  npx serve build/static`)
          console.log(`\nTo deploy to GitHub Pages:`)
          console.log(`  gh-pages -d build/static`)
        })
      },
    },
  ],
})

await ctx.rebuild()
await ctx.dispose()
