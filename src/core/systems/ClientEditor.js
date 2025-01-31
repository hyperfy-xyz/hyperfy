import * as THREE from '../extras/three'
import { System } from './System'
import { hashFile } from '../utils-client'
import { hasRole, uuid } from '../utils'
import { ControlPriorities } from '../extras/ControlPriorities'
import { CopyIcon, EyeIcon, HandIcon, Trash2Icon, UnlinkIcon } from 'lucide-react'
import { cloneDeep } from 'lodash-es'
import moment from 'moment'

contextBreakers = ['MouseLeft', 'Escape']

const MAX_UPLOAD_SIZE = parseInt(process.env.PUBLIC_MAX_UPLOAD_SIZE || '100')

/**
 * Editor System
 *
 * - runs on the client
 * - listens for files being drag and dropped onto the window and handles them
 * - handles editing apps
 *
 */
export class ClientEditor extends System {
  constructor(world) {
    super(world)
    this.target = null
    this.file = null
    this.clipboard = null
    this.contextTracker = {
      downAt: null,
      movement: new THREE.Vector3(),
    }
    window.addEventListener('paste', this.onPaste)
    window.addEventListener('keydown', this.onKeyDown)
  }

  async init({ viewport }) {
    viewport.addEventListener('dragover', this.onDragOver)
    viewport.addEventListener('dragenter', this.onDragEnter)
    viewport.addEventListener('dragleave', this.onDragLeave)
    viewport.addEventListener('drop', this.onDrop)
  }

  start() {
    this.control = this.world.controls.bind({
      priority: ControlPriorities.EDITOR,
      onPress: code => {
        if (code === 'MouseRight') {
          this.contextTracker.downAt = performance.now()
          this.contextTracker.movement.set(0, 0, 0)
        }
      },
      onRelease: code => {
        if (code === 'MouseRight') {
          const elapsed = performance.now() - this.contextTracker.downAt
          const distance = this.contextTracker.movement.length()
          if (elapsed < 300 && distance < 30) {
            this.tryContext()
          }
        }
        if (this.context && contextBreakers.includes(code)) {
          this.setContext(null)
        }
      },
    })
  }

  update(delta) {
    if (this.control.buttons.MouseRight) {
      this.contextTracker.movement.add(this.control.pointer.delta)
    }
  }

