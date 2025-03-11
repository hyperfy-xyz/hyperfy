import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'

const dev = process.argv.includes('--dev')
const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, '../')
const buildDir = path.join(rootDir, 'build')

await fs.emptyDir(buildDir)

/**
 * Build Client
 */

const buildDirectory = path.join(rootDir, 'build')

{
  const clientCtx = await esbuild.context({
    entryPoints: ['src/client/world-client.js'],
    outfile: 'build/world-client.js',
    platform: 'browser',
    format: 'esm',
    bundle: true,
    treeShaking: true,
    minify: false,
    sourcemap: 'inline',
    metafile: true,
    jsx: 'automatic',
    jsxImportSource: '@firebolt-dev/jsx',
    // define: {
    //   // 'process.env.NODE_ENV': '"development"',
    // },
    loader: {
      '.js': 'jsx',
    },
    external: ['three', 'react', 'react-dom', 'ses'],
    // alias: {
    //   react: 'react', // always use our own local react (jsx)
    // },
    plugins: [],
  })
  if (dev) {
    await clientCtx.watch()
  } else {
    await clientCtx.rebuild()
    process.exit(1)
  }
}
