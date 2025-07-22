import path from 'path'
import { throttle } from 'lodash-es'

import { S3Storage } from './S3Storage.js'
import { FileStorage } from './FileStorage.js'

export class StorageManager {
  static STORAGE_TYPE = {
    LOCAL: 'local',
    S3: 's3',
  }

  constructor() {
    this.storage = null
    this.isS3 = false
    this.storageData = {}
    this.storageLoaded = false

    // Throttle saves to avoid too many writes
    this.saveStorageData = throttle(() => this.persistStorageData(), 1000, { leading: true, trailing: true })
  }

  /**
   * Parse S3 URI to extract configuration
   * Examples:
   * - s3://bucket-name/assets/
   * - s3://bucket-name/assets/?region=us-east-1
   * - s3://bucket-name/assets/?region=eu-west-1&collections_prefix=collections/&storage_prefix=storage/
   * @param {string} uri - The S3 URI
   * @returns {object} Parsed S3 configuration
   */
  static parseS3Uri(uri) {
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
      const collectionsPrefix = url.searchParams.get('collections_prefix') || 'collections/'
      const storagePrefix = url.searchParams.get('storage_prefix') || 'storage/'
      const cloudfrontUrl = url.searchParams.get('cloudfront_url') || undefined

      return {
        bucketName,
        region,
        assetsPrefix,
        collectionsPrefix,
        storagePrefix,
        cloudfrontUrl,
      }
    } catch (error) {
      throw new Error(`Invalid S3 URI: ${error.message}`)
    }
  }

  /**
   * Get S3 configuration from environment (URI or individual variables)
   * @returns {object} S3 configuration object
   */
  static getS3Config() {
    // Check if STORAGE_URL is provided (new URI approach)
    if (process.env.STORAGE_URL && process.env.STORAGE_URL.startsWith('s3://')) {
      const config = StorageManager.parseS3Uri(process.env.STORAGE_URL)

      // Add credentials if provided via standard AWS env vars
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        config.credentials = {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      } else if (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
        // Fallback to S3_* prefixed credentials for backward compatibility
        config.credentials = {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        }
      }

      return config
    }

    // Fallback to individual environment variables (legacy approach)
    if (!process.env.S3_BUCKET_NAME) {
      throw new Error('Either STORAGE_URL (s3://) or S3_BUCKET_NAME is required when STORAGE_TYPE=s3')
    }

    const config = {
      bucketName: process.env.S3_BUCKET_NAME,
      region: process.env.S3_REGION || 'us-east-1',
      assetsPrefix: process.env.S3_ASSETS_PREFIX || 'assets/',
      collectionsPrefix: process.env.S3_COLLECTIONS_PREFIX || 'collections/',
      storagePrefix: process.env.S3_STORAGE_PREFIX || 'storage/',
      cloudfrontUrl: process.env.CLOUDFRONT_URL,
    }

    if (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      }
    }

    return config
  }

  /**
   * Initialize storage based on environment configuration
   */
  async initialize() {
    // Determine storage type
    let storageType = process.env.STORAGE_TYPE || StorageManager.STORAGE_TYPE.LOCAL

    // Auto-detect S3 from STORAGE_URL if no explicit STORAGE_TYPE
    if (!process.env.STORAGE_TYPE && process.env.STORAGE_URL?.startsWith('s3://')) {
      storageType = StorageManager.STORAGE_TYPE.S3
    }

    if (storageType === StorageManager.STORAGE_TYPE.S3) {
      // Get S3 configuration (URI or legacy env vars)
      const s3Config = StorageManager.getS3Config()

      // Initialize S3 storage
      this.isS3 = true
      this.storage = new S3Storage(s3Config)

      console.log(`Initializing S3 storage... (bucket: ${s3Config.bucketName}, region: ${s3Config.region})`)
      await this.storage.initialize()

    } else {
      // Initialize local file storage
      this.isS3 = false
      this.storage = new FileStorage({
        assetsUrl: '/assets/',
      })

      console.log('Initializing local file storage...')
      await this.storage.initialize()
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
      // Get base URL from storage instance (which has the actual config)
      return this.storage.getAssetsBaseUrl() + '/' + this.storage.assetsPrefix.replace(/\/$/, '')
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