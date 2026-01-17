# Mob System

The Mob system adds server-authoritative AI entities (monsters, NPCs, creatures) to Hyperfy worlds. Mobs are a specialized type of App with built-in health systems, AI behaviors, and Degen-branded API methods.

## Overview

Mobs extend the existing App system with:

- **Server-Authoritative AI**: All mob logic runs on the server for consistency
- **Health System**: Built-in health, damage, and healing mechanics
- **AI Behaviors**: Reusable behavior patterns (patrol, chase, flee, idle)
- **Sensors**: Proximity and raycast sensors for player detection
- **Degen API**: Branded `app.degen.*` methods for mob-specific functionality
- **Network Sync**: Automatic position and health synchronization at 8Hz

## Quick Start

### 1. Create a Mob Blueprint

```javascript
// zombie.hyp script
if (world.isServer) {
  // Server: AI logic
  app.on('aiUpdate', (delta) => {
    const nearest = app.degen.findNearestPlayer(10)

    if (nearest) {
      app.degen.chase(nearest.id, 2, 1.5)

      if (nearest.distance < 1.5) {
        const player = world.getPlayer(nearest.id)
        player.takeDamage(10)
      }
    } else {
      app.degen.idle()
    }
  })
}

if (world.isClient) {
  // Client: Health bar visualization
  const healthBar = app.create('ui', { width: 100, height: 10 })
  app.on('healthChanged', (health) => {
    healthBar.width = (health / app.maxHealth) * 100
  })
}
```

### 2. Spawn a Mob

```javascript
world.entities.add({
  type: 'mob',
  blueprint: 'degen/zombie',
  position: [0, 1, 0],
  quaternion: [0, 0, 0, 1],
  health: 100,
  maxHealth: 100
})
```

## Key Features

### Server Authority

Mobs always have `data.mover = 'server'` - the server controls all movement and AI. Clients receive position updates and render the mob.

### Health System

```javascript
// Server only
mob.takeDamage(25, sourceId)
mob.heal(10)

// Both server and client
mob.health // Current health
mob.maxHealth // Maximum health

// Events
app.on('healthChanged', (health, oldHealth) => {})
app.on('damaged', ({ amount, source, health }) => {})
app.on('death', () => {})
```

### AI System

```javascript
// Degen API methods (server only)
app.degen.moveTo([x, y, z], speed)
app.degen.patrol(waypoints, speed, loop)
app.degen.chase(targetId, speed, minDistance)
app.degen.flee(threatId, speed, safeDistance)
app.degen.idle()

// Sensors
app.degen.findNearestPlayer(maxDistance)
app.degen.canSeePlayer(playerId, maxDistance)
app.degen.getPlayersInRange(radius)

// AI State
app.aiState // { mode, target, waypoints, ... }

// AI Update Event
app.on('aiUpdate', (delta) => {
  // Your AI logic here (server only)
})
```

## Architecture

```
Entity (base)
├── App (static/interactive objects)
│   └── Mob (NEW - living entities with AI)
├── PlayerLocal
└── PlayerRemote
```

Mobs use the same network protocol as Apps:
- `entityAdded` - Spawn mob
- `entityModified` - Position/health updates (8Hz)
- `entityEvent` - Custom events
- `entityRemoved` - Destroy mob

## Documentation

- [Architecture](./architecture.md) - System design and implementation details
- [API Reference](./api-reference.md) - Complete API documentation
- [AI Behaviors](./ai-behaviors.md) - AI system and behavior guide
- [Networking](./networking.md) - Network protocol specification
- [Examples](./examples/) - Tutorial and example blueprints

## Examples

### Simple Patrol Mob

```javascript
// Server AI
if (world.isServer) {
  const waypoints = [[0, 0, 0], [10, 0, 0], [10, 0, 10], [0, 0, 10]]

  app.on('aiUpdate', () => {
    app.degen.patrol(waypoints, 2, true)
  })
}
```

### Aggressive Zombie

```javascript
// Server AI with aggro range
if (world.isServer) {
  const aggroRange = 15
  const attackRange = 1.5
  const damage = 10

  app.on('aiUpdate', () => {
    const nearest = app.degen.findNearestPlayer(aggroRange)

    if (nearest && app.degen.canSeePlayer(nearest.id)) {
      app.degen.chase(nearest.id, 3, attackRange)

      if (nearest.distance < attackRange) {
        world.getPlayer(nearest.id).takeDamage(damage)
        app.send('attacked', { playerId: nearest.id })
      }
    } else {
      app.degen.idle()
    }
  })
}
```

### Fleeing NPC

```javascript
// Server AI - flees from nearby players
if (world.isServer) {
  const fleeDistance = 5

  app.on('aiUpdate', () => {
    const nearest = app.degen.findNearestPlayer(fleeDistance)

    if (nearest) {
      app.degen.flee(nearest.id, 4, 10)
    } else {
      app.degen.idle()
    }
  })
}
```

## Performance Considerations

- **AI Budget**: Limit total mobs per world (AI runs at 50Hz on server)
- **Network**: Mobs share 8Hz position update rate with apps
- **Client**: Uses existing interpolation for smooth movement
- **Physics**: Standard RigidBody system, same as apps

## Backward Compatibility

The mob system is fully backward compatible:
- Existing `type: 'app'` entities unchanged
- Same network protocol and message types
- No database schema changes required
- Blueprint format unchanged
