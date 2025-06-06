import path from 'path'
import fs from 'fs-extra'

import { importApp } from '../../core/extras/appTools'

export async function initCollections({ storageManager }) {
  console.log('[Collections] Starting collections initialization...')
  const collections = []
  
  try {
    // Load from collections storage (both S3 and local now use the same logic)
    await initCollectionsFromStorage(storageManager, collections)
    console.log(`[Collections] Total collections loaded: ${collections.length}`)
  } catch (error) {
    console.error('[Collections] Error initializing collections:', error)
    // Ensure we always return an array, even if empty
  }
  
  console.log('[Collections] Collections initialization complete')
  return collections
}

async function initCollectionsFromStorage(storageManager, collections) {
  try {
    console.log('[Collections] Loading collections from storage...')
    
    // List all collection files
    const collectionFiles = await storageManager.listCollections()
    console.log(`[Collections] Found ${collectionFiles.length} files in storage:`, collectionFiles)
    
    // If no files found, just return - the main function will handle fallback
    if (collectionFiles.length === 0) {
      console.log('[Collections] No collection files found in storage')
      return
    }
    
    // Group files by collection (manifest files indicate collection folders)
    const collectionManifests = collectionFiles.filter(file => file.endsWith('/manifest.json'))
    console.log(`[Collections] Found ${collectionManifests.length} manifest files:`, collectionManifests)
    
    // If no manifests found, return
    if (collectionManifests.length === 0) {
      console.log('[Collections] No manifest files found')
      return
    }
    
    for (const manifestFile of collectionManifests) {
      const collectionId = manifestFile.replace('/manifest.json', '')
      console.log(`[Collections] Processing collection: ${collectionId}`)
      
      try {
        // Read manifest
        const manifestBuffer = await storageManager.readCollection(manifestFile)
        if (!manifestBuffer) {
          console.warn(`[Collections] Manifest buffer is empty for: ${manifestFile}`)
          continue
        }
        
        const manifest = JSON.parse(manifestBuffer.toString())
        const blueprints = []
        
        console.log(`[Collections] Collection ${collectionId} has ${manifest.apps?.length || 0} apps`)
        
        // Process each app in the manifest
        for (const appFilename of manifest.apps || []) {
          const appFile = `${collectionId}/${appFilename}`
          console.log(`[Collections] Loading app: ${appFile}`)
          
          try {
            const appBuffer = await storageManager.readCollection(appFile)
            
            if (!appBuffer) {
              console.warn(`[Collections] App file not found in storage: ${appFile}`)
              continue
            }
            
            const file = new File([appBuffer], appFilename, {
              type: 'application/octet-stream',
            })
            
            // Process assets for ALL collections (built-in and user collections)
            // All collections need their assets to be properly saved to storage
            const app = await importApp(file)
            console.log(`[Collections] Collection ${collectionId} app ${appFilename} imported with ${app.assets?.length || 0} assets`)
            
            // Upload/save assets to storage if they don't exist  
            for (const asset of app.assets || []) {
              const assetFilename = asset.url.slice(8) // remove 'asset://' prefix
              console.log(`[Collections] Processing asset: ${assetFilename} for collection ${collectionId}`)
              
              try {
                const exists = await storageManager.fileExists(assetFilename)
                console.log(`[Collections] Asset ${assetFilename} exists: ${exists}`)
                
                if (!exists) {
                  console.log(`[Collections] Uploading missing asset: ${assetFilename}`)
                  const arrayBuffer = await asset.file.arrayBuffer()
                  const buffer = Buffer.from(arrayBuffer)
                  const contentType = asset.file.type || 'application/octet-stream'
                  await storageManager.uploadFile(assetFilename, buffer, contentType)
                  console.log(`[Collections] Asset uploaded successfully: ${assetFilename}`)
                } else {
                  console.log(`[Collections] Asset already exists: ${assetFilename}`)
                }
              } catch (assetError) {
                console.error(`[Collections] Error handling asset ${assetFilename}:`, assetError.message)
                // Continue with other assets even if one fails
              }
            }
            
            blueprints.push(app.blueprint)
            
          } catch (appError) {
            console.error(`[Collections] Error processing app ${appFile}:`, appError.message)
            // Continue with other apps even if one fails
          }
        }
        
        if (blueprints.length > 0) {
          collections.push({
            id: collectionId,
            name: manifest.name || collectionId,
            blueprints: blueprints || [],
          })
          console.log(`[Collections] Successfully loaded collection ${collectionId} with ${blueprints.length} blueprints`)
        } else {
          console.warn(`[Collections] Collection ${collectionId} has no valid blueprints`)
          // Still add the collection but with empty blueprints array
          collections.push({
            id: collectionId,
            name: manifest.name || collectionId,
            blueprints: [],
          })
        }
        
      } catch (error) {
        console.error(`[Collections] Error processing collection ${collectionId}:`, error.message)
      }
    }
    
    // Sort collections (default first, then alphabetically)
    collections.sort((a, b) => {
      if (a.id === 'default') return -1
      if (b.id === 'default') return 1
      return a.id.localeCompare(b.id)
    })
    
    console.log(`[Collections] Successfully loaded ${collections.length} collections from storage`)
    
  } catch (error) {
    console.error('[Collections] Error loading collections from storage:', error)
  }
}

