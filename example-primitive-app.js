// Example app script that uses primitive spawning
// This should be used as the script content for an app, not as the model URL

export default {
  init() {
    // Create primitives when the app initializes
    this.primitives = []
    
    // Create a red box
    const box = world.box({ width: 1, height: 1, depth: 1 })
    box.position.set(0, 0.5, 0)
    box.material.color = 'red'
    this.primitives.push(box)
    
    // Create a blue sphere
    const sphere = world.sphere({ radius: 0.5 })
    sphere.position.set(2, 0.5, 0)
    sphere.material.color = 'blue'
    this.primitives.push(sphere)
    
    // Create a green cylinder
    const cylinder = world.cylinder({ 
      radiusTop: 0.3, 
      radiusBottom: 0.5, 
      height: 1.5,
      radialSegments: 8 
    })
    cylinder.position.set(-2, 0.75, 0)
    cylinder.material.color = 'green'
    this.primitives.push(cylinder)
  },
  
  update() {
    // Rotate primitives
    const time = world.getTime() * 0.001
    this.primitives.forEach((primitive, i) => {
      primitive.rotation.y = time + i
    })
  },
  
  destroy() {
    // Clean up primitives when app is destroyed
    this.primitives.forEach(primitive => {
      world.remove(primitive)
    })
  }
}