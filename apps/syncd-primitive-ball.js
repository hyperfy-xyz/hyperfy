// Networked primitive with ownership model
// Similar to the tumbleweed example - any player can grab control

const SEND_RATE = 1 / 8
const v1 = new Vector3()

// Create a physics-enabled primitive
const ball = world.sphere({
  radius: 0.5,
  rigidbody: {
    type: 'dynamic',
    mass: 0.5,
    linearDamping: 0.1,
    angularDamping: 0.5,
    onContactStart: (e) => {
      // When a player touches the ball, they take ownership
      if (e.playerId && e.playerId === world.networkId) {
        ownerId = world.networkId
        app.send('take', ownerId)
      }
    }
  }
})

// Position it somewhere visible
ball.position.set(0, 2, -5)
ball.material.color = '#ff00ff'
ball.material.emissiveIntensity = 0.3

let ownerId = null
let lastSent = 0

if (world.isClient) {
  // Wait for initial state from server
  if (app.state.ready) {
    init(app.state)
  } else {
    app.on('state', init)
  }
  
  function init(state) {
    // Apply initial state
    ball.position.fromArray(state.p)
    ball.quaternion.fromArray(state.q)
    ball.setLinearVelocity(v1.fromArray(state.v))
    
    // Set up interpolation for smooth movement
    const npos = new LerpVector3(ball.position, SEND_RATE)
    const nqua = new LerpQuaternion(ball.quaternion, SEND_RATE)
    
    // Handle ownership changes
    app.on('take', (newOwnerId) => {
      if (ownerId === newOwnerId) return
      ownerId = newOwnerId
      npos.snap()
      nqua.snap()
      
      // Visual feedback for ownership
      if (ownerId === world.networkId) {
        ball.material.color = '#00ff00' // Green when you own it
      } else if (ownerId) {
        ball.material.color = '#ff0000' // Red when someone else owns it
      } else {
        ball.material.color = '#ff00ff' // Purple when no owner
      }
    })
    
    // Receive position updates
    app.on('move', (e) => {
      if (ownerId === world.networkId) return // Ignore if we own it
      npos.pushArray(e.p)
      nqua.pushArray(e.q)
      ball.setLinearVelocity(v1.fromArray(e.v))
    })
    
    // Update loop
    app.on('update', (delta) => {
      if (ball.sleeping) return
      
      if (ownerId === world.networkId) {
        // We own it - send updates
        lastSent += delta
        if (lastSent > SEND_RATE) {
          lastSent = 0
          app.send('move', {
            p: ball.position.toArray(),
            q: ball.quaternion.toArray(),
            v: ball.getLinearVelocity(v1).toArray(),
          })
        }
      } else {
        // Someone else owns it - interpolate
        npos.update(delta)
        nqua.update(delta)
      }
    })
  }
  
  // Allow kicking the ball when you own it
  world.on('keydown', (event) => {
    if (event.key === ' ' && ownerId === world.networkId) {
      const force = new Vector3(
        (Math.random() - 0.5) * 10,
        10,
        (Math.random() - 0.5) * 10
      )
      ball.addForce(force, 'impulse')
    }
  })
}

if (world.isServer) {
  // Initialize state
  app.state.ready = true
  app.state.p = ball.position.toArray()
  app.state.q = ball.quaternion.toArray()
  app.state.v = [0, 0, 0]
  app.send('state', app.state)
  
  // Handle ownership changes
  app.on('take', (newOwnerId, networkId) => {
    ownerId = newOwnerId
    app.send('take', newOwnerId) // Broadcast to all clients
  })
  
  // Relay position updates
  app.on('move', (e, networkId) => {
    // Only accept moves from the current owner
    if (networkId !== ownerId) return
    
    app.state.p = e.p
    app.state.q = e.q
    app.state.v = e.v
    ball.position.fromArray(e.p)
    ball.quaternion.fromArray(e.q)
    ball.setLinearVelocity(v1.fromArray(e.v))
    app.send('move', e, networkId) // Send to all except sender
  })
  
  // Handle player disconnection
  world.on('leave', (e) => {
    if (e.player.networkId === ownerId) {
      ownerId = null
      app.send('take', null)
    }
  })
  
  // Server takes control when no one owns it
  app.on('update', (delta) => {
    if (ball.sleeping) return
    
    if (!ownerId) {
      lastSent += delta
      if (lastSent > SEND_RATE) {
        app.state.p = ball.position.toArray()
        app.state.q = ball.quaternion.toArray()
        app.state.v = ball.getLinearVelocity(v1).toArray()
        app.send('move', {
          p: app.state.p,
          q: app.state.q,
          v: app.state.v,
        })
        lastSent = 0
      }
    }
  })
}

// Cleanup
app.on('destroy', () => {
  app.off('state')
  app.off('take')
  app.off('move')
  app.off('update')
  world.off('keydown')
  world.off('leave')
  world.remove(ball)
})