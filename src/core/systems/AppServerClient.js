import { storage } from '../storage'
import { hashFile } from '../utils-client'
import { System } from './System'

/**
 * App Server Client System
 *
 * - runs on the client
 * - handles connection and communication with local development app server
 * - manages app deployment, hot reloading, and linking functionality
 *
 */
export class AppServerClient extends System {
  static FILE_TYPES = {
    glb: { mimeType: 'model/gltf-binary', loaderType: 'model' },
    vrm: { mimeType: 'model/gltf-binary', loaderType: 'avatar' },
    jpg: { mimeType: 'image/jpeg', loaderType: 'image' },
    jpeg: { mimeType: 'image/jpeg', loaderType: 'image' },
    png: { mimeType: 'image/png', loaderType: 'image' },
    gif: { mimeType: 'image/gif', loaderType: 'image' }
  }
  constructor(world) {
    super(world)
    this.ws = null
    this.url = null
    this.connected = false
  }

  init() {
    this.world.on('ready', () => {
      if (!this.world.entities.player?.isAdmin()) return

      this.setServerUrl("http://localhost:8080")
      this.worldUrl = this.world.network.apiUrl.split("/api")[0]

      this.world.blueprints.on("modify", async (blueprint) => {

        // Only send blueprint modifications for linked apps
        const isLinked = await this.isLinked(blueprint.id)
        if (isLinked) {
          // TODO: debounce instead of setTimeout
          setTimeout(() => {
            this.send({
              type: 'blueprint_modified',
              blueprint: blueprint
            })
          }, 500)
        } else {
        }
      })
    })
  }

  setServerUrl(url) {
    console.log('[AppServerClient] Setting server URL:', url)
    const isWebSocket = url.startsWith('ws')
    console.log('[AppServerClient] isWebSocket:', isWebSocket)
    this.wsUrl = isWebSocket ? url : url.replace(/^https?:/, url.startsWith('https') ? 'wss:' : 'ws:')
    this.url = isWebSocket ? url.replace(/^wss?:/, url.startsWith('wss') ? 'https:' : 'http:') : url
    console.log('[AppServerClient] wsUrl set to:', this.wsUrl)
    console.log('[AppServerClient] url set to:', this.url)
    this.connect()
  }

  connect() {
    if (!this.wsUrl) return


    this.ws = new WebSocket(this.wsUrl)

    const events = { open: this.onOpen, message: this.onMessage, close: this.onClose, error: this.onError }
    Object.entries(events).forEach(([event, handler]) => this.ws.addEventListener(event, handler))
  }

  onOpen = () => {
    this.connected = true

    console.log('[AppServerClient] Connected to app server')
    

    // Authenticate with app server
    this.send({
      type: 'auth',
      userId: this.world.network?.id || 'anonymous',
      authToken: storage.get('authToken'),
      worldUrl: this.worldUrl
    })
  }

  onMessage = async (e) => {
    try {
      const message = JSON.parse(e.data)

      switch (message.type) {
        case 'auth_success':
          console.log('✅ Authenticated with app server')
          break

        case 'deploy_app':
          this.handleDeployApp(message.app)
          break

        case 'app_linked':
          this.world.emit('app_linked', { appName: message.appName, linkInfo: message.linkInfo })
          break

        case 'app_unlinked':
          this.world.emit('app_unlinked', { appName: message.appName })
          break

        case 'request_asset':
          await this.handleAssetRequest(message)
          break

        case 'request_blueprint':
          await this.handleBlueprintRequest(message)
          break


        default:
      }
    } catch (err) {
      console.error('❌ Error parsing app server message:', err)
    }
  }

  onClose = () => {
    this.connected = false
  }

