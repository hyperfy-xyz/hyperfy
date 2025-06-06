import path from 'path'
import fs from 'fs-extra'

export class FileStorage {
  constructor(config = {}) {
    this.rootDir = path.join(__dirname, '../')
    this.worldDir = path.join(this.rootDir, process.env.WORLD || 'world')
    this.assetsDir = path.join(this.worldDir, '/assets')
    this.collectionsDir = path.join(this.worldDir, '/collections')
    this.assetsUrl = config.assetsUrl || '/assets'
  }

  /**
   * Initialize directories and copy built-in assets
   */
  async initialize() {
    await fs.ensureDir(this.worldDir)
    await fs.ensureDir(this.assetsDir)
    await fs.ensureDir(this.collectionsDir)

    // Copy over built-in assets and collections
    const builtInAssetsDir = path.join(this.rootDir, 'src/world/assets')
    const builtInCollectionsDir = path.join(this.rootDir, 'src/world/collections')
    
    if (await fs.exists(builtInAssetsDir)) {
      await fs.copy(builtInAssetsDir, this.assetsDir)
      console.log('Built-in assets copied to local storage')
    }
    
    if (await fs.exists(builtInCollectionsDir)) {
      await fs.copy(builtInCollectionsDir, this.collectionsDir)
      console.log('Built-in collections copied to local storage')
    }
  }

  /**
   * Get the paths for local storage
   */
  getPaths() {
    return {
      worldDir: this.worldDir,
      assetsDir: this.assetsDir,
      collectionsDir: this.collectionsDir,
    }
  }

  /**
   * Upload a file to local filesystem
   * @param {string} filename - The filename to use
   * @param {Buffer} buffer - The file data
   * @param {string} contentType - The MIME type of the file (not used for local storage)
   * @returns {Promise<string>} The local URL of the file
   */
  async uploadFile(filename, buffer, contentType) {
    const filePath = path.join(this.assetsDir, filename)
    
    // Check if file already exists
    const exists = await fs.exists(filePath)
    if (!exists) {
      await fs.writeFile(filePath, buffer)
      console.log(`File saved locally: ${filename}`)
    } else {
      console.log(`File already exists locally: ${filename}`)
    }
    
    return `${this.assetsUrl}/${filename}`
  }

  /**
   * Check if a file exists locally
   * @param {string} filename - The filename to check
   * @returns {Promise<boolean>} Whether the file exists
   */
  async fileExists(filename) {
    const filePath = path.join(this.assetsDir, filename)
    return await fs.exists(filePath)
  }

  /**
   * Get the public URL for a file
   * @param {string} filename - The filename
   * @returns {string} The public URL
   */
  getPublicUrl(filename) {
    return `${this.assetsUrl}/${filename}`
  }

  /**
   * Delete a file from local storage
   * @param {string} filename - The filename to delete
   * @returns {Promise<boolean>} Whether the deletion was successful
   */
  async deleteFile(filename) {
    try {
      const filePath = path.join(this.assetsDir, filename)
      await fs.remove(filePath)
      return true
    } catch (error) {
      console.error('Error deleting local file:', error)
      return false
    }
  }

  /**
   * List all files in the assets directory
   * @returns {Promise<string[]>} Array of filenames
   */
  async listFiles() {
    try {
      const files = await fs.readdir(this.assetsDir)
      return files.filter(file => {
        const filePath = path.join(this.assetsDir, file)
        const stat = fs.statSync(filePath)
        return stat.isFile() && file.split('.')[0].length === 64 // Only hashed assets
      })
    } catch (error) {
      console.error('Error listing local files:', error)
      return []
    }
  }

  /**
   * Get file stats
   * @param {string} filename - The filename
   * @returns {Promise<object|null>} File stats or null if not found
   */
  async getFileStats(filename) {
    try {
      const filePath = path.join(this.assetsDir, filename)
      const stats = await fs.stat(filePath)
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
      }
    } catch (error) {
      return null
    }
  }

  /**
   * Upload a collection file
   * @param {string} filename - The collection filename
   * @param {Buffer} buffer - The file data
   * @returns {Promise<string>} The local path of the file
   */
  async uploadCollection(filename, buffer) {
    const filePath = path.join(this.collectionsDir, filename)
    await fs.writeFile(filePath, buffer)
    console.log(`Collection saved locally: ${filename}`)
    return filePath
  }

  /**
   * Read a collection file
   * @param {string} filename - The collection filename
   * @returns {Promise<Buffer|null>} The file data or null if not found
   */
  async readCollection(filename) {
    try {
      const filePath = path.join(this.collectionsDir, filename)
      return await fs.readFile(filePath)
    } catch (error) {
      return null
    }
  }

  /**
   * List collection files
   * @returns {Promise<string[]>} Array of collection filenames
   */
  async listCollections() {
    try {
      const files = []
      const folders = await fs.readdir(this.collectionsDir)
      
      for (const folder of folders) {
        const folderPath = path.join(this.collectionsDir, folder)
        const stat = await fs.stat(folderPath)
        
        if (stat.isDirectory()) {
          // List files in the collection folder
          const folderFiles = await fs.readdir(folderPath)
          for (const file of folderFiles) {
            const filePath = path.join(folderPath, file)
            const fileStat = await fs.stat(filePath)
            if (fileStat.isFile()) {
              // Return in S3-style format: "foldername/filename"
              files.push(`${folder}/${file}`)
            }
          }
        }
      }
      
      return files
    } catch (error) {
      console.error('Error listing collections:', error)
      return []
    }
  }

  /**
   * Save storage.json data
   * @param {object} data - The storage data
   * @returns {Promise<void>}
   */
  async saveStorageData(data) {
    const filePath = path.join(this.worldDir, 'storage.json')
    await fs.writeJson(filePath, data)
  }

  /**
   * Load storage.json data
   * @returns {Promise<object>} The storage data
   */
  async loadStorageData() {
    try {
      const filePath = path.join(this.worldDir, 'storage.json')
      return await fs.readJson(filePath)
    } catch (error) {
      return {}
    }
  }
} 