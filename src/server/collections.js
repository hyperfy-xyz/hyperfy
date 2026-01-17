import fs from 'fs-extra'
import path from 'path'
import { importApp } from '../core/extras/appTools'
import { assets } from './assets'

class Collections {
  constructor() {
    this.list = []
    this.blueprints = new Set()
  }

  async init({ rootDir, worldDir }) {
    console.log('[collections] initializing')
    this.dir = path.join(worldDir, '/collections')

    try {
      // Ensure collections directory exists
      await fs.ensureDir(this.dir)

      // Copy over built-in collections
      await fs.copy(path.join(rootDir, 'src/world/collections'), this.dir)

      // Ensure all collections apps are installed
      let folderNames = fs.readdirSync(this.dir)
      folderNames.sort((a, b) => {
        // keep "default" first then sort alphabetically
        if (a === 'default') return -1
        if (b === 'default') return 1
        return a.localeCompare(b)
      })

      if (folderNames.length === 0) {
        throw new Error('No collection folders found')
      }

      let totalApps = 0

      for (const folderName of folderNames) {
        const folderPath = path.join(this.dir, folderName)
        const stats = fs.statSync(folderPath)
        if (!stats.isDirectory()) continue

        const manifestPath = path.join(folderPath, 'manifest.json')
        if (!fs.existsSync(manifestPath)) {
          console.log(`[collections] Skipping ${folderName} - no manifest`)
          continue
        }

        const manifest = fs.readJsonSync(manifestPath)
        if (!manifest.apps || !Array.isArray(manifest.apps)) {
          throw new Error(`Invalid manifest in ${folderName}: apps array missing`)
        }

        if (manifest.apps.length === 0) {
          console.log(`[collections] Skipping ${folderName} - no apps`)
          continue
        }

        const blueprints = []
        for (const appFilename of manifest.apps) {
          console.log(`[collections] Loading ${folderName}/${appFilename}...`)

          const appPath = path.join(folderPath, appFilename)
          if (!fs.existsSync(appPath)) {
            throw new Error(`App file not found: ${folderName}/${appFilename}`)
          }

          const appBuffer = fs.readFileSync(appPath)
          if (appBuffer.length === 0) {
            throw new Error(`App file empty: ${folderName}/${appFilename}`)
          }

          const appFile = new File([appBuffer], appFilename, {
            type: 'application/octet-stream',
          })

          try {
            const app = await importApp(appFile)

            // Upload assets
            for (const asset of app.assets) {
              await assets.upload(asset.file)
            }

            blueprints.push(app.blueprint)
            console.log(`[collections] ✓ loaded: ${app.blueprint.name}`)

          } catch (error) {
            throw new Error(`Failed to load ${folderName}/${appFilename}: ${error.message}`)
          }
        }

        this.list.push({
          id: folderName,
          name: manifest.name,
          blueprints,
        })

        for (const blueprint of blueprints) {
          this.blueprints.add(blueprint)
        }

        totalApps += blueprints.length
      }

      if (totalApps === 0) {
        throw new Error('No collection apps loaded')
      }

      console.log(`[collections] ✓ loaded ${totalApps} app(s)`)

      // Validation passed
      return this

    } catch (error) {
      console.error('[collections] FATAL ERROR:', error.message)
      throw error  // Propagate to bootstrap
    }
  }
}

export const collections = new Collections()
