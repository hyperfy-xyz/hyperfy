# Simple Mob Example

Create a basic mob that patrols between waypoints.

## Blueprint File

Create `simple-patrol.hyp`:

```javascript
// Simple patrol mob
// Server: AI logic
if (world.isServer) {
  // Define patrol waypoints
  const waypoints = [
    [0, 0, 0],
    [10, 0, 0],
    [10, 0, 10],
    [0, 0, 10]
  ]

  // AI update loop
  app.on('aiUpdate', (delta) => {
    app.degen.patrol(waypoints, 2, true)
  })

  // Handle death
  app.on('death', () => {
    console.log('Mob died')
    app.destroy()
  })
}

// Client: Visual feedback
if (world.isClient) {
  // Create simple health bar
  const barContainer = app.create('ui', {
    width: 100,
    height: 10,
    billboard: 'y',
    offsetY: 2
  })

  const healthFill = app.create('uiview', {
    backgroundColor: 'green',
    width: 100,
    height: 10
  })

  barContainer.add(healthFill)
  app.add(barContainer)

  // Update health bar
  app.on('healthChanged', (health, oldHealth) => {
    const percent = health / app.maxHealth
    healthFill.width = 100 * percent

    // Color based on health
    if (percent > 0.5) {
      healthFill.backgroundColor = 'green'
    } else if (percent > 0.25) {
      healthFill.backgroundColor = 'yellow'
    } else {
      healthFill.backgroundColor = 'red'
    }
  })
}
```

## Spawn the Mob

```javascript
// In world script or admin panel
world.entities.add({
  type: 'mob',
  blueprint: 'simple-patrol',
  position: [0, 1, 0],
  quaternion: [0, 0, 0, 1],
  health: 100,
  maxHealth: 100
})
```

## What It Does

1. **Server**: Mob patrols between 4 waypoints at 2 units/second
2. **Client**: Shows green health bar above mob
3. **Death**: Mob is destroyed when health reaches 0

## Next Steps

- Add damage from player attacks
- Make mob react to nearby players
- Add sound effects
- Add visual death animation
