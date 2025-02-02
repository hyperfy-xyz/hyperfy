# Chat

The Chat system in Hyperfy manages chat messages and notifications. It runs on both client and server, providing message storage, broadcasting, and subscription capabilities.

### Properties

### `chat.msgs`: Array<ChatMessage>

Array of chat messages, limited to the most recent 50 messages.

### Methods

### `chat.add(msg: ChatMessage, broadcast?: Boolean): void`

Adds a new chat message and notifies subscribers.

Parameters:
```typescript
interface ChatMessage {
  body: String,           // Message content
  fromId?: String,       // Sender entity ID (if from a player)
  // ... other message properties
}
```
- `broadcast`: Whether to broadcast the message to other clients

### `chat.subscribe(callback: Function): Function`

Subscribes to chat updates with immediate callback of current messages.

Parameters:
- `callback`: Function called with array of messages when chat updates

Returns:
- Unsubscribe function

### `chat.serialize(): Array<ChatMessage>`

Serializes chat messages for network transmission.

Returns:
- Array of chat messages

### `chat.deserialize(msgs: Array<ChatMessage>): void`

Recreates chat state from serialized messages.

Parameters:
- `msgs`: Array of chat messages

### Notes

- Maintains a maximum of 50 messages
- Supports command messages (starting with '/')
- Provides player chat animations
- Broadcasts messages across the network
- Emits chat events for the world

### Usage

The Chat system is used to:

1. Send and receive chat messages
2. Handle player chat animations
3. Process chat commands
4. Maintain chat history
5. Synchronize chat across clients

### Example

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Create chat UI
      this.createChatInterface()
      
      // Subscribe to chat updates
      this.unsubscribe = world.chat.subscribe(this.handleChatUpdate)
      
      // Listen for chat events
      world.on('chat', this.handleChatEvent)
    },
    
    createChatInterface() {
      // Create chat container
      const chatContainer = app.create('UI')
      
      // Create chat input
      const input = app.create('UIText')
      input.placeholder = 'Type a message...'
      
      // Handle message submission
      input.onSubmit = (text) => {
        this.sendChatMessage(text)
      }
      
      chatContainer.add(input)
      app.add(chatContainer)
      
      this.chatUI = {
        container: chatContainer,
        input: input
      }
    },
    
    sendChatMessage(text) {
      // Check for commands
      if (text.startsWith('/')) {
        this.handleCommand(text)
        return
      }
      
      // Create message object
      const message = {
        body: text,
        fromId: world.entities.player?.id,
        timestamp: Date.now()
      }
      
      // Add message locally and broadcast
      world.chat.add(message, true)
    },
    
    handleCommand(text) {
      const [command, ...args] = text.slice(1).split(' ')
      
      switch(command) {
        case 'help':
          this.showHelp()
          break
          
        case 'whisper':
          this.sendWhisper(args)
          break
          
        default:
          console.log('Unknown command:', command)
      }
    },
    
    handleChatUpdate(messages) {
      // Update chat display
      this.updateChatDisplay(messages)
      
      // Scroll to latest message
      this.scrollToBottom()
    },
    
    updateChatDisplay(messages) {
      // Clear existing messages
      this.clearChatMessages()
      
      // Add message elements
      messages.forEach(msg => {
        const messageElement = this.createMessageElement(msg)
        this.chatUI.container.add(messageElement)
      })
    },
    
    createMessageElement(message) {
      const element = app.create('UIText')
      
      // Get player name if message is from a player
      let sender = 'System'
      if (message.fromId) {
        const player = world.entities.getPlayer(message.fromId)
        if (player) {
          sender = player.name
        }
      }
      
      // Format message
      element.text = `${sender}: ${message.body}`
      
      return element
    },
    
    handleChatEvent(message) {
      // Handle special messages
      if (message.type === 'system') {
        this.showSystemNotification(message)
      }
      
      // Play sound effect
      if (message.fromId) {
        this.playChatSound()
      }
    },
    
    showSystemNotification(message) {
      const notification = app.create('UIText')
      notification.text = message.body
      notification.style.color = '#ffff00'  // Yellow for system messages
      
      this.chatUI.container.add(notification)
      
      // Remove after delay
      setTimeout(() => {
        notification.destroy()
      }, 5000)
    },
    
    destroy() {
      // Clean up subscriptions
      if (this.unsubscribe) {
        this.unsubscribe()
      }
      
      // Remove chat event listener
      world.off('chat', this.handleChatEvent)
      
      // Clean up UI
      if (this.chatUI) {
        this.chatUI.container.destroy()
      }
    }
  }
}
```

This example demonstrates:
- Creating a chat interface
- Sending and receiving messages
- Handling chat commands
- Managing chat subscriptions
- Processing chat events
- Creating message displays
- Handling system notifications

Remember that chat messages are limited to 50 entries, so implement proper UI scrolling and message cleanup to handle chat history effectively.
