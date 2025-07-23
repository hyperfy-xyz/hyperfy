import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import Knex from 'knex'
import { fileURLToPath } from 'url'
import { DeleteObjectCommand, S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const DRY_RUN = false
const world = process.env.WORLD || 'world'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../')
const worldDir = path.join(rootDir, world)
const assetsDir = path.join(worldDir, '/assets')

/**
 * Parse S3 URI to extract configuration
 * @param {string} uri - The S3 URI
 * @returns {object} Parsed S3 configuration
 */
function parseS3Uri(uri) {
  try {
    const url = new URL(uri)

    if (url.protocol !== 's3:') {
      throw new Error('URI must start with s3://')
    }

    const bucketName = url.hostname
    if (!bucketName) {
      throw new Error('Bucket name is required in S3 URI')
    }

    // Extract prefix from pathname, removing leading slash
    let assetsPrefix = url.pathname.slice(1)
    if (assetsPrefix && !assetsPrefix.endsWith('/')) {
      assetsPrefix += '/'
    }
    if (!assetsPrefix) {
      assetsPrefix = 'assets/'
    }

    // Parse query parameters
    const region = url.searchParams.get('region') || 'us-east-1'

    return {
      bucketName,
      region,
      assetsPrefix,
    }
  } catch (error) {
    throw new Error(`Invalid S3 URI: ${error.message}`)
  }
}

/**
 * Get storage configuration from environment
 * @returns {object} Storage configuration
 */
function getStorageConfig() {
  // Check if STORAGE_URL is provided for S3
  if (process.env.STORAGE_URL && process.env.STORAGE_URL.startsWith('s3://')) {
    const config = parseS3Uri(process.env.STORAGE_URL)

    // Add credentials if provided
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    }

    return { type: 's3', ...config }
  }

  // Default to local storage
  return { type: 'local' }
}

// Database configuration
const { DB_URL = '', DB_SCHEMA = '' } = process.env
let dbConfig

// Auto-detect database type from DB_URL
if (DB_URL) {
  if (DB_URL.startsWith('postgres://') || DB_URL.startsWith('postgresql://')) {
    dbConfig = {
      client: 'pg',
      connection: DB_URL,
      pool: { min: 2, max: 10 },
    }
  } else {
    throw new Error(`Unsupported database URL: ${DB_URL}. Only PostgreSQL URLs (postgres://) are supported.`)
  }
} else {
  // Default: SQLite in world folder
  dbConfig = {
    client: 'better-sqlite3',
    connection: { filename: `./${world}/db.sqlite` },
    useNullAsDefault: true,
  }
}

const db = Knex(dbConfig)

// Set schema for PostgreSQL connections
if (dbConfig.client === 'pg' && DB_SCHEMA) {
  await db.raw(`SET search_path TO "${DB_SCHEMA}", public`)
}

// Storage configuration
const storageConfig = getStorageConfig()
const storageType = storageConfig.type

// S3 configuration if needed
let s3Client, bucketName, assetsPrefix
if (storageType === 's3') {
  const clientConfig = {
    region: storageConfig.region,
  }

  if (storageConfig.credentials) {
    clientConfig.credentials = storageConfig.credentials
  }

  s3Client = new S3Client(clientConfig)
  bucketName = storageConfig.bucketName
  assetsPrefix = storageConfig.assetsPrefix
}

console.log(`Using ${storageType.toUpperCase()} storage`)

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

// Get assets from storage (local or S3)
const fileAssets = new Set()

if (storageType === 's3') {
  // List S3 assets
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
          fileAssets.add(filename)
        }
      }
    }

    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  console.log(`Found ${fileAssets.size} S3 assets`)
} else {
  // List local assets
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
}

let worldImage
let worldModel
let worldAvatar
let settings = await db('config').where('key', 'settings').first()
if (settings) {
  settings = JSON.parse(settings.value)
  if (settings.image) worldImage = settings.image.url.replace('asset://', '')
  if (settings.model) worldModel = settings.model.url.replace('asset://', '')
  if (settings.avatar) worldAvatar = settings.avatar.url.replace('asset://', '')
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
 * Remove all asset files that are not:
 * - referenced by a blueprint
 * - used as a player avatar
 * - used as the world image
 * - used as the world avatar
 * - used as the world model
 * The world no longer uses/needs them.
 *
 */

const blueprintAssets = new Set()
for (const blueprint of blueprints) {
  if (blueprint.model && blueprint.model.startsWith('asset://')) {
    const asset = blueprint.model.replace('asset://', '')
    blueprintAssets.add(asset)
  }
  if (blueprint.script && blueprint.script.startsWith('asset://')) {
    const asset = blueprint.script.replace('asset://', '')
    blueprintAssets.add(asset)
  }
  if (blueprint.image?.url && blueprint.image.url.startsWith('asset://')) {
    const asset = blueprint.image.url.replace('asset://', '')
    blueprintAssets.add(asset)
  }
  for (const key in blueprint.props) {
    const url = blueprint.props[key]?.url
    if (!url) continue
    const asset = url.replace('asset://', '')
    blueprintAssets.add(asset)
  }
}

const filesToDelete = []
for (const fileAsset of fileAssets) {
  const isUsedByBlueprint = blueprintAssets.has(fileAsset)
  const isUsedByUser = vrms.has(fileAsset)
  const isWorldImage = fileAsset === worldImage
  const isWorldModel = fileAsset === worldModel
  const isWorldAvatar = fileAsset === worldAvatar
  if (!isUsedByBlueprint && !isUsedByUser && !isWorldModel && !isWorldAvatar && !isWorldImage) {
    filesToDelete.push(fileAsset)
  }
}

console.log(`deleting ${filesToDelete.length} assets`)
for (const fileAsset of filesToDelete) {
  if (storageType === 's3') {
    // Delete from S3
    const s3Key = `${assetsPrefix}${fileAsset}`
    if (!DRY_RUN) {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
      })
      await s3Client.send(deleteCommand)
    }
    console.log('delete asset:', fileAsset)
  } else {
    // Delete from local filesystem
    const fullPath = path.join(assetsDir, fileAsset)
    if (!DRY_RUN) {
      fs.removeSync(fullPath)
    }
    console.log('delete asset:', fileAsset)
  }
}

console.log(`${storageType.toUpperCase()} cleanup completed`)

// Close database connection before exiting
await db.destroy()
process.exit() 
