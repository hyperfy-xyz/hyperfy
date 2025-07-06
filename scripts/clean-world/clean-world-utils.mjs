import fs from 'fs-extra'
import path from 'path'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'

/**
 * Clean World Utilities
 * Shared functions for world cleaning scripts (local and S3 storage)
 */

/**
 * Delete a file from local file system
 * @param {string} filepath - Full path to the file to delete
 * @param {boolean} dryRun - If true, don't actually delete the file
 * @returns {Promise<void>}
 */
export async function deleteFileLocal(filepath, dryRun = false) {
    if (!dryRun) {
        await fs.remove(filepath)
    }
    console.log('delete asset:', path.basename(filepath))
}

/**
 * Delete a file from S3 storage
 * @param {S3Client} s3Client - S3 client instance
 * @param {string} bucketName - S3 bucket name
 * @param {string} key - S3 object key
 * @param {boolean} dryRun - If true, don't actually delete the file
 * @returns {Promise<void>}
 */
export async function deleteFileS3(s3Client, bucketName, key, dryRun = false) {
    if (!dryRun) {
        const deleteCommand = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key,
        })
        await s3Client.send(deleteCommand)
    }
    console.log('delete S3 asset:', path.basename(key))
}

/**
 * Get database configuration based on environment variables
 * @param {string} world - World name for SQLite path
 * @returns {object} Knex configuration object
 */
export function getDBConfig(world = 'world') {
    const { DB_TYPE = '', DB_URL = '' } = process.env;

    if (!DB_TYPE && !DB_URL) {
        // Default: sqlite in world folder
        return {
            client: 'better-sqlite3',
            connection: { filename: `./${world}/db.sqlite` },
            useNullAsDefault: true,
        };
    }

    if (DB_TYPE === 'pg' && DB_URL) {
        return {
            client: 'pg',
            connection: DB_URL,
            pool: { min: 2, max: 10 },
        };
    }

    throw new Error('Unsupported or incomplete DB configuration. Only sqlite (default) and postgres (pg) via DB_TYPE/DB_URL are supported.');
}

/**
 * Load world data from database
 * @param {object} db - Knex database instance
 * @returns {object} Object containing blueprints, entities, vrms, and world settings
 */
export async function loadWorldData(db) {
    // Load blueprints
    const blueprints = new Set()
    const blueprintRows = await db('blueprints')
    for (const row of blueprintRows) {
        const blueprint = JSON.parse(row.data)
        blueprints.add(blueprint)
    }

    // Load entities
    const entities = []
    const entityRows = await db('entities')
    for (const row of entityRows) {
        const entity = JSON.parse(row.data)
        entities.push(entity)
    }

    // Load user avatars
    const vrms = new Set()
    const userRows = await db('users').select('avatar')
    for (const user of userRows) {
        if (!user.avatar) continue
        const avatar = user.avatar.replace('asset://', '')
        vrms.add(avatar)
    }

    // Load world settings
    let worldImage, worldModel, worldAvatar
    const settings = await db('config').where('key', 'settings').first()
    if (settings) {
        const settingsData = JSON.parse(settings.value)
        if (settingsData.image) worldImage = settingsData.image.url.replace('asset://', '')
        if (settingsData.model) worldModel = settingsData.model.url.replace('asset://', '')
        if (settingsData.avatar) worldAvatar = settingsData.avatar.url.replace('asset://', '')
    }

    return {
        blueprints,
        entities,
        vrms,
        worldImage,
        worldModel,
        worldAvatar
    }
}

/**
 * Get assets referenced by blueprints
 * @param {Set} blueprints - Set of blueprint objects
 * @returns {Set} Set of asset filenames referenced by blueprints
 */
export function getBlueprintAssets(blueprints) {
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
    return blueprintAssets
}

/**
 * Clean unused blueprints from database
 * @param {object} db - Knex database instance
 * @param {Set} blueprints - Set of blueprint objects
 * @param {Array} entities - Array of entity objects
 * @param {boolean} dryRun - If true, don't actually delete
 * @returns {Array} Array of deleted blueprint IDs
 */
export async function cleanUnusedBlueprints(db, blueprints, entities, dryRun = false) {
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
        if (!dryRun) {
            await db('blueprints').where('id', blueprint.id).delete()
        }
        console.log('delete blueprint:', blueprint.id)
    }

    return blueprintsToDelete
}

/**
 * Determine which assets should be deleted
 * @param {Set} assets - Set of asset filenames
 * @param {Set} blueprintAssets - Set of assets referenced by blueprints
 * @param {Set} vrms - Set of user avatar assets
 * @param {string} worldImage - World image asset filename
 * @param {string} worldModel - World model asset filename
 * @param {string} worldAvatar - World avatar asset filename
 * @returns {Array} Array of asset filenames to delete
 */
export function getAssetsToDelete(assets, blueprintAssets, vrms, worldImage, worldModel, worldAvatar) {
    const assetsToDelete = []
    for (const asset of assets) {
        const isUsedByBlueprint = blueprintAssets.has(asset)
        const isUsedByUser = vrms.has(asset)
        const isWorldImage = asset === worldImage
        const isWorldModel = asset === worldModel
        const isWorldAvatar = asset === worldAvatar
        if (!isUsedByBlueprint && !isUsedByUser && !isWorldModel && !isWorldAvatar && !isWorldImage) {
            assetsToDelete.push(asset)
        }
    }
    return assetsToDelete
} 