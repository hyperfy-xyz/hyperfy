import 'dotenv-flow/config'
import path from 'path'
import Knex from 'knex'
import { fileURLToPath } from 'url'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import {
  getDBConfig,
  loadWorldData,
  getBlueprintAssets,
  cleanUnusedBlueprints,
  getAssetsToDelete,
  deleteFileS3
} from './clean-world-utils.mjs'

/**
 * Clean World S3 Script
 * Removes unused blueprints and S3 assets from the world database and S3-compatible storage.
 * 
 * Database configuration is read from environment variables:
 * - DB_TYPE and DB_URL for PostgreSQL
 * - Defaults to SQLite in world folder
 * 
 * Storage configuration:
 * - STORAGE_TYPE must be set to 's3'
 * - S3_BUCKET_NAME, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY required
 */

const DRY_RUN = false
const world = process.env.WORLD || 'world'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../../')

// Validate S3 configuration
const storageType = process.env.STORAGE_TYPE || 'local'

if (storageType !== 's3') {
  console.error('Error: This script requires STORAGE_TYPE=s3')
  console.error('For local file system cleanup, use clean-world.mjs instead')
  process.exit(1)
}

if (!process.env.S3_BUCKET_NAME) {
  console.error('Error: S3_BUCKET_NAME is required when STORAGE_TYPE=s3')
  process.exit(1)
}

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
})
const bucketName = process.env.S3_BUCKET_NAME
const assetsPrefix = process.env.S3_ASSETS_PREFIX || 'assets/'

// Initialize database
const dbConfig = getDBConfig(world)
const db = Knex(dbConfig)

// Load world data
const { blueprints, entities, vrms, worldImage, worldModel, worldAvatar } = await loadWorldData(db)

// Get list of files in S3
const s3Assets = new Set()
console.log('Fetching S3 assets...')
let continuationToken = undefined
do {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: assetsPrefix,
    ContinuationToken: continuationToken,
  })

  const response = await s3Client.send(command)

  if (response.Contents) {
    for (const object of response.Contents) {
      const key = object.Key
      const filename = key.replace(assetsPrefix, '')

      // Check if it's a hashed asset (64 character hash)
      const isAsset = filename.split('.')[0].length === 64
      if (isAsset) {
        s3Assets.add(filename)
      }
    }
  }

  continuationToken = response.NextContinuationToken
} while (continuationToken)

console.log(`Found ${s3Assets.size} S3 assets`)

/**
 * Phase 1:
 * Remove all blueprints that no entities reference any more.
 * The world doesn't need them, and we shouldn't be loading them in and sending dead blueprints to all the clients.
 */
await cleanUnusedBlueprints(db, blueprints, entities, DRY_RUN)

/**
 * Phase 2:
 * Remove all S3 asset files that are not:
 * - referenced by a blueprint
 * - used as a player avatar
 * - used as the world image
 * - used as the world avatar
 * - used as the world model
 */
const blueprintAssets = getBlueprintAssets(blueprints)
const s3FilesToDelete = getAssetsToDelete(s3Assets, blueprintAssets, vrms, worldImage, worldModel, worldAvatar)

console.log(`deleting ${s3FilesToDelete.length} S3 assets`)
for (const s3Asset of s3FilesToDelete) {
  const s3Key = `${assetsPrefix}${s3Asset}`
  await deleteFileS3(s3Client, bucketName, s3Key, DRY_RUN)
}

console.log('S3 cleanup completed')

// Close database connection before exiting
await db.destroy()
process.exit() 