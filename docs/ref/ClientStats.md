# ClientStats

The ClientStats system in Hyperfy provides real-time performance monitoring, displaying FPS, CPU, and GPU statistics. It runs on the client and uses StatsGL for detailed performance metrics.

### Properties

### `stats.active`: Boolean

Whether the stats display is currently active.

### `stats.stats`: StatsGL

The StatsGL instance with the following configuration:
```typescript
{
  logsPerSecond: 20,        // Update frequency
  samplesLog: 100,          // Log sample count
  samplesGraph: 10,         // Graph sample count
  precision: 2,             // Decimal precision
  horizontal: true,         // Layout orientation
  minimal: false,           // Display mode
  mode: 0                   // Initial mode
}
```

### Methods

### `stats.enable(): void`

Enables and displays the stats panel.

### `stats.disable(): void`

Disables and hides the stats panel.

### `stats.toggle(): void`

Toggles the stats panel visibility.

### Performance Metrics

The system provides real-time monitoring of:

1. **FPS (Frames Per Second)**
   - Current frame rate
   - Frame time
   - Frame time history

2. **CPU Performance**
   - JavaScript execution time
   - Main thread utilization
   - Task timing

3. **GPU Performance**
   - Draw calls
   - Triangle count
   - Memory usage

### Notes

- Updates 20 times per second
- Maintains 100 log samples
- Shows 10 graph samples
- Uses horizontal layout
- Supports multiple display modes
- Automatically tracks renderer stats

### Usage

The ClientStats system is used to:

1. Monitor performance metrics
2. Debug rendering issues
3. Track resource usage
4. Profile frame timing
5. Optimize applications

### Example

```javascript
export default function(world, app, fetch) {
  return {
    start() {
      // Create performance monitor UI
      this.createStatsUI()
      
      // Listen for toggle key
      world.on('keydown', this.handleKeyPress)
    },
    
    createStatsUI() {
      // Create stats toggle button
      const button = app.create('Action')
      button.label = 'Toggle Stats'
      button.onTrigger = () => {
        world.stats.toggle()
      }
      
      // Create stats container
      const container = app.create('UI')
      container.add(button)
      
      // Add performance thresholds
      this.addPerformanceThresholds(container)
      
      app.add(container)
    },
    
    handleKeyPress(event) {
      // Toggle stats with F3 key
      if (event.code === 'F3') {
        world.stats.toggle()
      }
    },
    
    addPerformanceThresholds(container) {
      // Create warning indicators
      const warnings = app.create('UI')
      
      // FPS warning
      this.fpsWarning = app.create('UIText')
      this.fpsWarning.visible = false
      warnings.add(this.fpsWarning)
      
      // Draw call warning
      this.drawCallWarning = app.create('UIText')
      this.drawCallWarning.visible = false
      warnings.add(this.drawCallWarning)
      
      container.add(warnings)
      
      // Start monitoring
      this.startPerformanceMonitoring()
    },
    
    startPerformanceMonitoring() {
      // Enable stats
      world.stats.enable()
      
      // Monitor performance
      this.monitoringInterval = setInterval(() => {
        this.checkPerformance()
      }, 1000)
    },
    
    checkPerformance() {
      // Get current stats
      const stats = world.stats.stats
      
      // Check FPS
      const fps = stats.getFPS()
      this.fpsWarning.visible = fps < 30
      if (fps < 30) {
        this.fpsWarning.text = `Low FPS: ${fps.toFixed(1)}`
      }
      
      // Check draw calls
      const drawCalls = stats.getDrawCalls()
      this.drawCallWarning.visible = drawCalls > 1000
      if (drawCalls > 1000) {
        this.drawCallWarning.text = `High Draw Calls: ${drawCalls}`
      }
      
      // Log detailed stats periodically
      this.logDetailedStats()
    },
    
    logDetailedStats() {
      const stats = world.stats.stats
      
      console.log('Performance Report:', {
        fps: stats.getFPS(),
        frameTime: stats.getFrameTime(),
        drawCalls: stats.getDrawCalls(),
        triangles: stats.getTriangles(),
        textures: stats.getTextures(),
        programs: stats.getPrograms()
      })
    },
    
    // Example of performance optimization
    optimizePerformance() {
      const stats = world.stats.stats
      
      // Check if optimization needed
      if (stats.getFPS() < 30) {
        // Reduce draw calls
        this.batchGeometry()
        
        // Reduce triangle count
        this.simplifyGeometry()
        
        // Optimize textures
        this.optimizeTextures()
      }
    },
    
    batchGeometry() {
      // Find meshes that can be combined
      const meshes = []
      app.traverse(node => {
        if (node.isMesh && node.material.map === this.targetTexture) {
          meshes.push(node)
        }
      })
      
      // Merge geometries
      if (meshes.length > 1) {
        const merged = app.create('Mesh')
        merged.geometry = this.mergeGeometries(meshes)
        merged.material = meshes[0].material
        
        // Replace original meshes
        meshes.forEach(mesh => mesh.destroy())
        app.add(merged)
      }
    },
    
    simplifyGeometry() {
      app.traverse(node => {
        if (node.isMesh && node.geometry.attributes.position.count > 10000) {
          // Simplify high-poly meshes
          node.geometry = this.simplify(node.geometry, 0.5)
        }
      })
    },
    
    optimizeTextures() {
      app.traverse(node => {
        if (node.isMesh && node.material.map) {
          // Reduce texture size
          node.material.map.setSize(
            node.material.map.width / 2,
            node.material.map.height / 2
          )
        }
      })
    },
    
    destroy() {
      // Disable stats
      world.stats.disable()
      
      // Clean up monitoring
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval)
      }
      
      // Remove event listeners
      world.off('keydown', this.handleKeyPress)
    }
  }
}
```

This example demonstrates:
- Creating stats UI
- Monitoring performance
- Setting up thresholds
- Logging detailed stats
- Implementing optimizations
- Handling cleanup

Remember that the stats display can impact performance itself, so use it primarily during development and debugging.