async function initCollectionsFromLocal(collectionsDir, assetsDir, collections) {
  try {
    console.log('[Collections] Loading collections from local filesystem...')
    let folderNames = fs.readdirSync(collectionsDir)
    folderNames.sort((a, b) => {
      // keep "default" first then sort alphabetically
      if (a === 'default') return -1
      if (b === 'default') return 1
      return a.localeCompare(b)
    })
    
    console.log(`[Collections] Found ${folderNames.length} collection folders`)
    
    for (const folderName of folderNames) {
      const folderPath = path.join(collectionsDir, folderName)
      const stats = fs.statSync(folderPath)
      if (!stats.isDirectory()) continue
      
      console.log(`[Collections] Processing local collection: ${folderName}`)
      
      const manifestPath = path.join(folderPath, 'manifest.json')
      if (!fs.existsSync(manifestPath)) {
        console.warn(`[Collections] No manifest.json found in: ${folderPath}`)
        continue
      }
      
      try {
        const manifest = fs.readJsonSync(manifestPath)
        const blueprints = []
        
        console.log(`[Collections] Collection ${folderName} has ${manifest.apps?.length || 0} apps`)
        
        for (const appFilename of manifest.apps || []) {
          const appPath = path.join(folderPath, appFilename)
          console.log(`[Collections] Loading local app: ${appPath}`)
          
          try {
            const appBuffer = fs.readFileSync(appPath)
            const appFile = new File([appBuffer], appFilename, {
              type: 'application/octet-stream',
            })
            
            const app = await importApp(appFile)
            console.log(`[Collections] Local app ${appFilename} imported successfully, has ${app.assets?.length || 0} assets`)
            
            // Save assets to local filesystem if they don't exist
            for (const asset of app.assets || []) {
              const file = asset.file
              const assetFilename = asset.url.slice(8) // remove 'asset://' prefix
              const assetPath = path.join(assetsDir, assetFilename)
              
              try {
                const exists = await fs.exists(assetPath)
                if (exists) {
                  console.log(`[Collections] Local asset already exists: ${assetFilename}`)
                  continue
                }
                
                console.log(`[Collections] Saving missing local asset: ${assetFilename}`)
                const arrayBuffer = await file.arrayBuffer()
                await fs.writeFile(assetPath, Buffer.from(arrayBuffer))
                console.log(`[Collections] Local asset saved successfully: ${assetFilename}`)
              } catch (assetError) {
                console.error(`[Collections] Error handling local asset ${assetFilename}:`, assetError.message)
                // Continue with other assets even if one fails
              }
            }
            
            blueprints.push(app.blueprint)
            
          } catch (appError) {
            console.error(`[Collections] Error processing local app ${appFilename}:`, appError.message)
            // Continue with other apps even if one fails
          }
        }
        
        if (blueprints.length > 0) {
          collections.push({
            id: folderName,
            name: manifest.name || folderName,
            blueprints: blueprints || [],
          })
          console.log(`[Collections] Successfully loaded local collection ${folderName} with ${blueprints.length} blueprints`)
        } else {
          console.warn(`[Collections] Local collection ${folderName} has no valid blueprints`)
          // Still add the collection but with empty blueprints array
          collections.push({
            id: folderName,
            name: manifest.name || folderName,
            blueprints: [],
          })
        }
        
      } catch (error) {
        console.error(`[Collections] Error processing local collection ${folderName}:`, error.message)
      }
    }
    
    console.log(`[Collections] Successfully loaded ${collections.length} collections from local filesystem`)
    
  } catch (error) {
    console.error('[Collections] Error loading collections from local filesystem:', error)
  }
}

/**
 * Upload a collection to storage (S3 or local)
 * @param {object} storageManager - The storage manager instance
 * @param {string} collectionId - The collection ID
 * @param {object} manifest - The collection manifest
 * @param {Array} appFiles - Array of app files to upload
 */
export async function uploadCollection(storageManager, collectionId, manifest, appFiles) {
  try {
    // Upload manifest
    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2))
    await storageManager.uploadCollection(`${collectionId}/manifest.json`, manifestBuffer)
    
    // Upload app files
    for (const appFile of appFiles) {
      const appBuffer = Buffer.from(await appFile.arrayBuffer())
      await storageManager.uploadCollection(`${collectionId}/${appFile.name}`, appBuffer)
    }
    
    console.log(`Collection ${collectionId} uploaded successfully`)
  } catch (error) {
    console.error(`Error uploading collection ${collectionId}:`, error)
    throw error
  }
} 