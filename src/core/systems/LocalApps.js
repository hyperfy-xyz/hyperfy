import { System } from './System.js'
import fs from 'fs/promises'
import { watch } from 'fs'
import path from 'path'

export class LocalApps extends System {
  constructor(world) {
    super(world)
    this.apps = new Map()
    this.ready = false
    this.reloadDebounce = new Map()
    this.init()
  }

  async init() {
    await this.loadApps()
    this.watchApps()
    this.ready = true
  }

  async loadApps() {
    const rootDir = path.join(process.cwd(), 'apps')
    try {
      const appFolders = await fs.readdir(rootDir)

      for (const appFolder of appFolders) {
        const appDir = path.join(rootDir, appFolder)
        const manifestPath = path.join(appDir, 'manifest.json')

        try {
          const stat = await fs.stat(appDir)
          if (!stat.isDirectory()) continue

          const manifestContent = await fs.readFile(manifestPath, 'utf-8')
          const manifest = JSON.parse(manifestContent)

          // Create a blueprint-like structure that matches existing format
          const blueprint = {
            id: appFolder,
            name: manifest.name || appFolder,
            desc: manifest.description || '',
            model: manifest.model ? `/apps/${appFolder}/${manifest.model}` : null,
            script: manifest.script ? `/apps/${appFolder}/${manifest.script}` : null,
            isLocal: true,
            version: 1,
          }

          this.apps.set(appFolder, blueprint)
          console.log(`[LocalApps] Loaded app: ${blueprint.name} (${appFolder})`)
        } catch (err) {
          // Skip folders without valid manifest
          if (err.code !== 'ENOENT') {
            console.warn(`[LocalApps] Failed to load app ${appFolder}:`, err.message)
          }
        }
      }

      console.log(`[LocalApps] Loaded ${this.apps.size} local apps`)
    } catch (err) {
      console.error('[LocalApps] Could not read apps directory:', err)
    }
  }

  getAppsList() {
    return Array.from(this.apps.values())
  }

  getApp(id) {
    return this.apps.get(id)
  }

  async reloadApps() {
    this.apps.clear()
    await this.loadApps()
  }

  watchApps() {
    const appsDir = path.join(process.cwd(), 'apps')
    watch(appsDir, { recursive: true }, (eventType, filename) => {
      if (!filename || !filename.endsWith('.js')) return

      // Extract appId from filename (e.g., 'crash-block/script.js' -> 'crash-block')
      const pathParts = filename.split(path.sep)
      if (pathParts.length < 2) return

      const appId = pathParts[0]
      const scriptFile = pathParts[pathParts.length - 1]

      // Get the app blueprint
      const blueprint = this.apps.get(appId)
      if (!blueprint || !blueprint.script) return

      // Check if this is the app's script file
      const scriptPath = blueprint.script.split('/').pop()
      if (scriptFile !== scriptPath) return

      // Debounce the reload
      if (this.reloadDebounce.has(appId)) {
        clearTimeout(this.reloadDebounce.get(appId))
      }

      this.reloadDebounce.set(
        appId,
        setTimeout(() => {
          this.reloadDebounce.delete(appId)
          this.triggerAppReload(appId)
        }, 100)
      )
    })
  }

  triggerAppReload(appId) {
    const localBlueprint = this.apps.get(appId)
    if (!localBlueprint) return

    // Find all blueprints that match this local app's script path
    const matchingBlueprints = []
    for (const [id, blueprint] of this.world.blueprints.items) {
      if (blueprint.script && blueprint.script.includes(`/apps/${appId}/`)) {
        matchingBlueprints.push({ id, blueprint })
      }
    }

    if (matchingBlueprints.length === 0) {
      console.log(
        `[LocalApps] App ${appId} is not in blueprints system yet. Hot reload will activate once app is added to world.`
      )
      return
    }

    // Update local blueprint version
    localBlueprint.version = (localBlueprint.version || 1) + 1

    // For local apps, we need to force script reload by temporarily clearing it
    for (const { id, blueprint } of matchingBlueprints) {
      const newVersion = (blueprint.version || 1) + 1
      const scriptPath = blueprint.script

      // Step 1: Clear the script to force unload
      this.world.blueprints.modify({
        id: id,
        script: null,
        version: newVersion,
      })
      // Broadcast to clients
      this.world.network.send('blueprintModified', {
        id: id,
        script: null,
        version: newVersion,
      })

      // Step 2: Clear server-side cache
      const scriptKey = `script/${scriptPath}`
      if (this.world.loader.results) {
        this.world.loader.results.delete(scriptKey)
      }
      if (this.world.loader.promises) {
        this.world.loader.promises.delete(scriptKey)
      }

      // Step 3: Send blueprint info to clear the correct client cache
      this.world.network.send('clearScriptCache', {
        scriptPath,
        blueprintId: id,
        currentScript: blueprint.script,
      })

      // Step 4: Restore the script after a short delay
      setTimeout(() => {
        // Force all apps with this blueprint to rebuild
        for (const [_, entity] of this.world.entities.items) {
          if (entity.data.blueprint === id && entity.isApp) {
            entity.data.state = {}
          }
        }

        this.world.blueprints.modify({
          id: id,
          script: scriptPath,
          version: newVersion + 1,
        })
        // Broadcast to clients
        this.world.network.send('blueprintModified', {
          id: id,
          script: scriptPath,
          version: newVersion + 1,
        })
        console.log(`[LocalApps] Hot-reloaded app: ${appId} (blueprint: ${id})`)
      }, 100)
    }
  }
}