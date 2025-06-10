import path from 'path'
import { throttle } from 'lodash-es'

import { AwsS3Storage } from './AwsS3Storage.js'
import { FileStorage } from './FileStorage.js'

export class StorageManager {
  constructor() {
    this.storage = null
    this.isS3 = false
    this.storageData = {}
    this.storageLoaded = false
    
    // Throttle saves to avoid too many writes
    this.saveStorageData = throttle(() => this.persistStorageData(), 1000, { leading: true, trailing: true })
  }

  /**
   * Initialize storage based on environment configuration
   */
  async initialize() {
    const storageType = process.env.STORAGE_TYPE || 'local'
    
    if (storageType === 'aws') {
      // Validate required S3 configuration
      if (!process.env.S3_BUCKET_NAME) {
        throw new Error('S3_BUCKET_NAME is required when STORAGE_TYPE=aws')
      }
      
      // Initialize S3 storage
      this.isS3 = true
      const s3Config = {
        bucketName: process.env.S3_BUCKET_NAME,
        region: process.env.S3_REGION || 'us-east-1',
        assetsPrefix: process.env.S3_ASSETS_PREFIX || 'assets/',
        collectionsPrefix: process.env.S3_COLLECTIONS_PREFIX || 'collections/',
        storagePrefix: process.env.S3_STORAGE_PREFIX || 'storage/',
        cloudfrontUrl: process.env.CLOUDFRONT_URL,
      }
      
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        s3Config.credentials = {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      }
      
      this.storage = new AwsS3Storage(s3Config)
      
      console.log('Initializing AWS S3 storage...')
      await this.storage.initialize()
      
    } else if (storageType === 'local') {
      // Initialize local file storage
      this.isS3 = false
      this.storage = new FileStorage({
        assetsUrl: '/assets/',
      })
      
      console.log('Initializing local file storage...')
      await this.storage.initialize()
    } else {
      throw new Error(`Unsupported storage type: ${storageType}. Supported types: 'local', 'aws'`)
    }

    // Initialize storage data
    await this.initStorageData()
  }

  /**
   * Initialize the storage data by loading existing storage.json
   */
  async initStorageData() {
    try {
      this.storageData = await this.storage.loadStorageData()
      this.storageLoaded = true
      console.log('Storage data loaded successfully')
    } catch (err) {
      console.error('Error loading storage data:', err)
      this.storageData = {}
      this.storageLoaded = true
    }
  }

  /**
   * Get a value from storage.json data
   * @param {string} key - The key to retrieve
   * @returns {any} The stored value
   */
  getStorageValue(key) {
    if (!this.storageLoaded) {
      console.warn('Storage not yet loaded, returning undefined')
      return undefined
    }
    return this.storageData[key]
  }

  /**
   * Set a value in storage.json data
   * @param {string} key - The key to set
   * @param {any} value - The value to store
   */
  setStorageValue(key, value) {
    if (!this.storageLoaded) {
      console.warn('Storage not yet loaded, cannot set value')
      return
    }
    
    try {
      // Ensure value is serializable
      value = JSON.parse(JSON.stringify(value))
      this.storageData[key] = value
      this.saveStorageData()
    } catch (err) {
      console.error('Error setting storage value:', err)
    }
  }

  /**
   * Persist storage data (throttled)
   */
  async persistStorageData() {
    if (!this.storageLoaded) {
      console.warn('Storage not yet loaded, cannot persist')
      return
    }
    
    try {
      await this.storage.saveStorageData(this.storageData)
      // console.log('Storage data persisted successfully')
    } catch (err) {
      console.error('Failed to persist storage:', err)
    }
  }

  /**
   * Force an immediate save of storage data (bypass throttling)
   */
  async forceStorageDataPersist() {
    return await this.persistStorageData()
  }

  /**
   * Get a value from storage.json data (interface for world system)
   * @param {string} key - The key to retrieve
   * @returns {any} The stored value
   */
  get(key) {
    return this.getStorageValue(key)
  }

  /**
   * Set a value in storage.json data (interface for world system)
   * @param {string} key - The key to set
   * @param {any} value - The value to store
   */
  set(key, value) {
    this.setStorageValue(key, value)
  }

