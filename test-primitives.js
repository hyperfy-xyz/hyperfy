// Test script for primitive spawning API
// This demonstrates how to use the new primitive spawning functions

export default {
  init() {
    // Create a red box
    const box = world.box({ width: 1, height: 1, depth: 1 })
    box.position.set(0, 0.5, -2)
    box.material.color = 'red'
    
    // Create a blue sphere
    const sphere = world.sphere({ radius: 0.5 })
    sphere.position.set(2, 0.5, -2)
    sphere.material.color = 'blue'
    
    // Create a green cylinder
    const cylinder = world.cylinder({ 
      radiusTop: 0.3, 
      radiusBottom: 0.5, 
      height: 1.5,
      radialSegments: 8 
    })
    cylinder.position.set(-2, 0.75, -2)
    cylinder.material.color = 'green'
    
    // Create a yellow cone
    const cone = world.cone({ 
      radius: 0.5, 
      height: 1, 
      radialSegments: 8 
    })
    cone.position.set(0, 0.5, -4)
    cone.material.color = 'yellow'
    
    // Example using the generic spawnMesh method
    const customSphere = world.spawnMesh({ type: 'sphere', radius: 0.3 })
    customSphere.position.set(4, 0.3, -2)
    customSphere.material.color = '#ff00ff'
    
    // Store references for later manipulation
    this.primitives = { box, sphere, cylinder, cone, customSphere }
  },
  
  update() {
    // Rotate all primitives
    const time = world.getTime() * 0.001
    
    if (this.primitives) {
      this.primitives.box.rotation.y = time
      this.primitives.sphere.rotation.x = time
      this.primitives.cylinder.rotation.z = time * 0.5
      this.primitives.cone.rotation.x = time * 0.7
      this.primitives.customSphere.position.y = 0.3 + Math.sin(time * 2) * 0.1
    }
  },
  
  destroy() {
    // Clean up - remove all created primitives
    if (this.primitives) {
      Object.values(this.primitives).forEach(primitive => {
        world.remove(primitive)
      })
    }
  }
}