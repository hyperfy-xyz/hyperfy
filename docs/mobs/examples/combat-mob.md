# Combat Mob Example

Create an aggressive mob that chases and attacks players.

## Blueprint File

Create `zombie.hyp`:

```javascript
// Aggressive zombie mob
if (world.isServer) {
  // Configuration
  const config = {
    aggroRange: 15,    // Detection range
    attackRange: 1.5,  // Melee attack range
    attackDamage: 10,  // Damage per hit
    attackCooldown: 1, // 1 second between attacks
    speed: 3           // Chase speed
  }

  let lastAttackTime = 0

  // AI update loop
  app.on('aiUpdate', (delta) => {
    const time = world.getTime()

    // Find nearest player
    const nearest = app.degen.findNearestPlayer(config.aggroRange)

    if (nearest) {
      // Check line of sight
      const canSee = app.degen.canSeePlayer(nearest.id, config.aggroRange)

      if (canSee) {
        // Chase player
        app.degen.chase(nearest.id, config.speed, config.attackRange)

        // Attack if in range and cooldown ready
        if (nearest.distance < config.attackRange) {
          if (time - lastAttackTime >= config.attackCooldown) {
            const player = world.getPlayer(nearest.id)
            if (player) {
              player.takeDamage(config.attackDamage)
              app.send('attacked', { playerId: nearest.id })
              lastAttackTime = time
            }
          }
        }
      } else {
        // Lost sight, go idle
        app.degen.idle()
      }
    } else {
      // No players nearby, idle
      app.degen.idle()
    }
  })

  // Death
  app.on('death', () => {
    app.send('died')

    // Despawn after 2 seconds
    setTimeout(() => {
      app.destroy()
    }, 2000)
  })
}

if (world.isClient) {
  // Health bar
  const healthBarBg = app.create('ui', {
    width: 100,
    height: 10,
    billboard: 'y',
    offsetY: 2.5
  })

  const healthBarFill = app.create('uiview', {
    backgroundColor: 'red',
    width: 100,
    height: 10
  })

  healthBarBg.add(healthBarFill)
  app.add(healthBarBg)

  app.on('healthChanged', (health) => {
    healthBarFill.width = (health / app.maxHealth) * 100
  })

  // Attack animation
  app.on('attacked', () => {
    // Quick red flash
    const flash = app.create('mesh', {
      type: 'sphere',
      radius: 1.5,
      color: 'red',
      opacity: 0.5
    })
    app.add(flash)

    setTimeout(() => {
      flash.destroy()
    }, 200)
  })

  // Death animation
  app.on('died', () => {
    // Fade out and shrink
    app.animate({ scale: 0, opacity: 0 }, 2000)
  })
}
```

## Spawn the Zombie

```javascript
world.entities.add({
  type: 'mob',
  blueprint: 'zombie',
  position: [5, 1, 5],
  quaternion: [0, 0, 0, 1],
  health: 100,
  maxHealth: 100
})
```

## Features

- **Aggro System**: Detects players within 15 units
- **Line of Sight**: Only chases visible players
- **Melee Combat**: Attacks when within 1.5 units
- **Attack Cooldown**: 1 second between attacks
- **Death**: Fades out over 2 seconds

## Advanced Variations

### Archer (Ranged Combat)

```javascript
if (world.isServer) {
  app.on('aiUpdate', () => {
    const nearest = app.degen.findNearestPlayer(20)

    if (nearest && app.degen.canSeePlayer(nearest.id)) {
      // Keep distance
      if (nearest.distance < 5) {
        app.degen.flee(nearest.id, 3, 8)
      } else if (nearest.distance > 15) {
        app.degen.chase(nearest.id, 2, 10)
      } else {
        // In range, shoot
        app.degen.idle()
        if (canShoot()) {
          shootArrow(nearest.id)
        }
      }
    }
  })
}
```

### Tank (High HP, Slow)

```javascript
world.entities.add({
  type: 'mob',
  blueprint: 'tank',
  position: [0, 1, 0],
  quaternion: [0, 0, 0, 1],
  health: 500,      // High HP
  maxHealth: 500
})

// In blueprint:
const config = {
  speed: 1.5,       // Slower
  attackDamage: 25, // Higher damage
  attackRange: 2    // Longer reach
}
```

### Boss (Multi-Phase)

```javascript
if (world.isServer) {
  app.on('healthChanged', (health) => {
    // Phase changes based on health
    if (health < app.maxHealth * 0.5 && app.aiState.phase !== 2) {
      app.aiState.phase = 2
      config.speed = 4        // Faster in phase 2
      config.attackDamage = 20
      app.send('phaseChange', { phase: 2 })
    }
  })
}
```

## Testing

1. Spawn zombie near player spawn
2. Approach to trigger aggro
3. Zombie should chase and attack
4. Damage zombie to test health system
5. Reduce health to 0 to test death
