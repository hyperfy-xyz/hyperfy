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
    // ensure collections directory exists
    await fs.ensureDir(this.dir)
    // copy over built-in collections
    await fs.copy(path.join(rootDir, 'src/world/collections'), this.dir)
    // ensure all collections apps are installed
    let folderNames = fs.readdirSync(this.dir)
    folderNames.sort((a, b) => {
      // keep "default" first then sort alphabetically
      if (a === 'default') return -1
      if (b === 'default') return 1
      return a.localeCompare(b)
    })
    for (const folderName of folderNames) {
      const folderPath = path.join(this.dir, folderName)
      const stats = fs.statSync(folderPath)
      if (!stats.isDirectory()) continue
      const manifestPath = path.join(folderPath, 'manifest.json')
      if (!fs.existsSync(manifestPath)) continue
      const manifest = fs.readJsonSync(manifestPath)
      const blueprints = []
      for (const appFilename of manifest.apps) {
        const appPath = path.join(folderPath, appFilename)
        const appBuffer = fs.readFileSync(appPath)
        const appFile = new File([appBuffer], appFilename, {
          type: 'application/octet-stream',
        })
        const app = await importApp(appFile)
        for (const asset of app.assets) {
          // const file = asset.file
          // const assetFilename = asset.url.slice(8) // remove 'asset://' prefix
          await assets.upload(asset.file)
        }
        blueprints.push(app.blueprint)
      }
      this.list.push({
        id: folderName,
        name: manifest.name,
        blueprints,
      })
      for (const blueprint of blueprints) {
        this.blueprints.add(blueprint)
      }
    }
  }
}

export const collections = new Collections()
