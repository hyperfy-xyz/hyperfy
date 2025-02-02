# Player

The Player component in Hyperfy represents a player character in the virtual world. It handles movement, physics, networking, and avatar representation. The Player system automatically creates either a PlayerLocal or PlayerRemote instance based on whether the player is the local user or a remote user.

### Inheritance

Player inherits all properties and methods from [Entity](/docs/ref/Entity.md).

### Properties

### `player.isPlayer`: Boolean

Indicates that this entity is a player. Always true for Player entities.

### `player.player`: PlayerLocal | PlayerRemote

The underlying player implementation instance. Will be PlayerLocal for the local user and PlayerRemote for other players in the world.

### Methods

### `player.modify(data: Object): void`

Updates the player's state with new data. Handles both local and networked updates.

Parameters:
- `data`: Object containing updated player properties

### `player.destroy(local?: Boolean): void`

Cleans up the player entity and its associated resources.

Parameters:
- `local`: If true, notifies the network that this player was destroyed locally

## PlayerLocal Implementation

The local player implementation includes advanced physics, controls, and avatar management.

### Properties

### Physics Properties

- `mass`: Number - The player's physical mass (default: 1)
- `gravity`: Number - Gravity force applied to the player (default: 20)
- `jumpHeight`: Number - Maximum jump height in meters (default: 1.5)
- `capsuleRadius`: Number - Radius of the player's physics capsule (default: 0.3)
- `capsuleHeight`: Number - Height of the player's physics capsule (default: 1.6)

### Movement State

- `grounded`: Boolean - Whether the player is touching the ground
- `groundAngle`: Number - Angle of the ground surface in degrees
- `groundNormal`: Vector3 - Normal vector of the ground surface
- `slipping`: Boolean - Whether the player is slipping on a steep surface
- `jumping`: Boolean - Whether the player is currently jumping
- `falling`: Boolean - Whether the player is falling
- `moving`: Boolean - Whether the player is moving
- `running`: Boolean - Whether the player is running (holding shift)

### Methods

### `playerLocal.teleport(options: Object): void`

Instantly moves the player to a new position and optionally sets their rotation.

Parameters:
```typescript
{
  position: Vector3 | number[],  // New position
  rotationY?: number            // Optional Y rotation in radians
}
```

### `playerLocal.chat(message: String): void`

Displays a chat message above the player's head.

Parameters:
- `message`: The text to display

### Notes

- The player uses a capsule collider for physics interactions
- Movement is controlled via keyboard (WASD/arrows) or touch controls on mobile
- Camera control is handled via mouse (when right button is held) or touch pan
- The player automatically syncs its position and state across the network
- Physics includes advanced features like:
  - Ground detection and slope handling
  - Platform movement synchronization
  - Jump and gravity calculations
  - Friction and material adjustments based on state

### Example

```javascript
// Creating a player entity
const playerData = {
  id: 'unique-id',
  type: 'player',
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  user: {
    name: 'PlayerName',
    avatar: 'asset://avatar.vrm'  // Optional custom avatar
  }
}

const player = world.entities.add(playerData, true)

// The player entity will automatically:
// - Create appropriate physics representation
// - Set up input controls
// - Load and display the avatar
// - Handle network synchronization

// Teleporting a player
player.player.teleport({
  position: new THREE.Vector3(10, 0, 10),
  rotationY: Math.PI  // Face backward
})

// Displaying a chat message
player.player.chat('Hello, world!')
```

## PlayerRemote Implementation

The remote player implementation handles receiving and applying network updates from other players.

### Properties

### `playerRemote.lastUpdateAt`: Number

Timestamp of the last network update received.

### Methods

### `playerRemote.modify(data: Object): void`

Applies network updates to the remote player's state.

Parameters:
```typescript
{
  p?: number[],    // Position update [x, y, z]
  q?: number[],    // Quaternion update [x, y, z, w]
  e?: string,      // Emote state update
  t?: boolean      // Whether this is a teleport update
}
```

### Notes

- Remote players are automatically created when other players join the world
- Position and rotation are smoothly interpolated between network updates
- Animations and emotes are synchronized across the network
- Remote players maintain their own avatar instances

Remember to handle network latency and state reconciliation appropriately when implementing player interactions or gameplay mechanics that involve multiple players.
