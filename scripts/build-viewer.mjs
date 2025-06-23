import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'
import { polyfillNode } from 'esbuild-plugin-polyfill-node'

const dev = process.argv.includes('--dev')
const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, '../')
const buildDir = path.join(rootDir, 'build')

await fs.emptyDir(buildDir)

/**
 * Build Viewer
 */

const viewerBuildDir = path.join(rootDir, 'build/viewer')

{
  const clientCtx = await esbuild.context({
    entryPoints: ['src/core/createViewerWorld.js'],
    entryNames: '/[name]-[hash]',
    outdir: viewerBuildDir,
    platform: 'browser',
    format: 'esm',
    bundle: true,
    treeShaking: true,
    minify: false,
    sourcemap: 'inline',
    metafile: true,
    // jsx: 'automatic',
          jsxImportSource: 'react',
    // define: {
    //   // 'process.env.NODE_ENV': '"development"',
    // },
    // loader: {
    //   '.js': 'jsx',
    // },
    external: ['three'],
    // alias: {
    //   react: 'react', // always use our own local react (jsx)
    // },
    plugins: [polyfillNode({})],
  })
  if (dev) {
    await clientCtx.watch()
  } else {
    await clientCtx.rebuild()
    process.exit(0)
  }
}
