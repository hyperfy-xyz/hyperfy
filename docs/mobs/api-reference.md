# Mob API Reference

Complete API documentation for the Hyperfy Mob system.

## Mob Entity

### Properties

#### `mob.health` (getter)

Current health value.

```javascript
const currentHealth = mob.health // 0 to maxHealth
```

**Availability**: Server and client
**Type**: `number`

---

#### `mob.maxHealth` (getter)

Maximum health value.

```javascript
const maxHealth = mob.maxHealth // e.g., 100
```

**Availability**: Server and client
**Type**: `number`

---

#### `mob.aiState` (getter)

AI state object for tracking behavior.

```javascript
const state = mob.aiState
// { mode: 'idle' | 'patrol' | 'chase' | 'flee',
//   target: entityId,
//   waypoints: [[x,y,z], ...],
//   waypointIndex: 0 }
```

**Availability**: Server and client
**Type**: `object`

---

### Methods

#### `mob.takeDamage(amount, source)`

Damage the mob.

```javascript
mob.takeDamage(25, playerId)
```

**Parameters**:
- `amount` (number): Damage amount
- `source` (string, optional): Source entity ID

**Availability**: Server only
**Events**: Emits `damaged`, `healthChanged`, `death` (if killed)

---

#### `mob.heal(amount)`

Heal the mob.

```javascript
mob.heal(10)
```

**Parameters**:
- `amount` (number): Heal amount

**Availability**: Server only
**Events**: Emits `healthChanged`

---

### Events

#### `aiUpdate`

Fired every fixed update on server for AI logic.

```javascript
app.on('aiUpdate', (delta) => {
  // Your AI logic here
})
```

**Parameters**:
- `delta` (number): Time since last fixed update (typically 0.02s)

**Availability**: Server only
**Frequency**: 50Hz

---

#### `healthChanged`

Fired when health changes.

```javascript
app.on('healthChanged', (health, oldHealth) => {
  console.log(`Health: ${oldHealth} → ${health}`)
})
```

**Parameters**:
- `health` (number): New health value
- `oldHealth` (number): Previous health value

**Availability**: Server and client

---

#### `damaged`

Fired when mob takes damage.

```javascript
app.on('damaged', ({ amount, source, health }) => {
  console.log(`Took ${amount} damage from ${source}`)
})
```

**Parameters**:
- `amount` (number): Damage amount
- `source` (string): Source entity ID
- `health` (number): Health after damage

**Availability**: Server only

---

#### `death`

Fired when health reaches 0.

```javascript
app.on('death', () => {
  console.log('Mob died')
  app.destroy() // Remove mob
})
```

**Availability**: Server only

---

## Degen API

All `degen.*` methods are server-only and available via `app.degen.*`.

### Movement

#### `app.degen.moveTo(position, speed)`

Move mob to a target position.

```javascript
app.degen.moveTo([10, 0, 5], 2)
// or
app.degen.moveTo(targetVector3, 3)
```

**Parameters**:
- `position` (Array | Vector3): Target position `[x, y, z]`
- `speed` (number): Movement speed in units/second (default: 2)

**Availability**: Server only

---

#### `app.degen.patrol(waypoints, speed, loop)`

Patrol between waypoints.

```javascript
const waypoints = [
  [0, 0, 0],
  [10, 0, 0],
  [10, 0, 10],
  [0, 0, 10]
]

app.degen.patrol(waypoints, 2, true)
```

**Parameters**:
- `waypoints` (Array<Array>): Array of positions `[[x,y,z], ...]`
- `speed` (number): Movement speed (default: 2)
- `loop` (boolean): Loop back to start (default: true)

**Availability**: Server only

---

#### `app.degen.chase(targetId, speed, minDistance)`

Chase a target entity.

```javascript
app.degen.chase(playerId, 3, 1.5)
```

**Parameters**:
- `targetId` (string): Entity ID to chase
- `speed` (number): Movement speed (default: 3)
- `minDistance` (number): Stop when this close (default: 1.5)

**Availability**: Server only

---

#### `app.degen.flee(threatId, speed, safeDistance)`

Flee from a threat.

```javascript
app.degen.flee(playerId, 4, 10)
```

**Parameters**:
- `threatId` (string): Entity ID to flee from
- `speed` (number): Movement speed (default: 4)
- `safeDistance` (number): Distance to consider safe (default: 10)

**Availability**: Server only

---

#### `app.degen.idle()`

