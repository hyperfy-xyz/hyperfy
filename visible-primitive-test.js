// Test script with better visibility settings

export default {
  init() {
    console.log('Creating primitives...')
    
    // Create multiple primitives with different colors and positions
    const primitives = []
    
    // Red box
    const box = world.box({ width: 1, height: 1, depth: 1 })
    box.position.set(-3, 1, -5)
    box.material.color = '#ff0000'
    primitives.push(box)
    console.log('Created red box at', box.position.toArray())
    
    // Blue sphere
    const sphere = world.sphere({ radius: 0.5 })
    sphere.position.set(-1, 1, -5)
    sphere.material.color = '#0000ff'
    primitives.push(sphere)
    console.log('Created blue sphere at', sphere.position.toArray())
    
    // Green cylinder
    const cylinder = world.cylinder({ 
      radiusTop: 0.3, 
      radiusBottom: 0.5, 
      height: 1.5 
    })
    cylinder.position.set(1, 1, -5)
    cylinder.material.color = '#00ff00'
    primitives.push(cylinder)
    console.log('Created green cylinder at', cylinder.position.toArray())
    
    // Yellow cone
    const cone = world.cone({ 
      radius: 0.5, 
      height: 1 
    })
    cone.position.set(3, 1, -5)
    cone.material.color = '#ffff00'
    primitives.push(cone)
    console.log('Created yellow cone at', cone.position.toArray())
    
    // Store references
    this.primitives = primitives
    
    // Debug info
    console.log('All primitives created. Total:', primitives.length)
    
    // Try to make materials more visible with emissive
    primitives.forEach((prim, i) => {
      if (prim.material.emissiveIntensity !== undefined) {
        prim.material.emissiveIntensity = 0.3
      }
      console.log(`Primitive ${i} material properties:`, {
        color: prim.material.color,
        emissiveIntensity: prim.material.emissiveIntensity
      })
    })
  },
  
  update() {
    // Slowly rotate primitives to confirm they exist
    if (this.primitives) {
      const time = world.getTime() * 0.001
      this.primitives.forEach((prim, i) => {
        prim.rotation.y = time + (i * Math.PI / 2)
      })
    }
  },
  
  destroy() {
    console.log('Cleaning up primitives...')
    if (this.primitives) {
      this.primitives.forEach(prim => {
        world.remove(prim)
      })
    }
  }
}