  tryContext() {
    const hits = this.world.stage.raycastPointer(this.world.controls.pointer.position)
    let entity
    for (const hit of hits) {
      entity = hit.getEntity?.()
      if (entity) break
    }
    if (!entity) return
    const context = {
      id: uuid(),
      x: this.world.controls.pointer.position.x,
      y: this.world.controls.pointer.position.y,
      actions: [],
    }
    if (entity.isPlayer) {
      context.actions.push({
        label: 'Inspect',
        icon: EyeIcon,
        visible: true,
        disabled: false,
        onClick: () => {
          this.setContext(null)
        },
      })
    }
    if (entity.isApp) {
      const roles = this.world.entities.player.data.user.roles
      const isAdmin = hasRole(roles, 'admin')
      const isBuilder = hasRole(roles, 'builder')
      const blueprint = this.world.blueprints.get(entity.data.blueprint)
      const isVrm = blueprint?.model?.toLowerCase().endsWith('.vrm')
      context.actions.push({
        label: 'Inspect',
        icon: EyeIcon,
        visible: isAdmin || isBuilder,
        disabled: false,
        onClick: () => {
          this.setContext(null)
          this.world.emit('inspect', entity)
        },
      })
      context.actions.push({
        label: 'Move',
        icon: HandIcon,
        visible: isAdmin || isBuilder,
        disabled: false,
        onClick: () => {
          this.setContext(null)
          entity.move()
        },
      })
      if (isVrm) {
        context.actions.push({
          label: 'Equip Avatar',
          icon: HandIcon,
          visible: true,
          disabled: false,
          onClick: async () => {
            this.setContext(null)
            try {
              const player = this.world.entities.player
              const prevUser = player.data.user
              const newUser = cloneDeep(player.data.user)
              const targetPosition = [...entity.data.position]
              const targetQuaternion = [...entity.data.quaternion]
              if (prevUser.avatar && prevUser.avatar.endsWith('.vrm')) {
                const oldBlueprint = {
                  id: uuid(),
                  version: 0,
                  model: prevUser.avatar,
                  script: null,
                  config: {},
                  preload: false
                }
                this.world.blueprints.add(oldBlueprint, true)
                const oldAvatarData = {
                  id: uuid(),
                  type: 'app',
                  blueprint: oldBlueprint.id,
                  position: targetPosition,
                  quaternion: targetQuaternion,
                  mover: null,
                  uploader: null,
                  state: {}
                }
                this.world.entities.add(oldAvatarData, true)
                this.world.chat.add({
                  id: uuid(),
                  from: null,
                  fromId: null,
                  body: '* Transferring consciousness to new avatar *',
                  createdAt: moment().toISOString(),
                })
              }
              newUser.avatar = blueprint.model
              player.modify({ 
                user: newUser
              })
              this.world.network.send('entityModified', {
                id: player.data.id,
                user: newUser
              })
              entity.destroy(true)
              this.world.chat.add({
                id: uuid(),
                from: null,
                fromId: null,
                body: '* Consciousness transfer complete *',
                createdAt: moment().toISOString(),
              })
            } catch (err) {
              console.error('Failed to transfer to new avatar:', err)
              this.world.chat.add({
                id: uuid(),
                from: null,
                fromId: null,
                body: '* Consciousness transfer failed *',
                createdAt: moment().toISOString(),
              })
            }
          },
        })
      }
      context.actions.push({
        label: 'Duplicate',
        icon: CopyIcon,
        visible: isAdmin || isBuilder,
        disabled: !!entity.data.uploader,
        onClick: () => {
          this.setContext(null)
          const data = {
            id: uuid(),
            type: 'app',
            blueprint: entity.data.blueprint,
            position: entity.data.position,
            quaternion: entity.data.quaternion,
            mover: this.world.network.id,
            uploader: null,
            state: {},
          }
          this.world.entities.add(data, true)
        },
      })
      context.actions.push({
        label: 'Unlink',
        icon: UnlinkIcon,
        visible: isAdmin || isBuilder,
        disabled: !!entity.data.uploader,
        onClick: () => {
          this.setContext(null)
          const blueprint = {
            id: uuid(),
            version: 0,
            model: entity.blueprint.model,
            script: entity.blueprint.script,
            config: cloneDeep(entity.blueprint.config),
            preload: entity.blueprint.preload,
          }
          this.world.blueprints.add(blueprint, true)
          entity.modify({ blueprint: blueprint.id })
          this.world.network.send('entityModified', { id: entity.data.id, blueprint: blueprint.id })
        },
      })
      context.actions.push({
        label: 'Destroy',
        icon: Trash2Icon,
        visible: isAdmin || isBuilder,
        disabled: false,
        onClick: () => {
          this.setContext(null)
          entity.destroy(true)
        },
      })
    }
    if (context.actions.length) {
      this.setContext(context)
    }
  }

  setContext(value) {
    this.context = value
    this.world.emit('context', value)
  }

  onDragOver = e => {
    e.preventDefault()
  }

  onDragEnter = e => {
    this.target = e.target
    this.dropping = true
    this.file = null
  }