Enter idle state (stop moving).

```javascript
app.degen.idle()
```

**Availability**: Server only

---

### Sensors

#### `app.degen.findNearestPlayer(maxDistance)`

Find nearest player within range.

```javascript
const nearest = app.degen.findNearestPlayer(20)

if (nearest) {
  console.log(`Player ${nearest.id} at ${nearest.distance}m`)
}
```

**Parameters**:
- `maxDistance` (number): Maximum search distance (default: 20)

**Returns**: `{ id: string, distance: number } | null`

**Availability**: Server only

---

#### `app.degen.canSeePlayer(playerId, maxDistance)`

Check if mob can see a player (raycast line of sight).

```javascript
const canSee = app.degen.canSeePlayer(playerId, 15)

if (canSee) {
  console.log('Player visible!')
}
```

**Parameters**:
- `playerId` (string): Player entity ID
- `maxDistance` (number): Maximum sight distance (default: 15)

**Returns**: `boolean`

**Availability**: Server only

---

#### `app.degen.getPlayersInRange(radius)`

Get all players within a radius.

```javascript
const players = app.degen.getPlayersInRange(10)

players.forEach(player => {
  console.log(`${player.id} at ${player.distance}m`)
})
```

**Parameters**:
- `radius` (number): Search radius (default: 10)

**Returns**: `Array<{ id: string, distance: number }>`

**Availability**: Server only

---

## AI System (Optional)

Advanced AI using AIController, Behaviors, and Sensors.

### AIController

```javascript
import { AIController } from '/src/degen/index.js'

const ai = new AIController(mob, options)
```

**Constructor Options**:
- `updateRate` (number): AI update interval in seconds (default: 0.1)

**Methods**:

#### `ai.registerBehavior(name, behavior)`

Register a behavior.

```javascript
ai.registerBehavior('patrol', new Patrol(waypoints))
```

---

#### `ai.registerSensor(name, sensor)`

Register a sensor.

```javascript
ai.registerSensor('proximity', new ProximitySensor({ radius: 10 }))
```

---

#### `ai.setBehavior(name)`

Switch to a behavior.

```javascript
ai.setBehavior('chase')
```

---

#### `ai.enable()` / `ai.disable()`

Enable or disable AI.

```javascript
ai.disable() // Stop AI
ai.enable()  // Resume AI
```

---

#### `ai.destroy()`

Clean up AI controller.

```javascript
ai.destroy()
```

---

### Behaviors

#### Patrol

```javascript
import { Patrol } from '/src/degen/index.js'

const patrol = new Patrol(waypoints, {
  speed: 2,
  loop: true,
  waypointRadius: 0.5
})

ai.registerBehavior('patrol', patrol)
ai.setBehavior('patrol')
```

**Options**:
- `speed` (number): Movement speed (default: 2)
- `loop` (boolean): Loop patrol (default: true)
- `waypointRadius` (number): Waypoint reach distance (default: 0.5)

---

#### Chase

```javascript
import { Chase } from '/src/degen/index.js'

const chase = new Chase({
  speed: 3,
  minDistance: 1.5,
  maxDistance: 20
})

ai.registerBehavior('chase', chase)

// Set target before or after switching
chase.setTarget(playerId)
ai.setBehavior('chase')
```

**Options**:
- `speed` (number): Movement speed (default: 3)
- `minDistance` (number): Stop distance (default: 1.5)
- `maxDistance` (number): Give up distance (default: 20)

**Methods**:
- `setTarget(targetId)`: Set chase target

---

#### Flee

```javascript
import { Flee } from '/src/degen/index.js'

const flee = new Flee({
  speed: 4,
  safeDistance: 10,
  panicDistance: 5
})

ai.registerBehavior('flee', flee)

flee.setThreat(playerId)
ai.setBehavior('flee')
```

**Options**:
- `speed` (number): Movement speed (default: 4)
- `safeDistance` (number): Safe distance (default: 10)
- `panicDistance` (number): Start fleeing distance (default: 5)

**Methods**:
- `setThreat(threatId)`: Set threat to flee from

---

#### Idle

```javascript
import { Idle } from '/src/degen/index.js'

const idle = new Idle()

ai.registerBehavior('idle', idle)
ai.setBehavior('idle')
```

---

### Sensors

#### ProximitySensor

Detects entities within a radius.

