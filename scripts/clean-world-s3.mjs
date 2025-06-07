import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import Knex from 'knex'
import moment from 'moment'
import { fileURLToPath } from 'url'
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'

const DRY_RUN = false

const world = process.env.WORLD || 'world'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../')
const worldDir = path.join(rootDir, world)

// Initialize S3 if configured
let s3Client = null
let bucketName = null
let assetsPrefix = null

if (process.env.S3_BUCKET_NAME) {
  console.log('Using S3 storage for cleanup')
  s3Client = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })
  bucketName = process.env.S3_BUCKET_NAME
  assetsPrefix = process.env.S3_ASSETS_PREFIX || 'assets/'
} else {
  console.log('S3 not configured, exiting...')
  process.exit(1)
}

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

console.log('Cleanup completed')
process.exit() 