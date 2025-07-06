import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import Knex from 'knex'
import { fileURLToPath } from 'url'
import {
  getDBConfig,
  loadWorldData,
  getBlueprintAssets,
  cleanUnusedBlueprints,
  getAssetsToDelete,
  deleteFileLocal
} from './clean-world-utils.mjs'

/**
 * Clean World Script (Local Storage)
 * Removes unused blueprints and assets from the world database and local file system.
 * 
 * Database configuration is read from environment variables:
 * - DB_TYPE and DB_URL for PostgreSQL
 * - Defaults to SQLite in world folder
 */

const DRY_RUN = false
const world = process.env.WORLD || 'world'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../../')
const worldDir = path.join(rootDir, world)
const assetsDir = path.join(worldDir, 'assets')

// Initialize database
const dbConfig = getDBConfig(world)
const db = Knex(dbConfig)


// Load world data
const { blueprints, entities, vrms, worldImage, worldModel, worldAvatar } = await loadWorldData(db)

// Get local assets
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
await cleanUnusedBlueprints(db, blueprints, entities, DRY_RUN)

/**
 * Phase 2:
 * Remove all asset files that are not:
 * - referenced by a blueprint
 * - used as a player avatar
 * - used as the world image
 * - used as the world avatar
 * - used as the world model
 * The world no longer uses/needs them.
 */
const blueprintAssets = getBlueprintAssets(blueprints)
const filesToDelete = getAssetsToDelete(fileAssets, blueprintAssets, vrms, worldImage, worldModel, worldAvatar)

console.log(`deleting ${filesToDelete.length} assets`)
for (const fileAsset of filesToDelete) {
  const fullPath = path.join(assetsDir, fileAsset)
  await deleteFileLocal(fullPath, DRY_RUN)
}

console.log('Local cleanup completed')

// Close database connection before exiting
await db.destroy()
process.exit()
