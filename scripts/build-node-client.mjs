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
const buildDir = path.join(rootDir, 'build') // This can remain for other potential build outputs or be removed if not used elsewhere
const npmPackageDir = buildDir

// await fs.emptyDir(buildDir) // Keep if buildDir is still used for other things
// await fs.emptyDir(npmPackageDir) // Ensure the new package directory is clean

/**
 * Build Node Client
 *
 * This creates a hybrid client build that can in nodejs headlessly, as such it doesn't utilize rendering and other systems
 * that use browser apis
 *
 */

let spawn

async function buildNodeClient() {
  try {
    // Ensure the NPM package directory is clean and exists
    await fs.emptyDir(npmPackageDir)
    await fs.ensureDir(npmPackageDir)

    console.log(`Building Node.js client for ${dev ? 'development' : 'production'}...`)

    // Read root package.json for details like version, license, dependencies
    const rootPackageJson = await fs.readJson(path.join(rootDir, 'package.json'))

    const nodeClientCtx = await esbuild.context({
      entryPoints: [path.join(rootDir, 'src/node-client/index.js')],
      outfile: path.join(npmPackageDir, 'index.js'),
      platform: 'node',
      format: 'esm',
      bundle: true,
      treeShaking: true,
      minify: !dev,
      keepNames: true,
      sourcemap: dev ? 'inline' : true,
      packages: 'external', // Externalize dependencies to be handled by package.json
      // loader: {}, // Add if specific loaders are needed
      // plugins: [polyfillNode()], // Consider if specific Node polyfills are absolutely required, but 'external' handles most cases
      plugins: [
        {
          name: 'node-client-finalize-plugin',
          setup(build) {
            build.onEnd(async result => {
              if (result.errors.length > 0) {
                console.error('Build failed with errors:', result.errors)
                if (!dev) process.exit(1)
                return
              }

              console.log('Build successful. Finalizing package...')

              const physxFiles = ['physx-js-webidl.js', 'physx-js-webidl.wasm']
              for (const file of physxFiles) {
                const src = path.join(rootDir, 'src/core', file)
                const dest = path.join(npmPackageDir, file)
                if (await fs.pathExists(src)) {
                  await fs.copy(src, dest)
                  console.log(`Copied ${file} to ${dest}`)
                } else {
                  console.warn(`PhysX asset ${src} not found. Skipping.`)
                }
              }

              // 2. Generate package.json for the NPM package
              const packageJson = {
                name: rootPackageJson.name || 'hyperfy', // Or your chosen scoped package name
                version: rootPackageJson.version, // Must be synced
                description: rootPackageJson.description || 'Node.js client for Hyperfy virtual worlds',
                main: 'index.js',
                types: 'index.d.ts',
                type: 'module',
                files: [
                  'index.js',
                  'index.d.ts',
                  'vendor/',
                  'README.md',
                  'LICENSE',
                ],
                // Dependencies that are truly bundled or very core could be here
                // For 'three' and 'eventemitter3', peerDependencies are better.
                dependencies: {
                  // 'ses': rootPackageJson.dependencies?.ses, // If needed and not externalized correctly
                },
                peerDependencies: {
                  'three': rootPackageJson.dependencies?.three || '>=0.173.0 <0.174.0',
                  'eventemitter3': rootPackageJson.dependencies?.eventemitter3 || '^5.0.0',
                  'lodash-es': rootPackageJson.dependencies?.['lodash-es'] || '^4.17.0', // if used by the client bundle directly
                },
                peerDependenciesMeta: {
                  'three': { optional: false },
                  'eventemitter3': { optional: false },
                  'lodash-es': { optional: true }, // Make optional if not strictly required
                },
                engines: {
                  node: rootPackageJson.engines?.node || '>=18.0.0',
                },
                homepage: rootPackageJson.homepage,
                repository: {
                  ...rootPackageJson.repository,
                  directory: 'build', // Point to the package subdirectory
                },
                bugs: rootPackageJson.bugs,
                keywords: rootPackageJson.keywords,
                license: rootPackageJson.license,
              }
              await fs.writeJson(path.join(npmPackageDir, 'package.json'), packageJson, { spaces: 2 })
              console.log('Generated package.json in', npmPackageDir)

              // 3. Copy README.md and LICENSE
              const rootFilesToCopy = ['README.md', 'LICENSE']
              for (const file of rootFilesToCopy) {
                const src = path.join(rootDir, file)
                const dest = path.join(npmPackageDir, file)
                if (await fs.pathExists(src)) {
                  await fs.copy(src, dest)
                  console.log(`Copied ${file} to ${npmPackageDir}`)
                } else {
                  console.warn(`Root file ${src} not found. Skipping.`)
                }
              }

              // 4. Generate index.d.ts
              const tsconfigPath = path.join(rootDir, 'tsconfig.dts.json')
              const inputFileForDts = path.join(rootDir, 'src/node-client/index.js') // Relative to CWD for the command
              const outputFileDts = path.join(npmPackageDir, 'index.d.ts')

              try {
                if (!fs.existsSync(tsconfigPath)) {
                  throw new Error(`tsconfig.dts.json not found at ${tsconfigPath}. Please create it or ensure it's correctly named.`)
                }
                console.log(`Attempting to generate index.d.ts using dts-bundle-generator with tsconfig: ${tsconfigPath}`)
                execSync(`npx dts-bundle-generator --project "${tsconfigPath}" -o "${outputFileDts}" "${inputFileForDts}"`, {
                  stdio: 'inherit',
                  cwd: rootDir, // Important: run from project root
                })
                console.log('index.d.ts generated successfully using dts-bundle-generator.')
              } catch (error) {
                console.error('Error generating index.d.ts with dts-bundle-generator:', error.message)
                // console.error('stdout:', error.stdout?.toString()) // dts-bundle-generator might not populate these well on error
                // console.error('stderr:', error.stderr?.toString())
                console.warn('Falling back to manually specified index.d.ts content.')

                // --- Start of comprehensive fallback index.d.ts ---
                const fallbackDtsContent = `
// Type definitions for hyperfy Node.js client (fallback)
// Project: ${rootPackageJson.homepage || 'https://github.com/hyperfy-xyz/hyperfy'}
// Definitions by: Hyperfy Team (Update with actual author)

import { Vector3, Quaternion, Euler, Matrix4, Object3D, PerspectiveCamera } from 'three'
import OriginalEventEmitter from 'eventemitter3'

export interface IStorage {
  get<T = any>(key: string, defaultValue?: T): T | null
  set<T = any>(key: string, value: T): void
  remove(key: string): void
}

export interface PointerEvent { [key: string]: any }

export interface NodeData {
  id?: string
  name?: string
  active?: boolean
  position?: [number, number, number] | Vector3
  quaternion?: [number, number, number, number] | Quaternion
  scale?: [number, number, number] | Vector3
  onPointerEnter?: (event: PointerEvent) => void
  onPointerLeave?: (event: PointerEvent) => void
  onPointerDown?: (event: PointerEvent) => void
  onPointerUp?: (event: PointerEvent) => void
  cursor?: string
  [key: string]: any
}

export interface WorldInitOptions {
  storage?: IStorage
  assetsDir?: string
  assetsUrl?: string
}

export declare class System extends OriginalEventEmitter {
  constructor(world: World)
  world: World
  init?(options?: WorldInitOptions): Promise<void> | void
  start?(): void
  preTick?(): void
  preFixedUpdate?(willFixedStep?: boolean): void
  fixedUpdate?(delta: number): void
  postFixedUpdate?(delta?: number): void
  preUpdate?(alpha?: number): void
  update?(delta: number, alpha?: number): void
  postUpdate?(delta?: number): void
  lateUpdate?(delta?: number, alpha?: number): void
  postLateUpdate?(delta?: number): void
  commit?(): void
  postTick?(): void
  destroy?(): void
}

export declare class Node {
  constructor(data?: NodeData)
  id: string
  name: string
  parent: Node | null
  children: Node[]
  ctx: any
  position: Vector3
  quaternion: Quaternion
  rotation: Euler
  scale: Vector3
  matrix: Matrix4
  matrixWorld: Matrix4
  mounted: boolean
  isDirty: boolean
  isTransformed: boolean
  protected _active: boolean
  get active(): boolean
  set active(value: boolean)
  onPointerEnter?: (event: PointerEvent) => void
  onPointerLeave?: (event: PointerEvent) => void
  onPointerDown?: (event: PointerEvent) => void
  onPointerUp?: (event: PointerEvent) => void
  cursor?: string
  activate(ctx?: any): void
  deactivate(): void
  add(node: Node): this
  remove(node: Node): this
  setTransformed(): void
  setDirty(): void
  clean(): void
  mount(): void
  commit(didTransform: boolean): void
  unmount(): void
  updateTransform(): void
  traverse(callback: (node: Node) => void): void
  clone(recursive?: boolean): this
  copy(source: this, recursive?: boolean): this
  get(id: string): Node | null
  getWorldPosition(target?: Vector3): Vector3
  getWorldMatrix(target?: Matrix4): Matrix4
  getStats(recursive?: boolean, stats?: any): any
  applyStats(stats: any): void
  getProxy(): any
}

export declare class World extends OriginalEventEmitter {
  constructor()
  maxDeltaTime: number
  fixedDeltaTime: number
  frame: number
  time: number
  accumulator: number
  systems: System[]
  networkRate: number
  assetsUrl: string | null
  assetsDir: string | null
  hot: Set<any>
  rig: Object3D
  camera: PerspectiveCamera
  storage?: IStorage
  settings: System
  collections: System
  apps: System
  anchors: System
  events: System
  scripts: System
  chat: System
  blueprints: System
  entities: System
  physics: System
  stage: System
  client: NodeClient
  controls: ClientControls
  network: ClientNetwork
  loader: ServerLoader
  environment: NodeEnvironment
  register<T extends System>(key: string, systemClass: new (world: World) => T): T
  init(options: WorldInitOptions): Promise<void>
  start(): void
  tick(time: number): void
  preTick(): void
  preFixedUpdate(willFixedStep: boolean): void
  fixedUpdate(delta: number): void
  postFixedUpdate(delta: number): void
  preUpdate(alpha: number): void
  update(delta: number, alpha?: number): void
  postUpdate(delta: number): void
  lateUpdate(delta: number, alpha?: number): void
  postLateUpdate(delta: number): void
  commit(): void
  postTick(): void
  setupMaterial?(material: any): void
  setHot(item: any, hot: boolean): void
  resolveURL(url: string, allowLocal?: boolean): string
  inject?(runtime: any): void
  destroy(): void
}

export declare class NodeClient extends System { /* Actual API for NodeClient */ }
export declare class ClientControls extends System { isMac: boolean; /* Actual API for ClientControls */ }
export declare class ClientNetwork extends System { /* Actual API for ClientNetwork */ }
export declare class ServerLoader extends System { /* Actual API for ServerLoader */ }
export declare class NodeEnvironment extends System { /* Actual API for NodeEnvironment */ }

// Define specific types for default systems if available, e.g.:
// export declare class SettingsSystem extends System { /* ... */ }
// export declare class EntitiesSystem extends System { /* ... */ }

export declare function createNodeClientWorld(): World
export declare const storage: IStorage
export declare function getPhysXAssetPath(assetName: string): string
`
                // --- End of comprehensive fallback index.d.ts ---
                await fs.writeFile(outputFileDts, fallbackDtsContent.trim())
                console.log('Written fallback index.d.ts to', outputFileDts)
              }

              if (dev) {
                spawn?.kill('SIGTERM')
                spawn = fork(path.join(npmPackageDir, 'index.js')) // Runs the newly built package entry point
                console.log('Development server (re)started with new build.')
              } else {
                console.log('NPM package built successfully to:', npmPackageDir)
                // For non-dev builds, we let the calling script (e.g., publish:node) handle process exit or next steps.
              }
            })
          },
        },
      ],
    })

    if (dev) {
      await nodeClientCtx.watch()
      console.log('Watching for changes...')
    } else {
      await nodeClientCtx.rebuild()
      await nodeClientCtx.dispose() // Dispose context after build for non-watch mode
      console.log('Build complete.')
    }
  } catch (error) {
    console.error('Unhandled error during build process:', error)
    if (!dev) process.exit(1)
  }
}

// Execute the build
buildNodeClient().catch(err => {
  console.error('Failed to execute buildNodeClient:', err)
  if (!dev) process.exit(1)
})