  /**
   * Configure Fastify instance with appropriate static file serving
   * @param {object} fastify - The Fastify instance
   * @param {object} statics - The @fastify/static plugin
   */
  configureStaticServing(fastify, statics) {
    if (!this.isS3) {
      // Only register local assets serving when not using S3
      const paths = this.storage.getPaths()
      fastify.register(statics, {
        root: paths.assetsDir,
        prefix: '/assets/',
        decorateReply: false,
        setHeaders: res => {
          // all assets are hashed & immutable so we can use aggressive caching
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable') // 1 year
          res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString()) // older browsers
        },
      })
    }
    // For S3, files are served directly from S3/CloudFront, no local serving needed
  }

  /**
   * Get the assets URL based on storage type and CloudFront configuration
   * @returns {string} The assets URL
   */
  getAssetsUrl() {
    if (this.isS3) {
      // If CloudFront URL is configured, use it with assets prefix
      if (process.env.CLOUDFRONT_URL) {
        const baseUrl = process.env.CLOUDFRONT_URL.endsWith('/') 
          ? process.env.CLOUDFRONT_URL.slice(0, -1)  // Remove trailing slash
          : process.env.CLOUDFRONT_URL
        const assetsPrefix = (process.env.S3_ASSETS_PREFIX || 'assets/').replace(/\/$/, '') // Remove trailing slash
        return `${baseUrl}/${assetsPrefix}`
      }
      // Otherwise use S3 direct URL
      const assetsPrefix = (process.env.S3_ASSETS_PREFIX || 'assets/').replace(/\/$/, '') // Remove trailing slash
      return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${assetsPrefix}`
    } else {
      return process.env.PUBLIC_ASSETS_URL || '/assets'  // No trailing slash for local
    }
  }

  /**
   * Get paths for local storage (when not using S3)
   * @returns {object|null} Object with paths or null if using S3
   */
  getPaths() {
    if (!this.isS3 && this.storage.getPaths) {
      return this.storage.getPaths()
    }
    return null
  }

  /**
   * Get the database path based on storage type
   * @returns {string} The database path
   */
  getDbPath() {
    const paths = this.getPaths()
    return paths ? path.join(paths.worldDir, '/db.sqlite') : './world/db.sqlite'
  }

  /**
   * Upload a file
   * @param {string} filename - The filename
   * @param {Buffer} buffer - The file data
   * @param {string} contentType - The MIME type
   * @returns {Promise<string>} The file URL
   */
  async uploadFile(filename, buffer, contentType) {
    if (!this.storage) {
      throw new Error('Storage not initialized')
    }
    return await this.storage.uploadFile(filename, buffer, contentType)
  }

  /**
   * Check if a file exists
   * @param {string} filename - The filename
   * @returns {Promise<boolean>}
   */
  async fileExists(filename) {
    if (!this.storage) {
      throw new Error('Storage not initialized')
    }
    return await this.storage.fileExists(filename)
  }

  /**
   * Get the public URL for a file
   * @param {string} filename - The filename
   * @returns {string}
   */
  getPublicUrl(filename) {
    if (!this.storage) {
      throw new Error('Storage not initialized')
    }
    return this.storage.getPublicUrl(filename)
  }

  /**
   * Delete a file
   * @param {string} filename - The filename
   * @returns {Promise<boolean>}
   */
  async deleteFile(filename) {
    if (!this.storage) {
      throw new Error('Storage not initialized')
    }
    return await this.storage.deleteFile(filename)
  }

  /**
   * List all files
   * @returns {Promise<string[]>}
   */
  async listFiles() {
    if (!this.storage) {
      throw new Error('Storage not initialized')
    }
    return await this.storage.listFiles()
  }

  /**
   * Get file stats
   * @param {string} filename - The filename
   * @returns {Promise<object|null>}
   */
  async getFileStats(filename) {
    if (!this.storage) {
      throw new Error('Storage not initialized')
    }
    return await this.storage.getFileStats(filename)
  }

  /**
   * Upload a collection file
   * @param {string} filename - The collection filename
   * @param {Buffer} buffer - The file data
   * @returns {Promise<string>} The file path/key
   */
  async uploadCollection(filename, buffer) {
    if (!this.storage) {
      throw new Error('Storage not initialized')
    }
    return await this.storage.uploadCollection(filename, buffer)
  }

  /**
   * Read a collection file
   * @param {string} filename - The collection filename
   * @returns {Promise<Buffer|null>} The file data or null if not found
   */
  async readCollection(filename) {
    if (!this.storage) {
      throw new Error('Storage not initialized')
    }
    return await this.storage.readCollection(filename)
  }

  /**
   * List collection files
   * @returns {Promise<string[]>} Array of collection filenames
   */
  async listCollections() {
    if (!this.storage) {
      throw new Error('Storage not initialized')
    }
    return await this.storage.listCollections()
  }

  /**
   * Get signed upload URL (S3 only)
   * @param {string} filename - The filename
   * @param {string} contentType - The MIME type
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {Promise<string>}
   */
  async getPresignedUploadUrl(filename, contentType, expiresIn = 300) {
    if (!this.storage) {
      throw new Error('Storage not initialized')
    }
    if (!this.isS3) {
      throw new Error('Presigned URLs are only available with S3 storage')
    }
    return await this.storage.getPresignedUploadUrl(filename, contentType, expiresIn)
  }

  /**
   * Get signed download URL (S3 only)
   * @param {string} filename - The filename
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {Promise<string>}
   */
  async getPresignedDownloadUrl(filename, expiresIn = 3600) {
    if (!this.storage) {
      throw new Error('Storage not initialized')
    }
    if (!this.isS3) {
      throw new Error('Presigned URLs are only available with S3 storage')
    }
    return await this.storage.getPresignedDownloadUrl(filename, expiresIn)
  }
} 