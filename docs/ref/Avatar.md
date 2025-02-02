# Avatar

The Avatar component in Hyperfy manages character avatars, providing functionality for displaying and animating 3D character models. It supports custom avatar factories and emote animations.

### Inheritance

Avatar inherits all properties and methods from [Node](/docs/ref/Node.md).

### Properties

### `avatar.factory`: Function

A factory function that creates the avatar instance. The factory receives:
- `matrixWorld`: The world transform matrix
- `hooks`: Custom hooks for avatar behavior
- `avatar`: Reference to the Avatar component

### `avatar.hooks`: Object

Custom hooks that can be used to modify avatar behavior.

### `avatar.height`: Number | null

The height of the avatar in world units. Returns `null` if no avatar instance is active.

### Methods

### `avatar.setEmote(url: String): Promise<void>`

Sets the current emote animation for the avatar.

Parameters:
- `url`: The URL of the emote animation to play

### Notes

- Avatars are automatically updated when their transform changes
- The avatar instance is managed as a "hot" entity for efficient updates
- Avatar instances are created through a factory system for flexibility
- Emotes can be used to play character animations
- The component supports VRM format for avatars

### Usage

Avatars are used to:

1. Display player characters
2. Create NPCs (Non-Player Characters)
3. Show animated characters in scenes
4. Implement character customization

### Example

```javascript
export default function(world, app, fetch) {
  return {
    async start() {
      // Create an avatar with a custom factory
      const avatar = app.create('Avatar')
      
      // Define the avatar factory
      avatar.factory = (matrixWorld, hooks, avatarComponent) => {
        // Create a VRM avatar instance
        const vrmFactory = createVRMFactory()
        const instance = vrmFactory.create({
          url: 'asset://avatar.vrm',
          matrixWorld,
          hooks
        })
        
        return {
          // Required interface
          move(matrix) {
            instance.setMatrix(matrix)
          },
          
          destroy() {
            instance.dispose()
          },
          
          setEmote(url) {
            return instance.playAnimation(url)
          },
          
          get height() {
            return instance.getHeight()
          }
        }
      }
      
      // Add custom hooks
      avatar.hooks = {
        onLoad() {
          console.log('Avatar loaded')
        },
        
        onAnimationStart(name) {
          console.log('Playing animation:', name)
        },
        
        onAnimationEnd(name) {
          console.log('Animation complete:', name)
        }
      }
      
      // Position the avatar
      avatar.position.set(0, 0, -5)
      
      // Add to scene
      app.add(avatar)
      
      // Store reference for updates
      this.avatar = avatar
    },
    
    // Example of playing emotes
    playIdleEmote() {
      this.avatar.setEmote('asset://emote-idle.glb')
    },
    
    playJumpEmote() {
      this.avatar.setEmote('asset://emote-jump.glb')
    }
  }
}

// Example with character customization
export default function(world, app, fetch) {
  return {
    start() {
      const avatar = app.create('Avatar')
      
      // Create a customizable avatar factory
      avatar.factory = (matrixWorld, hooks) => {
        const instance = createCustomizableAvatar({
          baseModel: 'asset://base-avatar.vrm',
          matrixWorld,
          hooks
        })
        
        // Add custom methods for customization
        instance.customize = (options) => {
          if (options.hairStyle) {
            instance.setHairModel(options.hairStyle)
          }
          if (options.outfit) {
            instance.setOutfitModel(options.outfit)
          }
          if (options.skinTone) {
            instance.setSkinTone(options.skinTone)
          }
        }
        
        return {
          move: instance.move.bind(instance),
          destroy: instance.destroy.bind(instance),
          setEmote: instance.setEmote.bind(instance),
          height: instance.height,
          customize: instance.customize.bind(instance)
        }
      }
      
      // Add customization UI
      const customizeButton = app.create('Action')
      customizeButton.label = 'Customize'
      customizeButton.onTrigger = () => {
        this.showCustomizationUI()
      }
      
      app.add(avatar)
      app.add(customizeButton)
      
      this.avatar = avatar
    },
    
    showCustomizationUI() {
      // Example of customizing the avatar
      this.avatar.instance.customize({
        hairStyle: 'asset://hairstyle-1.glb',
        outfit: 'asset://outfit-casual.glb',
        skinTone: '#FFD1BA'
      })
    }
  }
}
```

This example demonstrates:
- Creating avatars with custom factories
- Using hooks for avatar lifecycle events
- Playing emote animations
- Implementing character customization
- Integrating with UI elements

Remember that avatar instances can be resource-intensive, so manage them carefully and dispose of them properly when no longer needed. Also, consider using LOD (Level of Detail) for avatars that may be viewed from varying distances.