  onDragLeave = e => {
    if (e.target === this.target) {
      this.dropping = false
    }
  }
  onPaste = async (e) => {
    // Don't handle object pasting if we're focused on an input element
    if (document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' || 
        document.activeElement.contentEditable === 'true') {
      return
    }

    // ensure we have admin/builder role
    const roles = this.world.entities.player.data.user.roles
    const canPaste = hasRole(roles, 'admin', 'builder')
    if (!canPaste) return

    try {
      // Get clipboard text content
      const text = e.clipboardData.getData('text')
      if (!text) return

      try {
        // Try to parse as JSON
        const clipboardData = JSON.parse(text)
        
        // Check if it's a Hyperfy entity
        if (clipboardData.type === 'hyperfy-entity' && clipboardData.data) {
          e.preventDefault()
          
          const hit = this.world.stage.raycastPointer(this.world.controls.pointer.position)[0]
          const position = hit ? hit.point.toArray() : [0, 0, 0]
          
          // Create new entity data with new ID and position
          const newData = cloneDeep(clipboardData.data)
          newData.id = uuid()
          newData.position = position
          newData.mover = this.world.network.id
          newData.uploader = this.world.network.id // Set uploader to indicate loading state

          try {
            // If we have blueprint data with URLs, create/update the blueprint
            if (newData.blueprint && typeof newData.blueprint === 'object') {
              const blueprintData = newData.blueprint
              const blueprint = {
                id: uuid(), // Generate new blueprint ID
                version: 0,
                model: blueprintData.model ? this.fullUrlToAsset(blueprintData.model) : null,
                script: blueprintData.script ? this.fullUrlToAsset(blueprintData.script) : null,
                config: blueprintData.config || {},
                preload: blueprintData.preload || false
              }

              // Register the blueprint first
              this.world.blueprints.add(blueprint, true)

              // Update the entity data to use the new blueprint ID
              newData.blueprint = blueprint.id

              // Create a temporary app that shows loading state
              const app = this.world.entities.add(newData, true)

              // Download and upload the model if it exists
              if (blueprint.model) {
                const modelResponse = await fetch(blueprintData.model)
                if (!modelResponse.ok) throw new Error('Failed to fetch model')
                const modelBlob = await modelResponse.blob()
                const modelFile = new File([modelBlob], blueprint.model.split('/').pop(), { type: 'model/gltf-binary' })
                
                // Cache the model locally for instant loading
                this.world.loader.insert('model', blueprint.model, modelFile)
                
                // Upload to the new world
                await this.world.network.upload(modelFile)
              }

              // Download and upload the script if it exists
              if (blueprint.script) {
                const scriptResponse = await fetch(blueprintData.script)
                if (!scriptResponse.ok) throw new Error('Failed to fetch script')
                const scriptBlob = await scriptResponse.blob()
                const scriptFile = new File([scriptBlob], blueprint.script.split('/').pop(), { type: 'application/javascript' })
                
                // Cache the script locally
                this.world.loader.insert('script', blueprint.script, scriptFile)
                
                // Upload to the new world
                await this.world.network.upload(scriptFile)
              }
              
              // Mark as uploaded so other clients can load it
              app.onUploaded()

              // Show success message
              this.world.chat.add({
                id: uuid(),
                from: null,
                fromId: null,
                body: 'Object pasted and assets uploaded successfully',
                createdAt: moment().toISOString(),
              })
            } else if (typeof newData.blueprint === 'string') {
              // We have a blueprint ID, verify it exists
              const existingBlueprint = this.world.blueprints.get(newData.blueprint)
              if (!existingBlueprint) {
                throw new Error('Blueprint not found')
              }

              // Ensure the blueprint has all required properties
              if (!existingBlueprint.model) {
                throw new Error('Invalid blueprint: missing model')
              }

              // Ensure all required blueprint properties are initialized
              existingBlueprint.script = existingBlueprint.script || null
              existingBlueprint.config = existingBlueprint.config || {}
              existingBlueprint.preload = existingBlueprint.preload || false
              existingBlueprint.version = existingBlueprint.version || 0

              // Register the updated blueprint
              this.world.blueprints.add(existingBlueprint, true)

              // Create entity with existing blueprint
              const app = this.world.entities.add(newData, true)
              app.onUploaded() // Mark as ready since we're using an existing blueprint
              
              // Show feedback in chat
              this.world.chat.add({
                id: uuid(),
                from: null,
                fromId: null,
                body: 'Object pasted from clipboard',
                createdAt: moment().toISOString(),
              })
            } else {
              throw new Error('Invalid blueprint data')
            }
          } catch (err) {
            console.error('Failed to paste object:', err)
            this.world.chat.add({
              id: uuid(),
              from: null,
              fromId: null,
              body: `Failed to paste object: ${err.message}`,
              createdAt: moment().toISOString(),
            })
            return
          }
        }
      } catch (err) {
        // Not valid JSON or not a Hyperfy entity, try URL handling
        try {
          // Check if it's a valid URL
          new URL(text)
          await this.handleUrl(text.trim())
        } catch (err) {
          // Not a valid URL, ignore
          console.log('Not a valid URL or Hyperfy entity data:', text)
        }
      }
    } catch (err) {
      console.error('Paste error:', err)
      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: 'Failed to paste object data',
        createdAt: moment().toISOString(),
      })
    }
  }
  async handleUrl(url) {
    try {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error('Failed to fetch file')
        }

        const blob = await response.blob()
        const urlParts = url.split('/')
        const filename = urlParts[urlParts.length - 1].split('?')[0] || 'downloaded-file'
        const file = new File([blob], filename, { type: blob.type })
        const ext = filename.split('.').pop().toLowerCase()
        if (ext === 'glb') {
            await this.addModel(file)
        } else if (ext === 'vrm') {
            await this.addAvatar(file)
        } else if (ext === 'js') {
            await this.addScript(file)
        } else {
            console.log('Unsupported file type:', ext)
        }

    } catch (err) {
        this.world.chat.add({
            id: uuid(),
            from: null,
            fromId: null,
            body: `Failed to load URL: ${err.message}`,
            createdAt: moment().toISOString(),
        })
        console.error('URL processing error:', err)
    }
  }
  onDrop = async e => {
    e.preventDefault()
    this.dropping = false
    // ensure we have admin/builder role
    const roles = this.world.entities.player.data.user.roles
    const canDrop = hasRole(roles, 'admin', 'builder')
    if (!canDrop) return
    // handle drop
    let file
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const item = e.dataTransfer.items[0]
      if (item.kind === 'file') {
        file = item.getAsFile()
      }
      if (item.kind === 'string') {
        // Handle both text/uri-list and text/plain
        const text = await new Promise(resolve => {
          item.getAsString(resolve)
        })
        // Try to handle as URL
        try {
          await this.handleUrl(text.trim())
        } catch (err) {
          console.log('Not a valid URL:', text)
        }
        return
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      file = e.dataTransfer.files[0]
    }
    if (!file) return
    const maxSize = MAX_UPLOAD_SIZE * 1024 * 1024
    if (file.size > maxSize) {
      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: `File size too large (>${MAX_UPLOAD_SIZE}mb)`,
        createdAt: moment().toISOString(),
      })
      console.error(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`)
      return
    }
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext === 'glb') {
      this.addModel(file)
    }
    if (ext === 'vrm') {
      this.addAvatar(file)
    }
    if (ext === 'js') {
        await this.addScript(file)
    }
  }

  async addModel(file) {
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as glb filename
    const filename = `${hash}.glb`
    // canonical url to this file
    const url = `asset://${filename}`
    // cache file locally so this client can insta-load it
    this.world.loader.insert('model', url, file)
    // make blueprint
    const blueprint = {
      id: uuid(),
      version: 0,
      model: url,
      script: null,
      config: {},
      preload: false,
    }
    // register blueprint
    this.world.blueprints.add(blueprint, true)
    // get spawn point
    const hit = this.world.stage.raycastPointer(this.control.pointer.position)[0]
    const position = hit ? hit.point.toArray() : [0, 0, 0]
    // spawn the app moving
    // - mover: follows this clients cursor until placed
    // - uploader: other clients see a loading indicator until its fully uploaded
    const data = {
      id: uuid(),
      type: 'app',
      blueprint: blueprint.id,
      position,
      quaternion: [0, 0, 0, 1],
      mover: this.world.network.id,
      uploader: this.world.network.id,
      state: {},
    }
    const app = this.world.entities.add(data, true)
    // upload the glb
    await this.world.network.upload(file)
    // mark as uploaded so other clients can load it in
    app.onUploaded()
  }

  async addAvatar(file) {
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as vrm filename
    const filename = `${hash}.vrm`
    // canonical url to this file
    const url = `asset://${filename}`
    // cache file locally so this client can insta-load it
    this.world.loader.insert('avatar', url, file)
    this.world.emit('avatar', {
      file,
      url,
      hash,
      onPlace: async () => {
        // close pane
        this.world.emit('avatar', null)
        // make blueprint
        const blueprint = {
          id: uuid(),
          version: 0,
          model: url,
          script: null,
          config: {},
          preload: false,
        }
        // register blueprint
        this.world.blueprints.add(blueprint, true)
        // get spawn point
        const hit = this.world.stage.raycastPointer(this.control.pointer.position)[0]
        const position = hit ? hit.point.toArray() : [0, 0, 0]
        // spawn the app moving
        // - mover: follows this clients cursor until placed
        // - uploader: other clients see a loading indicator until its fully uploaded
        const data = {
          id: uuid(),
          type: 'app',
          blueprint: blueprint.id,
          position,
          quaternion: [0, 0, 0, 1],
          mover: this.world.network.id,
          uploader: this.world.network.id,
          state: {},
        }
        const app = this.world.entities.add(data, true)
        // upload the glb
        await this.world.network.upload(file)
        // mark as uploaded so other clients can load it in
        app.onUploaded()
      },
      onEquip: async () => {
        // close pane
        this.world.emit('avatar', null)
        // prep new user data
        const player = this.world.entities.player
        const prevUser = player.data.user
        const newUser = cloneDeep(player.data.user)
        newUser.avatar = url
        // update locally
        player.modify({ user: newUser })
        // upload
        try {
          await this.world.network.upload(file)
        } catch (err) {
          console.error(err)
          // revert
          player.modify({ user: prevUser })
          return
        }
        // update for everyone
        this.world.network.send('entityModified', {
          id: player.data.id,
          user: newUser,
        })
      },
    })
  }
  
  async addScript(file) {
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as script filename
    const filename = `${hash}.js`
    // canonical url to this file
    const url = `asset://${filename}`
    // cache file locally so this client can insta-load it
    this.world.loader.insert('script', url, file)
    // make blueprint with crash block model and the script
    const blueprint = {
      id: uuid(),
      version: 0,
      model: 'asset://crash-block.glb',  // Using crash block as visual representation
      script: url,
      config: {},
      preload: false,
    }
    // register blueprint
    this.world.blueprints.add(blueprint, true)
    // get spawn point
    const hit = this.world.stage.raycastPointer(this.control.pointer.position)[0]
    const position = hit ? hit.point.toArray() : [0, 0, 0]
    // spawn the app moving
    const data = {
      id: uuid(),
      type: 'app',
      blueprint: blueprint.id,
      position,
      quaternion: [0, 0, 0, 1],
      mover: this.world.network.id,
      uploader: this.world.network.id,
      state: {},
    }
    const app = this.world.entities.add(data, true)
    // upload the script
    await this.world.network.upload(file)
    // mark as uploaded so other clients can load it in
    app.onUploaded()
  }
    onKeyDown = async (e) => {
    // Don't handle shortcuts if we're focused on an input element
    if (document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' || 
        document.activeElement.contentEditable === 'true') {
      return
    }

    // Check if we have admin/builder role
    const roles = this.world.entities.player.data.user.roles
    const canEdit = hasRole(roles, 'admin', 'builder')
    if (!canEdit) return

    // Get entity under mouse pointer
    const hits = this.world.stage.raycastPointer(this.world.controls.pointer.position)
    let entity
    for (const hit of hits) {
      entity = hit.getEntity?.()
      if (entity && entity.isApp) break
    }
    // Handle copy/cut/paste
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'c': // Copy
          if (entity && entity.isApp) {
            e.preventDefault()
            try {
              // Get the blueprint data
              const blueprint = this.world.blueprints.get(entity.data.blueprint)
              if (!blueprint) throw new Error('Blueprint not found')

              // Convert entity data to JSON string with full URLs
              const clipboardData = {
                type: 'hyperfy-entity',
                data: {
                  ...entity.data,
                  blueprint: {
                    id: blueprint.id,
                    model: blueprint.model ? this.assetToFullUrl(blueprint.model) : null,
                    script: blueprint.script ? this.assetToFullUrl(blueprint.script) : null,
                    config: blueprint.config || {},
                    preload: blueprint.preload || false
                  }
                }
              }
              const jsonStr = JSON.stringify(clipboardData, null, 2)
              
              // Copy to system clipboard
              await navigator.clipboard.writeText(jsonStr)
              
              // Show feedback in chat
              this.world.chat.add({
                id: uuid(),
                from: null,
                fromId: null,
                body: 'Object data copied to clipboard with full URLs',
                createdAt: moment().toISOString(),
              })
            } catch (err) {
              console.error('Failed to copy to clipboard:', err)
              this.world.chat.add({
                id: uuid(),
                from: null,
                fromId: null,
                body: 'Failed to copy object data',
                createdAt: moment().toISOString(),
              })
            }
          }
          break

        case 'x': // Cut
          if (entity && entity.isApp) {
            e.preventDefault()
            try {
              // Get the blueprint data
              const blueprint = this.world.blueprints.get(entity.data.blueprint)
              if (!blueprint) throw new Error('Blueprint not found')

              // Convert entity data to JSON string with full URLs
              const clipboardData = {
                type: 'hyperfy-entity',
                data: {
                  ...entity.data,
                  blueprint: {
                    id: blueprint.id,
                    model: blueprint.model ? this.assetToFullUrl(blueprint.model) : null,
                    script: blueprint.script ? this.assetToFullUrl(blueprint.script) : null,
                    config: blueprint.config || {},
                    preload: blueprint.preload || false
                  }
                }
              }
              const jsonStr = JSON.stringify(clipboardData, null, 2)
              
              // Copy to system clipboard
              await navigator.clipboard.writeText(jsonStr)
              
              // Remove the original entity
              entity.destroy(true)
              
              // Show feedback in chat
              this.world.chat.add({
                id: uuid(),
                from: null,
                fromId: null,
                body: 'Object data cut to clipboard with full URLs',
                createdAt: moment().toISOString(),
              })
            } catch (err) {
              console.error('Failed to cut to clipboard:', err)
              this.world.chat.add({
                id: uuid(),
                from: null,
                fromId: null,
                body: 'Failed to cut object data',
                createdAt: moment().toISOString(),
              })
            }
          }
          break

        case 'v': // Paste
          try {
            e.preventDefault()
            // Get clipboard text content
            const text = await navigator.clipboard.readText()
            if (!text) return

            // Try to parse as JSON
            const clipboardData = JSON.parse(text)
            
            // Check if it's a Hyperfy entity
            if (clipboardData.type === 'hyperfy-entity' && clipboardData.data) {
              const hit = this.world.stage.raycastPointer(this.world.controls.pointer.position)[0]
              const position = hit ? hit.point.toArray() : [0, 0, 0]
              
              // Create new entity data with new ID and position
              const newData = cloneDeep(clipboardData.data)
              newData.id = uuid()
              newData.position = position
              newData.mover = this.world.network.id
              newData.uploader = this.world.network.id // Set uploader to indicate loading state

              try {
                // If we have blueprint data with URLs, create/update the blueprint
                if (newData.blueprint && typeof newData.blueprint === 'object') {
                  const blueprintData = newData.blueprint
                  const blueprint = {
                    id: uuid(), // Generate new blueprint ID
                    version: 0,
                    model: blueprintData.model ? this.fullUrlToAsset(blueprintData.model) : null,
                    script: blueprintData.script ? this.fullUrlToAsset(blueprintData.script) : null,
                    config: blueprintData.config || {},
                    preload: blueprintData.preload || false
                  }

                  // Register the blueprint first
                  this.world.blueprints.add(blueprint, true)

                  // Update the entity data to use the new blueprint ID
                  newData.blueprint = blueprint.id

                  // Create a temporary app that shows loading state
                  const app = this.world.entities.add(newData, true)

                  // Download and upload the model if it exists
                  if (blueprint.model) {
                    const modelResponse = await fetch(blueprintData.model)
                    if (!modelResponse.ok) throw new Error('Failed to fetch model')
                    const modelBlob = await modelResponse.blob()
                    const modelFile = new File([modelBlob], blueprint.model.split('/').pop(), { type: 'model/gltf-binary' })
                    
                    // Cache the model locally for instant loading
                    this.world.loader.insert('model', blueprint.model, modelFile)
                    
                    // Upload to the new world
                    await this.world.network.upload(modelFile)
                  }

                  // Download and upload the script if it exists
                  if (blueprint.script) {
                    const scriptResponse = await fetch(blueprintData.script)
                    if (!scriptResponse.ok) throw new Error('Failed to fetch script')
                    const scriptBlob = await scriptResponse.blob()
                    const scriptFile = new File([scriptBlob], blueprint.script.split('/').pop(), { type: 'application/javascript' })
                    
                    // Cache the script locally
                    this.world.loader.insert('script', blueprint.script, scriptFile)
                    
                    // Upload to the new world
                    await this.world.network.upload(scriptFile)
                  }
                  
                  // Mark as uploaded so other clients can load it
                  app.onUploaded()

                  // Show success message
                  this.world.chat.add({
                    id: uuid(),
                    from: null,
                    fromId: null,
                    body: 'Object pasted and assets uploaded successfully',
                    createdAt: moment().toISOString(),
                  })
                } else if (typeof newData.blueprint === 'string') {
                  // We have a blueprint ID, verify it exists
                  const existingBlueprint = this.world.blueprints.get(newData.blueprint)
                  if (!existingBlueprint) {
                    throw new Error('Blueprint not found')
                  }

                  // Ensure the blueprint has all required properties
                  if (!existingBlueprint.model) {
                    throw new Error('Invalid blueprint: missing model')
                  }

                  // Ensure all required blueprint properties are initialized
                  existingBlueprint.script = existingBlueprint.script || null
                  existingBlueprint.config = existingBlueprint.config || {}
                  existingBlueprint.preload = existingBlueprint.preload || false
                  existingBlueprint.version = existingBlueprint.version || 0

                  // Register the updated blueprint
                  this.world.blueprints.add(existingBlueprint, true)

                  // Create entity with existing blueprint
                  const app = this.world.entities.add(newData, true)
                  app.onUploaded() // Mark as ready since we're using an existing blueprint
                  
                  // Show feedback in chat
                  this.world.chat.add({
                    id: uuid(),
                    from: null,
                    fromId: null,
                    body: 'Object pasted from clipboard',
                    createdAt: moment().toISOString(),
                  })
                } else {
                  throw new Error('Invalid blueprint data')
                }
              } catch (err) {
                console.error('Failed to paste object:', err)
                this.world.chat.add({
                  id: uuid(),
                  from: null,
                  fromId: null,
                  body: `Failed to paste object: ${err.message}`,
                  createdAt: moment().toISOString(),
                })
                return
              }
            }
          } catch (err) {
            console.error('Failed to paste from clipboard:', err)
            this.world.chat.add({
              id: uuid(),
              from: null,
              fromId: null,
              body: 'Failed to paste object data',
              createdAt: moment().toISOString(),
            })
          }
          break
      }
      return
    }

    
    // Handle 'g' key for moving objects
    if (e.key.toLowerCase() === 'g' && entity && entity.isApp) {
      e.preventDefault()
      try {
        entity.move()
        // Show feedback in chat
        this.world.chat.add({
          id: uuid(),
          from: null,
          fromId: null,
          body: '* Moving object - Click to place *',
          createdAt: moment().toISOString(),
        })
      } catch (err) {
        console.error('Failed to start moving object:', err)
        this.world.chat.add({
          id: uuid(),
          from: null,
          fromId: null,
          body: '* Failed to start moving object *',
          createdAt: moment().toISOString(),
        })
      }
      return
    }

    // Handle 'V' key for quick avatar swap
    if (e.key.toLowerCase() === 'v' && entity && entity.isApp) {
      const blueprint = this.world.blueprints.get(entity.data.blueprint)
      const isVrm = blueprint?.model?.toLowerCase().endsWith('.vrm')
      if (isVrm) {
        e.preventDefault()
        try {
          
          const player = this.world.entities.player
          const prevUser = player.data.user
          const newUser = cloneDeep(player.data.user)

        
          const targetPosition = [...entity.data.position]
          const targetQuaternion = [...entity.data.quaternion]

          
          if (prevUser.avatar && prevUser.avatar.endsWith('.vrm')) {
            
            const oldBlueprint = {
              id: uuid(),
              version: 0,
              model: prevUser.avatar,
              script: null,
              config: {},
              preload: false
            }
            this.world.blueprints.add(oldBlueprint, true)
            const oldAvatarData = {
              id: uuid(),
              type: 'app',
              blueprint: oldBlueprint.id,
              position: targetPosition,
              quaternion: targetQuaternion,
              mover: null,
              uploader: null,
              state: {}
            }
            this.world.entities.add(oldAvatarData, true)
          this.world.chat.add({
              id: uuid(),
              from: null,
              fromId: null,
              body: '* Transferring consciousness to new avatar *',
              createdAt: moment().toISOString(),
            })
          }
          newUser.avatar = blueprint.model
          player.modify({ 
            user: newUser
          })
          this.world.network.send('entityModified', {
            id: player.data.id,
            user: newUser
          })
          entity.destroy(true)
          this.world.chat.add({
            id: uuid(),
            from: null,
            fromId: null,
            body: '* Consciousness transfer complete *',
            createdAt: moment().toISOString(),
          })
        } catch (err) {
          console.error('Failed to transfer to new avatar:', err)
          this.world.chat.add({
            id: uuid(),
            from: null,
            fromId: null,
            body: '* Consciousness transfer failed *',
            createdAt: moment().toISOString(),
          })
        }
        return
      }
    }

    // Handle delete keys
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'x') {
      if (entity && entity.isApp) {
        e.preventDefault()
        try {
          entity.destroy(true)
          this.world.chat.add({
            id: uuid(),
            from: null,
            fromId: null,
            body: 'Object deleted',
            createdAt: moment().toISOString(),
          })
        } catch (err) {
          console.error('Failed to delete object:', err)
          this.world.chat.add({
            id: uuid(),
            from: null,
            fromId: null,
            body: 'Failed to delete object',
            createdAt: moment().toISOString(),
          })
        }
        return
      }
    }
  }

  destroy() {
    super.destroy()
    window.removeEventListener('paste', this.onPaste)
    window.removeEventListener('keydown', this.onKeyDown)
  }
}