  onError = (err) => {
    console.error('🔥 App server error:', err)
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('🔥 Sending message:', message)
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('⚠️  App server not connected, cannot send message')
    }
  }



  async processScriptContent(scriptContent) {
    if (!scriptContent) return scriptContent
    // Convert script content to file and process like ScriptEditor save function
    const blob = new Blob([scriptContent], { type: 'text/plain' })
    const file = new File([blob], 'script.js', { type: 'text/plain' })

    // Hash the file to get unique filename
    const hash = await hashFile(file)
    const filename = `${hash}.js`

    // Create canonical URL
    const url = `asset://${filename}`

    // Cache file locally so this client can load it
    this.world.loader.insert('script', url, file)

    // Upload script to server
    if (this.world.network) {
      await this.world.network.upload(file)
    }

    return url
  }

  async processModelContent(assetUrl, assetType = 'model') {
    // If already a valid asset URL and file is cached, ensure it's uploaded
    if (assetUrl && assetUrl.startsWith('asset://')) {

      // Check if we already have this file cached locally
      const cachedFile = this.world.loader.getFile(assetUrl)
      if (cachedFile) {
        // Upload to server if network available
        if (this.world.network) {
          await this.world.network.upload(cachedFile)
        }
        return assetUrl
      } else {
        // File not cached - request it from dev server
        try {
          const assetContent = await this.requestModelContentFromServer(assetUrl)
          if (assetContent) {
            // Convert base64 content to file
            const buffer = Uint8Array.from(atob(assetContent), c => c.charCodeAt(0))
            const blob = new Blob([buffer])
            const filename = assetUrl.replace('asset://', '')

            // Determine file type based on extension and asset type
            const ext = filename.split('.').pop()?.toLowerCase()
            const fileType = AppServerClient.FILE_TYPES[ext] || { mimeType: 'application/octet-stream', loaderType: assetType }
            const { mimeType, loaderType } = fileType

            const file = new File([blob], filename, { type: mimeType })

            // Cache file locally
            this.world.loader.insert(loaderType, assetUrl, file)

            // Upload to server
            if (this.world.network) {
              await this.world.network.upload(file)
            }

            return assetUrl
          }
        } catch (error) {
          console.warn(`⚠️  Failed to get ${assetType} content from server:`, error.message)
          return assetUrl
        }
      }
    }

    return assetUrl
  }

  async requestModelContentFromServer(modelUrl) {
    return new Promise((resolve, reject) => {
      const requestId = `model_request_${Date.now()}_${Math.random()}`
      const timeout = setTimeout(() => {
        reject(new Error('Model request timeout'))
      }, 10000) // 10 second timeout

      // Set up response handler
      const handleResponse = (message) => {
        if (message.type === 'model_content_response' && message.requestId === requestId) {
          clearTimeout(timeout)
          this.ws.removeEventListener('message', handleResponse)

          if (message.success) {
            resolve(message.content)
          } else {
            reject(new Error(message.error || 'Failed to get model content'))
          }
        }
      }

      this.ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data)
          handleResponse(data)
        } catch (err) {
          // Ignore invalid JSON
        }
      })

      // Send request to dev server
      this.send({
        type: 'request_model_content',
        requestId: requestId,
        modelUrl: modelUrl
      })
    })
  }

  async processPropsFiles(props) {
    if (!props || typeof props !== 'object') {
      return props
    }

    const processedProps = {}

    for (const [key, value] of Object.entries(props)) {
      if (value && typeof value === 'object') {
        // Check if this is a file object with url property
        if (value.url && typeof value.url === 'string' && value.url.startsWith('asset://')) {
          // This is a file prop that needs processing
          const fileType = value.type || 'unknown'

          try {
            // Process the file URL (upload to server if needed)
            let processedUrl = value.url
            const knownTypes = ['model', 'avatar', 'emote', 'texture', 'image', 'hdr', 'audio']
            if (knownTypes.includes(fileType)) {
              processedUrl = await this.processModelContent(value.url, fileType)
            } else {
              const cachedFile = this.world.loader.getFile(value.url)
              if (cachedFile && this.world.network) {
                await this.world.network.upload(cachedFile)
              }
            }

            processedProps[key] = {
              ...value,
              url: processedUrl
            }
          } catch (error) {
            console.warn(`   ⚠️  Failed to process ${fileType} file in prop '${key}':`, error.message)
            processedProps[key] = value // Use original value as fallback
          }
        } else if (Array.isArray(value)) {
          processedProps[key] = await Promise.all(value.map(item => this.processPropsFiles(item)))
        } else if (typeof value === 'object') {
          processedProps[key] = await this.processPropsFiles(value)
        } else {
          processedProps[key] = value
        }
      } else {
        processedProps[key] = value
      }
    }

    return processedProps
  }

  async handleDeployApp(appData) {
    const isUpdate = appData.isUpdate || this.world.blueprints.get(appData.id)

    if (isUpdate) {
      await this.handleAppUpdate(appData)
    } else {
      await this.handleNewAppDeployment(appData)
    }
  }

  async handleNewAppDeployment(appData) {

    // Process all assets concurrently
    const { scriptUrl, modelUrl, processedProps } = await this.processAppAssets(appData)

    // Create blueprint and entity data
    const blueprint = this.createBlueprint(appData, scriptUrl, modelUrl, processedProps)
    const entityData = this.createEntityData(appData)

    // Add blueprint and entity locally
    this.world.blueprints.add(blueprint, true)
    this.world.entities.add(entityData, true)

    this.world.network.send('blueprintAdded', blueprint)
    this.world.network.send('entityAdded', entityData)

    // Auto-link this freshly deployed app to the dev server
    try {
      const appEntity = this.world.entities.get(entityData.id)
      if (appEntity) {
        await this.linkToDevServer(appEntity)
      }
    } catch (err) {
      console.warn('⚠️  Auto-linking failed:', err?.message || err)
    }
    
  }

  async handleAppUpdate(appData) {

    // Get the existing blueprint
    const blueprint = this.world.blueprints.get(appData.id)
    if (!blueprint) {
      console.warn(`⚠️  Blueprint ${appData.id} not found`)
      return
    }

    // Process all assets concurrently
    const { scriptUrl, modelUrl, processedProps } = await this.processAppAssets(appData, blueprint)

    // Create updated blueprint
    const updatedBlueprint = this.createBlueprint(appData, scriptUrl, modelUrl, processedProps, blueprint)


    // Update locally first
    this.world.blueprints.modify(updatedBlueprint)

    // Send to main server via network system
    if (this.world.network) {
      this.world.network.send('blueprintModified', updatedBlueprint)
    }

  }

  async handleAssetRequest(message) {
    const { requestId, assetUrl, assetType } = message

    try {
      let content = null

      const file = this.world.loader.getFile(assetUrl)

      if (!file) {
        throw new Error(`Asset not found: ${assetUrl}`)
      }

      if (assetType === 'script') {
        content = await file.text()
      } else {
        content = await this.fileToBase64(file)
      }


      // Send response back to dev server
      this.send({
        type: 'asset_response',
        requestId: requestId,
        success: !!content,
        content: content,
        error: content ? null : `Asset not found: ${assetUrl}`
      })

    } catch (error) {
      console.error(`❌ Error handling asset request:`, error)
      this.send({
        type: 'asset_response',
        requestId: requestId,
        success: false,
        content: null,
        error: error.message
      })
    }
  }

  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64 = reader.result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async handleBlueprintRequest(message) {
    const { requestId, blueprintId, appName } = message
    
    try {
      // Find the blueprint by ID
      const blueprint = this.world.blueprints.get(blueprintId)
      
      if (!blueprint) {
        throw new Error(`Blueprint not found: ${blueprintId}`)
      }
      
      console.log(`📤 Sending blueprint data for ${appName} (${blueprintId})`)
      
      // Send response back to dev server
      this.send({
        type: 'blueprint_response',
        requestId: requestId,
        success: true,
        blueprint: blueprint,
        error: null
      })
      
    } catch (error) {
      console.error(`❌ Error handling blueprint request for ${appName}:`, error)
      this.send({
        type: 'blueprint_response',
        requestId: requestId,
        success: false,
        blueprint: null,
        error: error.message
      })
    }
  }

  destroy() {
    if (this.ws) {
      const events = { open: this.onOpen, message: this.onMessage, close: this.onClose, error: this.onError }
      Object.entries(events).forEach(([event, handler]) => this.ws.removeEventListener(event, handler))

      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close()
      }
      this.ws = null
    }

    this.connected = false
  }

  /**
   * Link an app to the development server
   * @param {Object} app - The app entity
   * @param {Object} blueprint - The app blueprint
   * @returns {Promise<boolean>} - Success status
   */
  async linkToDevServer(app) {
    try {
      const { blueprint } = app
      let devServerApp = await fetch(`${this.url}/api/apps/${blueprint.name}`).then(res => res.json()).then(data => data.app)

      if (!devServerApp) {
        await this.uploadToDevServer(app)
        devServerApp = await fetch(`${this.url}/api/apps/${blueprint.name}`).then(res => res.json()).then(data => data.app)
      }

      await this.linkApps(devServerApp, app)


      return true

    } catch (error) {
      console.error(`❌ Failed to link ${blueprint.name}:`, error.message)
      throw error
    }
  }

  /**
   * Download and create an app on the development server
   * @param {Object} app - The app entity
   * @param {Object} blueprint - The app blueprint
   */
  async uploadToDevServer(app) {
    const { blueprint } = app
    // Create app data in development server format
    const { id, version, ...appData } = blueprint

    // Include script content if available
    if (blueprint.script) {
      appData.script = app.script.code
    }

    // Create the app on development server
    await this.apiRequest(`/api/apps/${blueprint.name}`, {
      method: 'POST',
      body: JSON.stringify(appData)
    })
  }

  /**
   * TODO: what if their contents are different?
   * Link an existing app on the development server
   * @param {Object} devServerApp - The existing app on the dev server
   * @param {Object} app - The app entity
   * @param {Object} blueprint - The app blueprint
   */
  async linkApps(devServerApp, app) {
    const { blueprint } = app
    // Create link info
    const linkInfo = {
      worldUrl: this.worldUrl,
      blueprint,
      appName: blueprint.name,
      assetsUrl: this.world.assetsUrl,
      linkedAt: new Date().toISOString()
    }

    // Send link command to development server  
    await this.apiRequest(`/api/apps/${devServerApp.name}/link`, {
      method: 'POST',
      body: JSON.stringify({ linkInfo })
    })
  }

  /**
   * Unlink an app from the development server
   * @param {string} appName - The name of the app to unlink
   * @returns {Promise<boolean>} - Success status
   */
  async unlinkApps(appName) {
    try {

      await this.apiRequest(`/api/apps/${appName}/unlink`, {
        method: 'POST'
      })

      return true

    } catch (error) {
      console.error(`❌ Failed to unlink ${appName}:`, error.message)
      throw error
    }
  }

  /**
   * Check if a blueprint is linked to the development server
   * @param {string} blueprintId - The blueprint ID to check
   * @returns {Promise<boolean>} - Whether the blueprint is linked
   */
  async isLinked(blueprintId) {
    try {
      if (!this.connected || !this.url) {
        return false
      }

      const worldUrl = this.worldUrl
      const response = await fetch(`${this.url}/api/apps/is-linked?blueprintId=${encodeURIComponent(blueprintId)}&worldUrl=${encodeURIComponent(worldUrl)}`)

      if (!response.ok) {
        console.warn('⚠️  Failed to check blueprint link status')
        return false
      }

      const data = await response.json()
      return data.success && data.isLinked
    } catch (error) {
      console.warn('⚠️  Error checking blueprint link:', error.message)
      return false
    }
  }

  async processAppAssets(appData, blueprint = {}) {
    const [scriptUrl, modelUrl, processedProps] = await Promise.all([
      this.processScriptContent(appData.script),
      this.processModelContent(appData.model),
      this.processPropsFiles(appData.props || blueprint.props || {})
    ])
    return { scriptUrl, modelUrl, processedProps }
  }

  // Helper for API requests
  async apiRequest(endpoint, options = {}) {
    const response = await fetch(`${this.url}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    })
    if (!response.ok) throw new Error(`API request failed: ${endpoint}`)
    return response
  }

  // Helper for blueprint creation
  createBlueprint(appData, scriptUrl, modelUrl, processedProps, existingBlueprint = null) {
    return {
      id: appData.id,
      version: existingBlueprint ? existingBlueprint.version + 1 : 1,
      name: appData.name || existingBlueprint?.name,
      script: scriptUrl,
      model: modelUrl,
      props: processedProps
    }
  }

  createEntityData(appData) {
    return {
      id: appData.id,
      type: 'app',
      blueprint: appData.id,
      position: appData.position || [0, 0, 0],
      quaternion: [0, 0, 0, 1],
      scale: [1, 1, 1],
      state: {}
    }
  }
} 
