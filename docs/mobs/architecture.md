# Mob System Architecture

Technical architecture and implementation details for the Hyperfy Mob system.

## System Design

### Core Concept

Mobs are a specialized subset of Apps with:
- `data.type = 'mob'` instead of `'app'`
- `data.mover = 'server'` for server-authoritative movement
- Health system (`health`, `maxHealth`)
- AI state management (`aiState` object)
- Server-only AI update loop (`aiUpdate` event)

### Class Hierarchy

```
Entity (base class)
├── App (interactive objects, scripts)
│   └── Mob (NEW - extends App)
├── PlayerLocal
└── PlayerRemote
```

**Key Design Decision**: Mobs extend App rather than Entity directly. This provides:
- Full App functionality (scripts, nodes, events, proxies)
- Network interpolation (LerpVector3, LerpQuaternion)
- Blueprint system integration
- Script sandbox (SES compartments)

## File Structure

```
/src/core/
├── entities/
│   ├── Entity.js        # Base entity
│   ├── App.js           # App entity
│   └── Mob.js           # NEW: Mob entity (extends App)
├── systems/
│   ├── Entities.js      # Entity factory (modified)
│   ├── Apps.js          # App proxy system
│   └── Mobs.js          # NEW: Mob system
├── extras/
│   └── createMobProxy.js # NEW: Mob API methods
└── World.js             # System registration (modified)

/src/degen/              # NEW: Degen AI namespace
├── ai/
│   ├── AIController.js  # AI state machine
│   ├── behaviors/
│   │   ├── Patrol.js
│   │   ├── Chase.js
│   │   ├── Flee.js
│   │   └── Idle.js
│   └── sensors/
│       ├── ProximitySensor.js
│       └── RaycastSensor.js
└── index.js             # Degen exports
```

## Implementation Details

### 1. Mob Entity Class

**File**: `/src/core/entities/Mob.js`

Extends App with:
- Server authority enforcement
- Health system initialization
- AI state object
- Health modification handling
- Server-only AI update events

```javascript
export class Mob extends App {
  constructor(world, data, local) {
    super(world, data, local)
    this.isMob = true

    // Server authority
    if (world.network.isServer && !this.data.mover) {
      this.data.mover = 'server'
    }

    // Health system
    this.data.health = this.data.health ?? 100
    this.data.maxHealth = this.data.maxHealth ?? 100

    // AI state
    this.aiState = { mode: 'idle', target: null, ... }
  }

  fixedUpdate(delta) {
    super.fixedUpdate(delta)
    if (this.world.network.isServer) {
      this.emit('aiUpdate', delta) // Server-only AI
    }
  }
}
```

### 2. Mob API Proxy

**File**: `/src/core/extras/createMobProxy.js`

Provides three categories of methods:

**Health System** (mobGetters, mobMethods):
```javascript
health: getter
maxHealth: getter
takeDamage(amount, source): method
heal(amount): method
```

**Degen AI** (degenMethods):
```javascript
degen.moveTo(position, speed)
degen.patrol(waypoints, speed, loop)
degen.chase(targetId, speed, minDistance)
degen.flee(threatId, speed, safeDistance)
degen.idle()
degen.findNearestPlayer(maxDistance)
degen.canSeePlayer(playerId, maxDistance)
degen.getPlayersInRange(radius)
```

### 3. Mobs System

**File**: `/src/core/systems/Mobs.js`

Integrates with Apps system via `inject()`:
```javascript
export class Mobs extends System {
  init(options) {
    const { mobGetters, mobMethods, degenMethods } = createMobProxy()

    this.world.apps.inject({
      app: {
        health: mobGetters.health,
        maxHealth: mobGetters.maxHealth,
        takeDamage: mobMethods.takeDamage,
        heal: mobMethods.heal,
        degen: {
          get(entity) {
            // Creates proxy for degen.* methods
          }
        }
      }
    })
  }
}
```

### 4. Entity Registry

**File**: `/src/core/systems/Entities.js`

Added `mob: Mob` to Types registry:
```javascript
const Types = {
  app: App,
  mob: Mob,        // NEW
  playerLocal: PlayerLocal,
  playerRemote: PlayerRemote,
}
```

Entity factory automatically uses correct class based on `data.type`.

### 5. World Integration

**File**: `/src/core/World.js`

Registered Mobs system after Apps:
```javascript
this.register('apps', Apps)
this.register('mobs', Mobs)  // NEW
```

## Network Protocol

No protocol changes required. Uses existing messages:

