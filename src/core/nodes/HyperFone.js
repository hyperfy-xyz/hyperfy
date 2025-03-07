import { UI } from './UI'
import * as THREE from '../extras/three'

export class HyperFone extends UI {
  constructor(data = {}) {
    super({
      ...data,
      width: 800,
      height: 600,
      size: 0.0015,
      lit: true,
      doubleside: true,
      billboard: 'y',
      backgroundColor: 'rgba(0, 0, 0, 0.92)',
      borderRadius: 30,
    })

    this.name = 'hyperfone'
    this.active = false
    
    // Initialize time for animations
    this.time = 0
    this.bootTime = 0
    this.isBooting = true
    
    // Define UI colors
    this.colors = {
      primary: '#00ff9f',
      secondary: '#0ff',
      accent: '#f0f',
      background: '#1a1a2e',
      darkGlass: 'rgba(16, 16, 32, 0.7)',
    }
  }

  draw() {
    const ctx = this.canvasCtx
    const width = this.canvas.width
    const height = this.canvas.height
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Update animation time
    this.time += 0.016 // Approximately 60fps
    if (this.isBooting) {
      this.bootTime += 0.016
      if (this.bootTime > 1.5) {
        this.isBooting = false
      }
    }

    // Draw base background with gradient
    const bgGradient = ctx.createLinearGradient(0, 0, width, height)
    bgGradient.addColorStop(0, this.colors.background)
    bgGradient.addColorStop(1, '#16213e')
    ctx.fillStyle = bgGradient
    ctx.fillRect(0, 0, width, height)

    // Draw animated grid
    this.drawGrid(ctx, width, height)

    if (this.isBooting) {
      this.drawBootSequence(ctx, width, height)
    } else {
      // Draw main UI elements
      this.drawHeader(ctx, width)
      this.drawStatusBar(ctx, width, height)
      this.drawAppGrid(ctx, width, height)
    }

    // Draw holographic overlay effects
    this.drawHolographicEffects(ctx, width, height)

    this.texture.needsUpdate = true
  }

  drawGrid(ctx, width, height) {
    ctx.strokeStyle = `rgba(0, 255, 159, 0.15)`
    ctx.lineWidth = 1

    // Animate grid based on time
    const gridOffset = (this.time * 50) % 40
    const gridSize = 40

    // Vertical lines
    for (let x = -gridOffset; x < width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // Horizontal lines
    for (let y = -gridOffset; y < height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  }

  drawBootSequence(ctx, width, height) {
    const progress = this.bootTime / 1.5
    
    // Boot animation
    ctx.fillStyle = this.colors.primary
    ctx.font = 'bold 24px "Orbitron", monospace'
    ctx.textAlign = 'center'
    
    const messages = [
      'INITIALIZING HYPERFONE OS',
      'LOADING QUANTUM PROTOCOLS',
      'ESTABLISHING NEURAL LINK'
    ]
    
    const y = height * 0.4
    messages.forEach((msg, i) => {
      const messageProgress = (progress - (i * 0.2)) * 3
      if (messageProgress > 0) {
        ctx.globalAlpha = Math.min(messageProgress, 1)
        ctx.fillText(msg, width/2, y + (i * 40))
      }
    })
    
    // Loading bar
    ctx.globalAlpha = 1
    const barWidth = width * 0.6
    const barHeight = 4
    const barX = (width - barWidth) / 2
    const barY = height * 0.6
    
    // Bar background
    ctx.fillStyle = 'rgba(0, 255, 159, 0.2)'
    ctx.fillRect(barX, barY, barWidth, barHeight)
    
    // Bar progress
    ctx.fillStyle = this.colors.primary
    ctx.fillRect(barX, barY, barWidth * progress, barHeight)
  }

  drawHeader(ctx, width) {
    // Draw time
    const time = new Date().toLocaleTimeString()
    ctx.fillStyle = this.colors.primary
    ctx.font = 'bold 20px "Orbitron", monospace'
    ctx.textAlign = 'right'
    ctx.fillText(time, width - 20, 35)

    // Draw system status
    ctx.font = 'bold 16px "Orbitron", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('SYSTEM: ONLINE', 20, 35)
  }

  drawStatusBar(ctx, width, height) {
    const barHeight = 40
    const glassEffect = ctx.createLinearGradient(0, height - barHeight, 0, height)
    glassEffect.addColorStop(0, 'rgba(0, 255, 159, 0.1)')
    glassEffect.addColorStop(1, 'rgba(0, 255, 159, 0.2)')
    
    ctx.fillStyle = glassEffect
    ctx.fillRect(0, height - barHeight, width, barHeight)
  }

  drawAppGrid(ctx, width, height) {
    const apps = [
      { name: 'MESSAGES', icon: '💬' },
      { name: 'INVENTORY', icon: '🎒' },
      { name: 'MAP', icon: '🗺️' },
      { name: 'SETTINGS', icon: '⚙️' },
    ]

    const gridX = 4
    const gridY = 3
    const iconSize = 60
    const padding = 20
    const startX = (width - (gridX * (iconSize + padding))) / 2
    const startY = 150

    apps.forEach((app, i) => {
      const x = startX + (i % gridX) * (iconSize + padding)
      const y = startY + Math.floor(i / gridX) * (iconSize + padding)

      // Draw app background
      ctx.fillStyle = this.colors.darkGlass
      ctx.fillRect(x, y, iconSize, iconSize)

      // Draw app icon
      ctx.font = '30px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(app.icon, x + iconSize/2, y + iconSize/2 + 10)

      // Draw app name
      ctx.font = '12px "Orbitron", monospace'
      ctx.fillStyle = this.colors.primary
      ctx.fillText(app.name, x + iconSize/2, y + iconSize + 20)
    })
  }

  drawHolographicEffects(ctx, width, height) {
    // Add scanline effect
    const scanlineHeight = 2
    const scanlineSpacing = 4
    ctx.fillStyle = 'rgba(0, 255, 159, 0.03)'
    for (let y = 0; y < height; y += scanlineSpacing) {
      ctx.fillRect(0, y, width, scanlineHeight)
    }

    // Add subtle color aberration on edges
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = 'rgba(255, 0, 255, 0.015)'
    ctx.fillRect(2, 0, width, height)
    ctx.fillStyle = 'rgba(0, 255, 255, 0.015)'
    ctx.fillRect(-2, 0, width, height)
    ctx.globalCompositeOperation = 'source-over'
  }
} 