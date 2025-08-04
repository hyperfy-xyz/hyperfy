import { assets } from './assets'
import { collections } from './collections'

class Cleaner {
  constructor() {
    // ...
  }

  async init({ db }) {
    const clean = process.env.CLEAN === 'true' || process.env.CLEAN === 'dryrun'
    if (!clean) return console.log('[clean] skipped')
    const dryrun = process.env.CLEAN === 'dryrun'
    console.log(dryrun ? '[clean] dry run' : '[clean] running')
    // get all assets
    const allAssets = await assets.list() // hash-only assets
    // get all blueprints
    const blueprints = new Set()
    const blueprintRows = await db('blueprints')
    for (const row of blueprintRows) {
      const blueprint = JSON.parse(row.data)
      blueprints.add(blueprint)
    }
    // get all entities
    const entities = []
    const entityRows = await db('entities')
    for (const row of entityRows) {
      const entity = JSON.parse(row.data)
      entities.push(entity)
    }
    // track a list of assets to keep
    const assetsToKeep = new Set()
    // keep all user equipped vrms
    const userRows = await db('users').select('avatar')
    for (const user of userRows) {
      if (user.avatar) assetsToKeep.add(user.avatar.replace('asset://', ''))
    }
    // keep world image & world avatar assets
    const settingsRow = await db('config').where('key', 'settings').first()
    const settings = JSON.parse(settingsRow.value)
    if (settings.image) assetsToKeep.add(settings.image.url.replace('asset://', ''))
    if (settings.avatar) assetsToKeep.add(settings.avatar.url.replace('asset://', ''))
    // delete orphaned blueprints (no longer referenced by an entity)
    const blueprintsToDelete = []
    for (const blueprint of blueprints) {
      const keep = entities.find(e => e.blueprint === blueprint.id)
      if (!keep) {
        blueprints.delete(blueprint)
        blueprintsToDelete.push(blueprint)
      }
    }
    if (blueprintsToDelete.length) {
      console.log(`[clean] ${blueprintsToDelete.length} blueprints can be deleted`)
      if (!dryrun) {
        console.log(`[clean] ${blueprintsToDelete.length} blueprints deleted`)
        while (blueprintsToDelete.length) {
          const blueprint = blueprintsToDelete.pop()
          await db('blueprints').where('id', blueprint.id).delete()
        }
      }
    }
    // append all collection blueprints so we keep all their assets
    for (const blueprint of collections.blueprints) {
      blueprints.add(blueprint)
    }
    // keep all assets associated with remaining active blueprints
    for (const blueprint of blueprints) {
      // blueprint model
      if (blueprint.model && blueprint.model.startsWith('asset://')) {
        assetsToKeep.add(blueprint.model.replace('asset://', ''))
      }
      // blueprint script
      if (blueprint.script && blueprint.script.startsWith('asset://')) {
        assetsToKeep.add(blueprint.script.replace('asset://', ''))
      }
      // blueprint image (metadata)
      if (blueprint.image?.url && blueprint.image.url.startsWith('asset://')) {
        assetsToKeep.add(blueprint.image.url.replace('asset://', ''))
      }
      // assets from file props
      for (const key in blueprint.props) {
        const url = blueprint.props[key]?.url
        if (!url) continue
        assetsToKeep.add(url.replace('asset://', ''))
      }
    }
    // get a list of assets to delete
    const assetsToDelete = new Set()
    for (const asset of allAssets) {
      if (!assetsToKeep.has(asset)) {
        assetsToDelete.add(asset)
      }
    }
    if (assetsToDelete.size) {
      console.log(`[clean] ${assetsToDelete.size} assets can be deleted`)
      if (!dryrun) {
        console.log(`[clean] ${assetsToDelete.size} assets deleted`)
        await assets.delete(assetsToDelete)
      }
    }
    console.log('[clean] complete')
  }
}

export const cleaner = new Cleaner()
