import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import { fork, execSync } from 'child_process'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'
import { polyfillNode } from 'esbuild-plugin-polyfill-node'

const dev = process.argv.includes('--dev')
const typecheck = !process.argv.includes('--no-typecheck')
const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, '../')
const buildDir = path.join(rootDir, 'build')

// Ensure build directories exist
await fs.ensureDir(buildDir)
await fs.emptyDir(path.join(buildDir, 'public'))

/**
 * TypeScript Plugin for ESBuild
 */
const typescriptPlugin = {
  name: 'typescript',
  setup(build) {
    // Handle .ts and .tsx files
    build.onResolve({ filter: /\.tsx?$/ }, args => {
      return {
        path: path.resolve(args.resolveDir, args.path),
        namespace: 'file',
      }
    })
  },
}

/**
 * Run TypeScript Type Checking
 */
async function runTypeCheck() {
  if (!typecheck) return
  
  console.log('Running TypeScript type checking...')
  try {
    execSync('npx tsc --noEmit', { 
      stdio: 'inherit',
      cwd: rootDir 
    })
    console.log('Type checking passed ✓')
  } catch (error) {
    console.error('Type checking failed!')
    if (!dev) {
      process.exit(1)
    }
  }
}

/**
 * Build Client
 */
const clientPublicDir = path.join(rootDir, 'src/client/public')
const clientBuildDir = path.join(rootDir, 'build/public')
const clientHtmlSrc = path.join(rootDir, 'src/client/public/index.html')
const clientHtmlDest = path.join(rootDir, 'build/public/index.html')

async function buildClient() {
  const clientCtx = await esbuild.context({
    entryPoints: [
      'src/client/index.tsx',
      'src/client/particles.ts'
    ],
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
    jsxImportSource: '@firebolt-dev/jsx',
    define: {
      'process.env.NODE_ENV': dev ? '"development"' : '"production"',
    },
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
      '.js': 'jsx',
      '.jsx': 'jsx',
    },
    alias: {
      react: 'react',
    },
    plugins: [
      polyfillNode({}),
      typescriptPlugin,
      {
        name: 'client-finalize-plugin',
        setup(build) {
          build.onEnd(async result => {
            if (result.errors.length > 0) return
            
            // Copy public files
            await fs.copy(clientPublicDir, clientBuildDir)
            
            // Copy PhysX WASM
            const physxWasmSrc = path.join(rootDir, 'src/core/physx-js-webidl.wasm')
            const physxWasmDest = path.join(rootDir, 'build/public/physx-js-webidl.wasm')
            await fs.copy(physxWasmSrc, physxWasmDest)
            
            // Find output files
            const metafile = result.metafile
            const outputFiles = Object.keys(metafile.outputs)
            const jsPath = outputFiles
              .find(file => file.includes('/index-') && file.endsWith('.js'))
              ?.split('build/public')[1]
            const particlesPath = outputFiles
              .find(file => file.includes('/particles-') && file.endsWith('.js'))
              ?.split('build/public')[1]
            
            if (jsPath && particlesPath) {
              // Inject into HTML
              let htmlContent = await fs.readFile(clientHtmlSrc, 'utf-8')
              htmlContent = htmlContent.replace('{jsPath}', jsPath)
              htmlContent = htmlContent.replace('{particlesPath}', particlesPath)
              htmlContent = htmlContent.replaceAll('{buildId}', Date.now().toString())
              await fs.writeFile(clientHtmlDest, htmlContent)
            }
          })
        },
      },
    ],
  })
  
  if (dev) {
    await clientCtx.watch()
  }
  
  const buildResult = await clientCtx.rebuild()
  await fs.writeFile(
    path.join(buildDir, 'client-meta.json'), 
    JSON.stringify(buildResult.metafile, null, 2)
  )
  
  return clientCtx
}

/**
 * Build Server
 */
let serverProcess

