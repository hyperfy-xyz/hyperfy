import fs from 'fs-extra'
import path from 'path'
import { importApp } from '../core/extras/appTools'
import { assets } from './assets'

class Mobs {
  constructor() {
    this.list = []
    this.blueprints = new Set()
  }

  async init({ rootDir, worldDir }) {
    console.log('[mobs] initializing')
    this.dir = path.join(worldDir, '/mobs')

    try {
      // Ensure mobs directory exists
      await fs.ensureDir(this.dir)

      // Copy over built-in mobs
      const builtInMobsPath = path.join(rootDir, 'src/world/mobs')
      if (await fs.pathExists(builtInMobsPath)) {
        await fs.copy(builtInMobsPath, this.dir, { overwrite: false })
      }

      // Validate manifest exists
      const manifestPath = path.join(this.dir, 'manifest.json')
      if (!await fs.pathExists(manifestPath)) {
        throw new Error(`Manifest not found: ${manifestPath}`)
      }

      // Load and validate manifest
      const manifest = await fs.readJson(manifestPath)
      if (!manifest.mobs || !Array.isArray(manifest.mobs)) {
        throw new Error('Invalid manifest: mobs array missing')
      }

      if (manifest.mobs.length === 0) {
        throw new Error('No mobs defined in manifest')
      }

      const blueprints = []

      // Load each mob
      for (const mobFilename of manifest.mobs) {
        console.log(`[mobs] Loading ${mobFilename}...`)

        const mobPath = path.join(this.dir, mobFilename)
        if (!await fs.pathExists(mobPath)) {
          throw new Error(`Mob file not found: ${mobFilename}`)
        }

        const mobBuffer = await fs.readFile(mobPath)
        if (mobBuffer.length === 0) {
          throw new Error(`Mob file empty: ${mobFilename}`)
        }

        const mobFile = new File([mobBuffer], mobFilename, {
          type: 'application/octet-stream',
        })

        try {
          const mob = await importApp(mobFile)

          // Validate mob blueprint
          this.validateMobBlueprint(mob.blueprint)

          // Upload assets
          for (const asset of mob.assets) {
            await assets.upload(asset.file)
          }

          blueprints.push(mob.blueprint)
          console.log(`[mobs] ✓ loaded: ${mob.blueprint.name}`)

        } catch (error) {
          throw new Error(`Failed to load ${mobFilename}: ${error.message}`)
        }
      }

      this.list.push({
        id: 'mobs',
        name: manifest.name,
        blueprints,
      })

      for (const blueprint of blueprints) {
        this.blueprints.add(blueprint)
      }

      console.log(`[mobs] ✓ loaded ${blueprints.length} mob(s)`)

      // Validation passed
      return this

    } catch (error) {
      console.error('[mobs] FATAL ERROR:', error.message)
      throw error  // Propagate to bootstrap
    }
  }

  validateMobBlueprint(blueprint) {
    // Validate blueprint structure
    if (!blueprint) {
      throw new Error('Invalid mob: missing blueprint')
    }
    if (!blueprint.name) {
      throw new Error('Mob blueprint missing name')
    }
    if (!blueprint.script) {
      throw new Error(`Mob missing script: ${blueprint.name}`)
    }
    if (!blueprint.model) {
      throw new Error(`Mob missing model: ${blueprint.name}`)
    }
  }
}

export const mobs = new Mobs()
