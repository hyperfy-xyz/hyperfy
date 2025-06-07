import path from 'path'
import fs from 'fs-extra'

import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'

export class AwsS3Storage {
  constructor(config) {
    this.bucketName = config.bucketName
    this.region = config.region || 'us-east-1'
    this.assetsPrefix = config.assetsPrefix || 'assets/'
    this.collectionsPrefix = config.collectionsPrefix || 'collections/'
    this.storagePrefix = config.storagePrefix || 'storage/'
    this.cloudfrontUrl = config.cloudfrontUrl // Optional CloudFront URL
    
    this.client = new S3Client({
      region: this.region,
      credentials: config.credentials || {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })
  }

  /**
   * Initialize S3 storage (validate connection and bucket access)
   */
  async initialize() {
    try {
      // Test S3 connection by listing objects (with limit to avoid large responses)
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.assetsPrefix,
        MaxKeys: 1,
      })
      
      await this.client.send(command)
      console.log(`S3 storage initialized successfully: bucket=${this.bucketName}, region=${this.region}`)
      
      // Copy built-in assets and collections if they don't exist
      await this.copyBuiltInContent()
      
    } catch (error) {
      console.error('Failed to initialize S3 storage:', error)
      throw new Error(`S3 initialization failed: ${error.message}`)
    }
  }

  /**
   * Copy built-in assets and collections to S3 if they don't exist
   */
  async copyBuiltInContent() {
    try {
      // Get root directory - assuming this is called from the server context
      const rootDir = path.join(__dirname, '../')
      const builtInAssetsDir = path.join(rootDir, 'src/world/assets')
      const builtInCollectionsDir = path.join(rootDir, 'src/world/collections')
      
      console.log('[S3] Checking for built-in content to copy...')
      
      // Copy built-in assets
      if (await fs.exists(builtInAssetsDir)) {
        console.log('[S3] Copying built-in assets...')
        await this.copyDirectoryToS3(builtInAssetsDir, this.assetsPrefix)
      }
      
      // Copy built-in collections
      if (await fs.exists(builtInCollectionsDir)) {
        console.log('[S3] Copying built-in collections...')
        await this.copyDirectoryToS3(builtInCollectionsDir, this.collectionsPrefix)
      }
      
      console.log('[S3] Built-in content copy completed')
      
    } catch (error) {
      console.error('[S3] Error copying built-in content:', error.message)
      // Don't throw - this is not critical for S3 initialization
    }
  }

  /**
   * Recursively copy a directory to S3
   */
  async copyDirectoryToS3(localDir, s3Prefix) {
    const files = await fs.readdir(localDir, { withFileTypes: true })
    
    for (const file of files) {
      const localPath = path.join(localDir, file.name)
      const s3Key = `${s3Prefix}${file.name}`
      
      if (file.isDirectory()) {
        // Recursively copy subdirectory
        const subS3Prefix = `${s3Prefix}${file.name}/`
        await this.copyDirectoryToS3(localPath, subS3Prefix)
      } else {
        // Check if file already exists in S3
        try {
          const headCommand = new HeadObjectCommand({
            Bucket: this.bucketName,
            Key: s3Key,
          })
          await this.client.send(headCommand)
          console.log(`[S3] File already exists, skipping: ${s3Key}`)
        } catch (error) {
          if (error.name === 'NotFound') {
            // File doesn't exist, copy it
            try {
              const fileBuffer = await fs.readFile(localPath)
              const contentType = this.getContentType(file.name)
              
              const putCommand = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key,
                Body: fileBuffer,
                ContentType: contentType,
              })
              
              await this.client.send(putCommand)
              console.log(`[S3] Copied file: ${s3Key}`)
            } catch (copyError) {
              console.error(`[S3] Error copying file ${localPath}:`, copyError.message)
            }
          } else {
            console.error(`[S3] Error checking file ${s3Key}:`, error.message)
          }
        }
      }
    }
  }

  /**
   * Get content type based on file extension
   */
  getContentType(filename) {
    const ext = filename.toLowerCase().split('.').pop()
    const mimeTypes = {
      'json': 'application/json',
      'js': 'application/javascript',
      'glb': 'application/octet-stream',
      'gltf': 'application/json',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'txt': 'text/plain',
      'html': 'text/html',
      'css': 'text/css',
    }
    return mimeTypes[ext] || 'application/octet-stream'
  }

  /**
   * Get the base S3 URL
   */
  getS3BaseUrl() {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com`
  }

  /**
   * Get the CloudFront URL if configured, otherwise S3 URL
   */
  getAssetsBaseUrl() {
    if (this.cloudfrontUrl) {
      return this.cloudfrontUrl.endsWith('/') ? this.cloudfrontUrl.slice(0, -1) : this.cloudfrontUrl
    }
    return this.getS3BaseUrl()
  }

  /**
   * Upload a file to S3
   * @param {string} filename - The filename to use in S3
   * @param {Buffer} buffer - The file data
   * @param {string} contentType - The MIME type of the file
   * @returns {Promise<string>} The S3 URL of the uploaded file
   */
  async uploadFile(filename, buffer, contentType) {
    const key = `${this.assetsPrefix}${filename}`
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable', // 1 year cache
    })

    await this.client.send(command)
    
    // Return the public URL
    return `${this.getS3BaseUrl()}/${key}`
  }

  /**
   * Check if a file exists in S3
   * @param {string} filename - The filename to check
   * @returns {Promise<boolean>} Whether the file exists
   */
  async fileExists(filename) {
    try {
      const key = `${this.assetsPrefix}${filename}`
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })
      
      await this.client.send(command)
      return true
    } catch (error) {
      if (error.name === 'NotFound') {
        return false
      }
      throw error
    }
  }

  /**
   * Get a signed URL for direct upload (optional feature for client-side uploads)
   * @param {string} filename - The filename
   * @param {string} contentType - The MIME type
   * @param {number} expiresIn - URL expiration time in seconds (default: 300)
   * @returns {Promise<string>} The signed URL
   */
  async getPresignedUploadUrl(filename, contentType, expiresIn = 300) {
    const key = `${this.assetsPrefix}${filename}`
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })

    return await getSignedUrl(this.client, command, { expiresIn })
  }

  /**
   * Get the public URL for a file
   * @param {string} filename - The filename
   * @returns {string} The public URL
   */
  getPublicUrl(filename) {
    const baseUrl = this.getAssetsBaseUrl()
    const assetsPrefix = this.assetsPrefix.replace(/\/$/, '') // Remove trailing slash
    return `${baseUrl}/${assetsPrefix}/${filename}`
  }

  /**
   * Get a presigned URL for accessing a file (alternative to public URLs)
   * @param {string} filename - The filename
   * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
   * @returns {Promise<string>} The presigned URL
   */
  async getPresignedUrl(filename, expiresIn = 3600) {
    const key = `${this.assetsPrefix}${filename}`
    
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    })

    return await getSignedUrl(this.client, command, { expiresIn })
  }

  /**
   * Get a signed URL for downloading a file (for private buckets)
   * @param {string} filename - The filename
   * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
   * @returns {Promise<string>} The signed URL
   */
  async getPresignedDownloadUrl(filename, expiresIn = 3600) {
    const key = `${this.assetsPrefix}${filename}`
    
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    })

    return await getSignedUrl(this.client, command, { expiresIn })
  }

  /**
   * Delete a file from S3
   * @param {string} filename - The filename to delete
   * @returns {Promise<boolean>} Whether the deletion was successful
   */
  async deleteFile(filename) {
    try {
      const key = `${this.assetsPrefix}${filename}`
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })
      
      await this.client.send(command)
      return true
    } catch (error) {
      console.error('Error deleting S3 file:', error)
      return false
    }
  }

  /**
   * List all files in S3 with the assets prefix
   * @returns {Promise<string[]>} Array of filenames
   */
  async listFiles() {
    try {
      const files = []
      let continuationToken = undefined
      
      do {
        const command = new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: this.assetsPrefix,
          ContinuationToken: continuationToken,
        })
        
        const response = await this.client.send(command)
        
        if (response.Contents) {
          for (const object of response.Contents) {
            const filename = object.Key.replace(this.assetsPrefix, '')
            // Only include hashed assets (64 character hash)
            if (filename.split('.')[0].length === 64) {
              files.push(filename)
            }
          }
        }
        
        continuationToken = response.NextContinuationToken
      } while (continuationToken)
      
      return files
    } catch (error) {
      console.error('Error listing S3 files:', error)
      return []
    }
  }

  /**
   * Get file stats from S3
   * @param {string} filename - The filename
   * @returns {Promise<object|null>} File stats or null if not found
   */
  async getFileStats(filename) {
    try {
      const key = `${this.assetsPrefix}${filename}`
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })
      
      const response = await this.client.send(command)
      return {
        size: response.ContentLength,
        created: response.LastModified,
        modified: response.LastModified,
        etag: response.ETag,
        contentType: response.ContentType,
      }
    } catch (error) {
      if (error.name === 'NotFound') {
        return null
      }
      throw error
    }
  }

  /**
   * Upload a collection file to S3
   * @param {string} filename - The collection filename
   * @param {Buffer} buffer - The file data
   * @returns {Promise<string>} The S3 key of the file
   */
  async uploadCollection(filename, buffer) {
    const key = `${this.collectionsPrefix}${filename}`
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: 'application/json',
    })

    await this.client.send(command)
    console.log(`Collection saved to S3: ${filename}`)
    return key
  }

  /**
   * Read a collection file from S3
   * @param {string} filename - The collection filename
   * @returns {Promise<Buffer|null>} The file data or null if not found
   */
  async readCollection(filename) {
    try {
      const key = `${this.collectionsPrefix}${filename}`
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })
      
      const response = await this.client.send(command)
      const chunks = []
      for await (const chunk of response.Body) {
        chunks.push(chunk)
      }
      return Buffer.concat(chunks)
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        return null
      }
      throw error
    }
  }

  /**
   * List collection files in S3
   * @returns {Promise<string[]>} Array of collection filenames
   */
  async listCollections() {
    try {
      const files = []
      let continuationToken = undefined
      
      do {
        const command = new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: this.collectionsPrefix,
          ContinuationToken: continuationToken,
        })
        
        const response = await this.client.send(command)
        
        if (response.Contents) {
          for (const object of response.Contents) {
            const filename = object.Key.replace(this.collectionsPrefix, '')
            if (filename) {
              files.push(filename)
            }
          }
        }
        
        continuationToken = response.NextContinuationToken
      } while (continuationToken)
      
      return files
    } catch (error) {
      console.error('Error listing S3 collections:', error)
      return []
    }
  }

  /**
   * Save storage.json data to S3
   * @param {object} data - The storage data
   * @returns {Promise<void>}
   */
  async saveStorageData(data) {
    const key = `${this.storagePrefix}storage.json`
    const buffer = Buffer.from(JSON.stringify(data, null, 2))
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: 'application/json',
    })

    await this.client.send(command)
  }

  /**
   * Load storage.json data from S3
   * @returns {Promise<object>} The storage data
   */
  async loadStorageData() {
    try {
      const key = `${this.storagePrefix}storage.json`
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })
      
      const response = await this.client.send(command)
      const chunks = []
      for await (const chunk of response.Body) {
        chunks.push(chunk)
      }
      const buffer = Buffer.concat(chunks)
      return JSON.parse(buffer.toString())
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        return {}
      }
      throw error
    }
  }
}