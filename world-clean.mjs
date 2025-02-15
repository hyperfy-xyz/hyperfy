import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import Knex from 'knex'
import moment from 'moment'
import { fileURLToPath } from 'url'

const DRY_RUN = false

const world = process.env.WORLD || 'world'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, './')
const worldDir = path.join(rootDir, world)
const assetsDir = path.join(worldDir, '/assets')

const db = Knex({
  client: 'better-sqlite3',
  connection: {
    filename: `./${world}/db.sqlite`,
  },
  useNullAsDefault: true,
})

// TODO: run any missing migrations first?

let blueprints = new Set()
const blueprintRows = await db('blueprints')
for (const row of blueprintRows) {
  const blueprint = JSON.parse(row.data)
  blueprints.add(blueprint)
}

const entities = []
const entityRows = await db('entities')
for (const row of entityRows) {
  const entity = JSON.parse(row.data)
  entities.push(entity)
}

const vrms = new Set()
const userRows = await db('users').select('avatar')
for (const user of userRows) {
  if (!user.avatar) continue
  const avatar = user.avatar.replace('asset://', '')
  vrms.add(avatar)
}

const fileAssets = new Set()
const files = fs.readdirSync(assetsDir)
for (const file of files) {
  const filePath = path.join(assetsDir, file)
  const isDirectory = fs.statSync(filePath).isDirectory()
  if (isDirectory) continue
  const relPath = path.relative(assetsDir, filePath)
  // HACK: we only want to include uploaded assets (not core/assets/*) so we do a check
  // if its filename is a 64 character hash
  const isAsset = relPath.split('.')[0].length === 64
  if (!isAsset) continue
  fileAssets.add(relPath)
}

/**
 * Phase 1:
 * Remove all blueprints that no entities reference any more.
 * The world doesn't need them, and we shouldn't be loading them in and sending dead blueprints to all the clients.
 */

const blueprintsToDelete = []
for (const blueprint of blueprints) {
  const canDelete = !entities.find(e => e.blueprint === blueprint.id)
  if (canDelete) {
    blueprintsToDelete.push(blueprint)
  }
}
console.log(`deleting ${blueprintsToDelete.length} blueprints`)
for (const blueprint of blueprintsToDelete) {
  blueprints.delete(blueprint)
  if (!DRY_RUN) {
    await db('blueprints').where('id', blueprint.id).delete()
  }
  console.log('delete blueprint:', blueprint.id)
}

/**
 * Phase 2:
 * Remove all asset files not referenced by a blueprint or used as an avatar.
 * The world no longer uses/needs them.
 *
 */

const blueprintAssets = new Set()
for (const blueprint of blueprints) {
  if (blueprint.model && blueprint.model.startsWith('asset://')) {
    const asset = blueprint.model.replace('asset://', '')
    blueprintAssets.add(asset)
    // console.log(asset)
  }
  if (blueprint.script && blueprint.script.startsWith('asset://')) {
    const asset = blueprint.script.replace('asset://', '')
    blueprintAssets.add(asset)
    // console.log(asset)
  }
  if (blueprint.image?.url && blueprint.image.url.startsWith('asset://')) {
    const asset = blueprint.image.url.replace('asset://', '')
    blueprintAssets.add(asset)
    // console.log(asset)
  }
  for (const key in blueprint.props) {
    const url = blueprint.props[key]?.url
    if (!url) continue
    const asset = url.replace('asset://', '')
    blueprintAssets.add(asset)
    // console.log(asset)
  }
}
const filesToDelete = []
for (const fileAsset of fileAssets) {
  const isUsedByBlueprint = blueprintAssets.has(fileAsset)
  const isUsedByUser = vrms.has(fileAsset)
  if (!isUsedByBlueprint && !isUsedByUser) {
    filesToDelete.push(fileAsset)
  }
}
console.log(`deleting ${filesToDelete.length} assets`)
for (const fileAsset of filesToDelete) {
  const fullPath = path.join(assetsDir, fileAsset)
  if (!DRY_RUN) {
    fs.removeSync(fullPath)
  }
  console.log('delete asset:', fileAsset)
}

process.exit()
