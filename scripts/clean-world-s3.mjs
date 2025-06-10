import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import Knex from 'knex'
import moment from 'moment'
import { fileURLToPath } from 'url'
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'

/**
 * Clean World S3 Script
 * Removes unused blueprints and S3 assets from the world database and AWS S3 storage.
 * Supports SQLite3 (default), PostgreSQL, and MySQL databases.
 * 
 * This script specifically targets AWS S3 storage cleanup.
 * Use regular clean-world.mjs for local file system cleanup.
 * 
 * Database configuration is read from environment variables:
 * - DB_TYPE: 'pg' (PostgreSQL), 'mysql2' (MySQL), or 'better-sqlite3' (SQLite - default)
 * - For PostgreSQL/MySQL: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 * - For SQLite: Uses local ./[world]/db.sqlite file
 * 
 * Storage configuration:
 * - STORAGE_TYPE must be set to 'aws'
 * - S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY required
 */

const DRY_RUN = false

const world = process.env.WORLD || 'world'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../')
const worldDir = path.join(rootDir, world)

function getDBConfig() {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_TYPE } = process.env;

  const config = {
    client: DB_TYPE || 'better-sqlite3',
  }

  if (DB_TYPE === 'pg' && DB_HOST && DB_PORT && DB_USER && DB_PASSWORD && DB_NAME) {
    config.connection = {
      host: DB_HOST,
      port: parseInt(DB_PORT),
      user: DB_USER,
      database: DB_NAME,
      password: DB_PASSWORD,
    }
    config.pool = {
      min: 2,
      max: 10
    }
  } else if (DB_TYPE === 'mysql2' && DB_HOST && DB_PORT && DB_USER && DB_PASSWORD && DB_NAME) {
    config.connection = {
      host: DB_HOST,
      port: parseInt(DB_PORT),
      user: DB_USER,
      database: DB_NAME,
      password: DB_PASSWORD,
      charset: 'utf8mb4',
      timezone: 'UTC'
    }
    config.pool = {
      min: 2,
      max: 10
    }
  } else {
    // SQLite fallback
    config.connection = {
      filename: `./${world}/db.sqlite`,
    }
    config.useNullAsDefault = true
  }

  return config;
}

// Initialize S3 if configured
let s3Client = null
let bucketName = null
let assetsPrefix = null

const storageType = process.env.STORAGE_TYPE || 'local'

if (storageType !== 'aws') {
  console.error('Error: This script requires STORAGE_TYPE=aws')
  console.error('For local file system cleanup, use clean-world.mjs instead')
  process.exit(1)
}

if (!process.env.S3_BUCKET_NAME) {
  console.error('Error: S3_BUCKET_NAME is required when STORAGE_TYPE=aws')
  process.exit(1)
}

console.log('Using AWS S3 storage for cleanup')
s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})
bucketName = process.env.S3_BUCKET_NAME
assetsPrefix = process.env.S3_ASSETS_PREFIX || 'assets/'

const dbConfig = getDBConfig()
const db = Knex(dbConfig)

console.log(`Using database: ${dbConfig.client}`)
if (dbConfig.client === 'better-sqlite3') {
  console.log(`SQLite file: ${dbConfig.connection.filename}`)
} else {
  console.log(`Database: ${dbConfig.connection.database} on ${dbConfig.connection.host}:${dbConfig.connection.port}`)
}
console.log(`S3 Bucket: ${bucketName}`)
console.log(`Assets Prefix: ${assetsPrefix}`)

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
 * Remove all S3 asset files that are not:
 * - referenced by a blueprint
 * - used as a player avatar
 * - used as the world image
 * - used as the world avatar
 * - used as the world model
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

const s3FilesToDelete = []
for (const s3Asset of s3Assets) {
  const isUsedByBlueprint = blueprintAssets.has(s3Asset)
  const isUsedByUser = vrms.has(s3Asset)
  const isWorldImage = s3Asset === worldImage
  const isWorldModel = s3Asset === worldModel
  const isWorldAvatar = s3Asset === worldAvatar
  if (!isUsedByBlueprint && !isUsedByUser && !isWorldModel && !isWorldAvatar && !isWorldImage) {
    s3FilesToDelete.push(s3Asset)
  }
}

console.log(`deleting ${s3FilesToDelete.length} S3 assets`)
for (const s3Asset of s3FilesToDelete) {
  const s3Key = `${assetsPrefix}${s3Asset}`
  if (!DRY_RUN) {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    })
    await s3Client.send(deleteCommand)
  }
  console.log('delete S3 asset:', s3Asset)
}

console.log('S3 cleanup completed')

// Close database connection before exiting
await db.destroy()
process.exit() 