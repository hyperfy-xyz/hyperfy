// Test script for primitives with physics

export default {
  init() {
    console.log('Creating physics primitives...')
    
    this.primitives = []
    
    // Create a static floor
    const floor = world.box({
      width: 20,
      height: 0.1,
      depth: 20,
      rigidbody: {
        type: 'static'
      }
    })
    floor.position.set(0, 0, -5)
    floor.children[0].material.color = '#444444'
    this.primitives.push(floor)
    
    // Create falling boxes with different masses
    for (let i = 0; i < 3; i++) {
      const box = world.box({
        width: 1,
        height: 1,
        depth: 1,
        rigidbody: {
          type: 'dynamic',
          mass: 0.5 + i * 0.5,  // 0.5, 1.0, 1.5 kg
          linearDamping: 0.1,
          angularDamping: 0.5
        }
      })
      box.position.set(-2 + i * 2, 3 + i, -5)
      box.children[0].material.color = `hsl(${i * 120}, 100%, 50%)`
      this.primitives.push(box)
    }
    
    // Create a bouncy ball
    const ball = world.sphere({
      radius: 0.5,
      rigidbody: {
        type: 'dynamic',
        mass: 0.3,
        layer: 'prop',
        tag: 'ball'
      }
    })
    ball.position.set(0, 5, -5)
    ball.children[0].material.color = '#ff00ff'
    ball.setLinearVelocity(new Vector3(2, 0, 0))
    this.primitives.push(ball)
    
    // Create a trigger zone
    const trigger = world.box({
      width: 3,
      height: 3,
      depth: 3,
      rigidbody: {
        type: 'static',
        trigger: true,
        onTriggerEnter: (other) => {
          console.log('Something entered trigger:', other.tag)
          trigger.children[0].material.color = '#00ff00'
        },
        onTriggerLeave: (other) => {
          console.log('Something left trigger:', other.tag)
          trigger.children[0].material.color = '#ff000080'
        }
      }
    })
    trigger.position.set(5, 1.5, -5)
    trigger.children[0].material.color = '#ff000080'
    trigger.children[0].material.emissiveIntensity = 0.5
    this.primitives.push(trigger)
    
    // Create a kinematic platform
    const platform = world.box({
      width: 3,
      height: 0.5,
      depth: 2,
      rigidbody: {
        type: 'kinematic'
      }
    })
    platform.position.set(-5, 2, -5)
    platform.children[0].material.color = '#00ff00'
    this.primitives.push(platform)
    this.platform = platform
    
    console.log('Created', this.primitives.length, 'physics primitives')
  },
  
  update() {
    // Animate the kinematic platform
    if (this.platform) {
      const time = world.getTime() * 0.001
      const newPos = new Vector3(
        -5 + Math.sin(time) * 3,
        2 + Math.sin(time * 2) * 0.5,
        -5
      )
      this.platform.setKinematicTarget(newPos, this.platform.quaternion)
    }
  },
  
  destroy() {
    console.log('Cleaning up physics primitives...')
    if (this.primitives) {
      this.primitives.forEach(prim => {
        world.remove(prim)
      })
    }
  }
}