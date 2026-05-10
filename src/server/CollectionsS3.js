import { importApp } from '../core/extras/appTools'
import { assets } from './assets'

export class CollectionsS3 {
  constructor() {
    this.baseUrl = process.env.COLLECTIONS_BASE_URL
    if (!this.baseUrl) {
      throw new Error('COLLECTIONS_BASE_URL environment variable is required')
    }
    
    // Ensure baseUrl ends with /
    if (!this.baseUrl.endsWith('/')) {
      this.baseUrl += '/'
    }
  }

  async init({ rootDir, worldDir }) {
    console.log('[collections] initializing from CloudFront')
    this.list = []
    this.blueprints = new Set()

    // List all collection folders from CloudFront
    const collectionFolders = await this.listCollectionFolders()
    
    for (const folderName of collectionFolders) {
      try {
        const collection = await this.loadCollection(folderName)
        if (collection) {
          this.list.push(collection)
          for (const blueprint of collection.blueprints) {
            this.blueprints.add(blueprint)
          }
        }
      } catch (error) {
        console.error(`[collections] Failed to load collection ${folderName}:`, error)
      }
    }
  }

  async listCollectionFolders() {
    // For now, we'll use a predefined list or try to discover collections
    // This could be enhanced to read from a collections index file
    const commonCollections = ['default']
    
    // Try to discover collections by checking for manifest.json
    const discoveredCollections = []
    for (const collectionName of commonCollections) {
      try {
        const manifestUrl = `${this.baseUrl}${collectionName}/manifest.json`
        const response = await fetch(manifestUrl)
        if (response.ok) {
          discoveredCollections.push(collectionName)
        }
      } catch (error) {
        // Collection doesn't exist, skip
      }
    }
    
    return discoveredCollections
  }

  async loadCollection(folderName) {
    try {
      // Load manifest.json from CloudFront
      const manifestUrl = `${this.baseUrl}${folderName}/manifest.json`
      const manifestResponse = await fetch(manifestUrl)
      
      if (!manifestResponse.ok) {
        throw new Error(`Failed to fetch manifest: ${manifestResponse.status}`)
      }
      
      const manifest = await manifestResponse.json()

      const blueprints = []
      
      // Load each app file from CloudFront
      for (const appFilename of manifest.apps) {
        const appUrl = `${this.baseUrl}${folderName}/${appFilename}`
        const appResponse = await fetch(appUrl)
        
        if (!appResponse.ok) {
          throw new Error(`Failed to fetch app ${appFilename}: ${appResponse.status}`)
        }
        
        const appBuffer = await appResponse.arrayBuffer()
        const appFile = new File([appBuffer], appFilename, {
          type: 'application/octet-stream',
        })
        
        const app = await importApp(appFile)
        
        // Upload assets to the main assets system
        for (const asset of app.assets) {
          await assets.upload(asset.file)
        }
        
        blueprints.push(app.blueprint)
      }

      return {
        id: folderName,
        name: manifest.name,
        blueprints,
      }
    } catch (error) {
      console.error(`Failed to load collection ${folderName}:`, error)
      return null
    }
  }
}
