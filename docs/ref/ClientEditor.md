# ClientEditor

The ClientEditor system in Hyperfy provides in-world editing capabilities, handling file drag-and-drop, context menus, and entity manipulation. It runs on the client and provides tools for administrators and builders.

### Properties

### `editor.context`: Object | null

Current context menu state:
```typescript
{
  id: String,              // Unique context ID
  x: Number,              // Screen X position
  y: Number,              // Screen Y position
  actions: Array<Action>   // Available actions
}
```

### Methods

### `editor.setContext(value: Object | null): void`

Sets the current context menu state.

Parameters:
- `value`: Context menu configuration or null to hide

### Context Menu Actions

Context menus provide different actions based on the entity type and user roles:

### Player Actions
- **Inspect**: View player details

### App Actions (for admins/builders)
```typescript
interface Action {
  label: String,          // Action label
  icon: Component,        // Action icon
  visible: Boolean,       // Whether action is visible
  disabled: Boolean,      // Whether action is disabled
  onClick: Function      // Action handler
}
```

Available actions:
- **Inspect**: View app details
- **Move**: Enter move mode
- **Duplicate**: Create a copy
- **Unlink**: Create independent blueprint
- **Destroy**: Remove app

### File Handling

Supports drag-and-drop of:
- GLB models (creates app)
- VRM avatars (creates app or equips)

File size limit: Configurable through `PUBLIC_MAX_UPLOAD_SIZE` (default 100MB)

### Notes

- Requires admin or builder role for editing
- Automatically handles file uploads
- Creates blueprints for dropped files
- Supports context menus for entities
- Manages entity movement and placement
- Handles avatar equipping and placement

### Usage

The ClientEditor system is used to:

1. Handle file uploads
2. Provide context menus
3. Manage entity editing
4. Handle avatar equipping
5. Control entity placement

### Example

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Listen for editor events
      world.on('context', this.handleContext)
      world.on('inspect', this.handleInspect)
      world.on('avatar', this.handleAvatar)
      
      // Create editor UI
      this.createEditorUI()
    },
    
    createEditorUI() {
      // Create context menu
      this.contextMenu = app.create('UI')
      this.contextMenu.visible = false
      
      // Create inspector panel
      this.inspector = app.create('UI')
      this.inspector.visible = false
      
      // Create avatar preview
      this.avatarPreview = app.create('UI')
      this.avatarPreview.visible = false
      
      app.add(this.contextMenu)
      app.add(this.inspector)
      app.add(this.avatarPreview)
    },
    
    handleContext(context) {
      if (!context) {
        // Hide context menu
        this.contextMenu.visible = false
        return
      }
      
      // Position context menu
      this.contextMenu.position.set(context.x, context.y, 0)
      
      // Create action buttons
      this.clearContextActions()
      context.actions.forEach(action => {
        if (!action.visible) return
        
        const button = app.create('Action')
        button.label = action.label
        button.icon = action.icon
        button.disabled = action.disabled
        button.onTrigger = () => {
          action.onClick()
        }
        
        this.contextMenu.add(button)
      })
      
      // Show context menu
      this.contextMenu.visible = true
    },
    
    handleInspect(entity) {
      // Show inspector for entity
      this.inspector.visible = true
      
      // Create inspector content
      this.createInspectorContent(entity)
    },
    
    createInspectorContent(entity) {
      // Clear existing content
      this.clearInspector()
      
      if (entity.isApp) {
        // Show app properties
        this.addAppInspector(entity)
      } else if (entity.isPlayer) {
        // Show player properties
        this.addPlayerInspector(entity)
      }
    },
    
    addAppInspector(app) {
      // Add blueprint info
      const blueprint = world.blueprints.get(app.blueprint)
      if (blueprint) {
        const info = app.create('UIText')
        info.text = `Blueprint: ${blueprint.id}`
        this.inspector.add(info)
      }
      
      // Add transform controls
      const transform = app.create('UI')
      
      const position = app.create('UIText')
      position.text = `Position: ${app.position.toArray()}`
      transform.add(position)
      
      const rotation = app.create('UIText')
      rotation.text = `Rotation: ${app.quaternion.toArray()}`
      transform.add(rotation)
      
      this.inspector.add(transform)
    },
    
    addPlayerInspector(player) {
      // Add player info
      const info = app.create('UIText')
      info.text = `Player: ${player.name}`
      this.inspector.add(info)
      
      // Add role badges
      const roles = app.create('UI')
      player.data.user.roles.forEach(role => {
        const badge = app.create('UIText')
        badge.text = role
        roles.add(badge)
      })
      this.inspector.add(roles)
    },
    
    handleAvatar(data) {
      if (!data) {
        // Hide avatar preview
        this.avatarPreview.visible = false
        return
      }
      
      // Show avatar preview
      this.avatarPreview.visible = true
      
      // Create preview content
      const preview = app.create('Mesh')
      preview.url = data.url
      this.avatarPreview.add(preview)
      
      // Add action buttons
      const place = app.create('Action')
      place.label = 'Place in World'
      place.onTrigger = data.onPlace
      this.avatarPreview.add(place)
      
      const equip = app.create('Action')
      equip.label = 'Equip Avatar'
      equip.onTrigger = data.onEquip
      this.avatarPreview.add(equip)
    },
    
    clearContextActions() {
      while(this.contextMenu.children.length) {
        this.contextMenu.children[0].destroy()
      }
    },
    
    clearInspector() {
      while(this.inspector.children.length) {
        this.inspector.children[0].destroy()
      }
    },
    
    destroy() {
      // Clean up event listeners
      world.off('context', this.handleContext)
      world.off('inspect', this.handleInspect)
      world.off('avatar', this.handleAvatar)
      
      // Clean up UI
      if (this.contextMenu) {
        this.contextMenu.destroy()
      }
      if (this.inspector) {
        this.inspector.destroy()
      }
      if (this.avatarPreview) {
        this.avatarPreview.destroy()
      }
    }
  }
}
```

This example demonstrates:
- Handling context menus
- Creating inspector panels
- Managing avatar previews
- Processing file drops
- Creating editor UI
- Handling entity inspection

Remember that editing capabilities are restricted to users with admin or builder roles.