async function buildServer() {
  const serverCtx = await esbuild.context({
    entryPoints: ['src/server/index.ts'],
    outfile: 'build/index.js',
    platform: 'node',
    format: 'esm',
    bundle: true,
    treeShaking: true,
    minify: false,
    sourcemap: true,
    packages: 'external',
    target: 'node22',
    define: {
      'process.env.CLIENT': 'false',
      'process.env.SERVER': 'true',
    },
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
    },
    plugins: [
      typescriptPlugin,
      {
        name: 'server-finalize-plugin',
        setup(build) {
          build.onEnd(async result => {
            if (result.errors.length > 0) return
            
            // Copy PhysX files
            const physxTsSrc = path.join(rootDir, 'src/core/physx-js-webidl.ts')
            const physxJsSrc = path.join(rootDir, 'src/core/physx-js-webidl.js')
            const physxDest = path.join(rootDir, 'build/physx-js-webidl.js')
            
            // Check if TypeScript version exists, otherwise use JS
            if (await fs.pathExists(physxTsSrc)) {
              // Compile the TypeScript file to JS
              const { outputFiles } = await esbuild.build({
                entryPoints: [physxTsSrc],
                bundle: false,
                format: 'esm',
                platform: 'node',
                write: false,
              })
              if (outputFiles && outputFiles[0]) {
                await fs.writeFile(physxDest, outputFiles[0].text)
              }
            } else if (await fs.pathExists(physxJsSrc)) {
              await fs.copy(physxJsSrc, physxDest)
            }
            
            // Copy WASM
            const physxWasmSrc = path.join(rootDir, 'src/core/physx-js-webidl.wasm')
            const physxWasmDest = path.join(rootDir, 'build/physx-js-webidl.wasm')
            await fs.copy(physxWasmSrc, physxWasmDest)
            
            // Restart server in dev mode
            if (dev) {
              serverProcess?.kill('SIGTERM')
              serverProcess = fork(path.join(rootDir, 'build/index.js'))
            }
          })
        },
      },
    ],
  })
  
  if (dev) {
    await serverCtx.watch()
  } else {
    await serverCtx.rebuild()
  }
  
  return serverCtx
}

/**
 * Generate TypeScript Declaration Files
 */
async function generateDeclarations() {
  if (!typecheck) return
  
  console.log('Generating TypeScript declarations...')
  try {
    execSync('npx tsc --emitDeclarationOnly', {
      stdio: 'inherit',
      cwd: rootDir
    })
    
    // Bundle declarations
    execSync('npx dts-bundle-generator -o build/index.d.ts src/server/index.ts --no-check', {
      stdio: 'inherit',
      cwd: rootDir
    })
    
    console.log('Declaration files generated ✓')
  } catch (error) {
    console.error('Declaration generation failed!')
    if (!dev) {
      process.exit(1)
    }
  }
}

/**
 * Watch TypeScript files for changes
 */
async function watchTypeScript() {
  if (!dev || !typecheck) return
  
  const { spawn } = await import('child_process')
  const tscWatch = spawn('npx', ['tsc', '--noEmit', '--watch', '--preserveWatchOutput'], {
    stdio: 'inherit',
    cwd: rootDir
  })
  
  process.on('exit', () => {
    tscWatch.kill()
  })
}

/**
 * Main Build Process
 */
async function main() {
  console.log(`Building Hyperfy in ${dev ? 'development' : 'production'} mode...`)
  
  // Run initial type check
  await runTypeCheck()
  
  // Build client and server
  const [clientCtx, serverCtx] = await Promise.all([
    buildClient(),
    buildServer()
  ])
  
  // Generate declarations in production
  if (!dev) {
    await generateDeclarations()
  }
  
  // Start type checking watcher in dev mode
  if (dev) {
    watchTypeScript()
    console.log('Watching for changes...')
  } else {
    console.log('Build completed successfully!')
    process.exit(0)
  }
}

// Handle cleanup
process.on('SIGINT', () => {
  serverProcess?.kill('SIGTERM')
  process.exit(0)
})

process.on('SIGTERM', () => {
  serverProcess?.kill('SIGTERM')
  process.exit(0)
})

// Run the build
main().catch(error => {
  console.error('Build failed:', error)
  process.exit(1)
}) 