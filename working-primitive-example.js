// Working example for primitive spawning
// Make sure this is used as the script content for an app

export default {
  init() {
    // Create a box positioned above ground
    const box = world.box({ width: 1, height: 1, depth: 1 })
    box.position.set(0, 1, -3)  // y=1 to be above ground, z=-3 to be in front
    box.material.color = '#0000ff'  // Try hex color
    
    // Also try setting emissive for visibility
    if (box.material.emissive) {
      box.material.emissive = '#000044'
      box.material.emissiveIntensity = 0.2
    }
    
    console.log('Box created at:', box.position.x, box.position.y, box.position.z)
    console.log('Box material:', box.material)
    
    // Store reference for cleanup
    this.box = box
  },
  
  destroy() {
    if (this.box) {
      world.remove(this.box)
    }
  }
}