```javascript
import { ProximitySensor } from '/src/degen/index.js'

const proximity = new ProximitySensor({
  radius: 10,
  updateRate: 0.2,
  detectPlayers: true,
  detectMobs: false
})

ai.registerSensor('proximity', proximity)

// Access results
const entities = proximity.getEntitiesInRange()
const nearest = proximity.getNearestEntity()
const hasAny = proximity.hasEntitiesInRange()
```

**Options**:
- `radius` (number): Detection radius (default: 10)
- `updateRate` (number): Update interval (default: 0.2)
- `detectPlayers` (boolean): Detect players (default: true)
- `detectMobs` (boolean): Detect other mobs (default: false)

**Methods**:
- `getEntitiesInRange()`: Returns `Array<{ id, distance, type }>`
- `getNearestEntity()`: Returns `{ id, distance, type } | null`
- `hasEntitiesInRange()`: Returns `boolean`

---

#### RaycastSensor

Line-of-sight detection.

```javascript
import { RaycastSensor } from '/src/degen/index.js'

const raycast = new RaycastSensor({
  maxDistance: 15,
  updateRate: 0.3,
  heightOffset: 1
})

ai.registerSensor('raycast', raycast)

// Check visibility
const canSee = raycast.canSeePlayer(playerId)
const visible = raycast.getVisiblePlayers([player1, player2])
```

**Options**:
- `maxDistance` (number): Maximum raycast distance (default: 15)
- `updateRate` (number): Update interval (default: 0.3)
- `heightOffset` (number): Cast from mob's eye level (default: 1)

**Methods**:
- `canSeePlayer(playerId)`: Returns `boolean`
- `getVisiblePlayers(playerIds)`: Returns `Array<string>` (visible IDs)
- `getVisibleTargets()`: Returns `Map<id, boolean>`
- `clear()`: Clear cached results

---

## Spawning Mobs

### Server

```javascript
if (world.isServer) {
  world.entities.add({
    type: 'mob',
    blueprint: 'degen/zombie',
    position: [0, 1, 0],
    quaternion: [0, 0, 0, 1],
    health: 100,
    maxHealth: 100
  })
}
```

### Client

Clients receive mob via `entityAdded` network message automatically.

---

## Complete Example

```javascript
// Zombie mob with AI system
import { AIController, Patrol, Chase, Idle, ProximitySensor, RaycastSensor } from '/src/degen/index.js'

if (world.isServer) {
  // Setup AI controller
  const ai = new AIController(app, { updateRate: 0.1 })

  // Behaviors
  const waypoints = [[0, 0, 0], [10, 0, 0], [10, 0, 10], [0, 0, 10]]
  ai.registerBehavior('idle', new Idle())
  ai.registerBehavior('patrol', new Patrol(waypoints, { speed: 2 }))
  ai.registerBehavior('chase', new Chase({ speed: 3, minDistance: 1.5 }))

  // Sensors
  const proximity = new ProximitySensor({ radius: 15 })
  const raycast = new RaycastSensor({ maxDistance: 15 })
  ai.registerSensor('proximity', proximity)
  ai.registerSensor('raycast', raycast)

  // Start with patrol
  ai.setBehavior('patrol')

  // AI logic
  app.on('aiUpdate', () => {
    const nearest = proximity.getNearestEntity()

    if (nearest && nearest.type === 'player' && raycast.canSeePlayer(nearest.id)) {
      // Chase visible player
      const chase = ai.behaviors.get('chase')
      chase.setTarget(nearest.id)
      ai.setBehavior('chase')

      // Attack if in range
      if (nearest.distance < 1.5) {
        world.getPlayer(nearest.id).takeDamage(10)
      }
    } else if (app.aiState.mode === 'chase') {
      // Lost player, go back to patrol
      ai.setBehavior('patrol')
    }
  })

  // Death
  app.on('death', () => {
    ai.destroy()
    app.send('died')
    setTimeout(() => app.destroy(), 2000) // Despawn after 2s
  })
}

if (world.isClient) {
  // Health bar
  const healthBar = app.create('ui', { width: 100, height: 10, billboard: 'y' })
  const healthFill = app.create('uiview', {
    backgroundColor: 'red',
    width: app.health / app.maxHealth * 100
  })
  healthBar.add(healthFill)
  app.add(healthBar)

  app.on('healthChanged', (health) => {
    healthFill.width = (health / app.maxHealth) * 100
  })

  // Death animation
  app.on('died', () => {
    app.animate({ scale: 0 }, 1000)
  })
}
```