### Spawn Mob
```javascript
{
  type: 'entityAdded',
  data: {
    id: 'uuid',
    type: 'mob',           // Type distinction
    blueprint: 'degen/zombie',
    position: [x, y, z],
    quaternion: [x, y, z, w],
    mover: 'server',       // Server authority
    health: 100,
    maxHealth: 100
  }
}
```

### Position Update (8Hz)
```javascript
{
  type: 'entityModified',
  data: {
    id: 'uuid',
    position: [x, y, z],
    quaternion: [x, y, z, w]
  }
}
```

### Health Update
```javascript
{
  type: 'entityModified',
  data: {
    id: 'uuid',
    health: 75
  }
}
```

### Custom Events
```javascript
{
  type: 'entityEvent',
  data: ['uuid', version, 'attacked', { playerId: 'p1' }]
}
```

## Server Authority Pattern

### Server (AI Logic)
```javascript
if (world.isServer) {
  app.on('aiUpdate', (delta) => {
    // AI runs here
    app.degen.chase(targetId, speed, minDistance)

    // Damage players
    player.takeDamage(amount)

    // Broadcasts entityModified automatically
  })
}
```

### Client (Visuals)
```javascript
if (world.isClient) {
  // Receives position updates via entityModified
  // Interpolates using networkPos/networkQuat

  app.on('healthChanged', (health) => {
    // Update health bar
  })
}
```

## AI System Architecture

### AIController (Optional)

Advanced AI using state machine pattern:

```javascript
import { AIController, Patrol, Chase, Idle } from '/src/degen/index.js'

if (world.isServer) {
  const ai = new AIController(app)

  // Register behaviors
  ai.registerBehavior('idle', new Idle())
  ai.registerBehavior('patrol', new Patrol(waypoints))
  ai.registerBehavior('chase', new Chase({ speed: 3 }))

  // Register sensors
  ai.registerSensor('proximity', new ProximitySensor({ radius: 10 }))

  // Set initial behavior
  ai.setBehavior('patrol')

  // AI updates automatically via aiUpdate event
}
```

### Behavior Lifecycle

Each behavior has:
- `onEnter()` - Called when behavior starts
- `update(delta)` - Called every AI update
- `onExit()` - Called when behavior ends

### Sensors

**ProximitySensor**: Detects entities in radius
**RaycastSensor**: Line-of-sight checks

## Performance

### Server AI Budget

AI runs in `fixedUpdate` at 50Hz:
- Each mob's `aiUpdate` fires at 50Hz
- Use rate limiting for expensive operations
- Sensors have configurable update rates (5-10Hz recommended)

### Network Bandwidth

Mobs share 8Hz position update rate with apps:
- Position: ~48 bytes per mob per update
- Health: ~20 bytes per mob when changed
- 100 mobs = ~4.8KB/sec position updates

### Client Performance

Mobs reuse existing systems:
- Interpolation: LerpVector3/LerpQuaternion
- Rendering: Same node/mesh system as apps
- Physics: Same RigidBody system

## Security

### Server Authority

- Clients cannot modify mob AI or health
- All damage/heal operations validated on server
- Position updates sent only by server

### Script Sandbox

Mob scripts run in SES compartments (same as apps):
- Limited global scope
- No file system access
- Controlled network access

## Extensibility

### Adding New Behaviors

```javascript
// /src/degen/ai/behaviors/Wander.js
export class Wander {
  constructor(options) {
    this.options = { radius: 10, ...options }
  }

  onEnter() {
    this.pickRandomPoint()
  }

  update(delta) {
    if (this.reachedPoint()) {
      this.pickRandomPoint()
    }
    this.controller.mob.degen.moveTo(this.targetPoint, 2)
  }

  pickRandomPoint() {
    // Random point within radius
  }
}
```

### Adding New Sensors

```javascript
// /src/degen/ai/sensors/HearingSensor.js
export class HearingSensor {
  constructor(options) {
    this.options = { range: 20, ...options }
  }

  update(delta) {
    // Detect sound events in range
  }
}
```

## Integration with Existing Systems

### Apps System

Mobs use Apps proxy system:
- `app.on()`, `app.send()`, `app.create()` all work
- `world.getPlayer()`, `world.raycast()` available
- Full node system access

### Physics System

Mobs can use physics:
```javascript
app.physics.setVelocity([0, 5, 0]) // Jump
app.physics.applyImpulse([0, 10, 0]) // Force
```

### Events System

Mobs can listen to world events:
```javascript
world.on('enter', ({ playerId }) => {
  // Player entered world
})
```

## Future Enhancements

Potential additions:
- Behavior trees (complex AI)
- Navigation meshes (pathfinding)
- Mob spawners (world generation)
- Loot tables (drops on death)
- Equipment system (mob gear)
- Factions (team-based AI)
