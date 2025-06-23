import React from 'react'
import { useEffect, useRef } from 'react'
import { Curve } from '../../core/extras/Curve'

interface CurvePreviewProps {
  curve: Curve;
  width?: number;
  height?: number;
  xRange?: [number, number];
  yMin?: number;
  yMax?: number;
}

export function CurvePreview({ curve, width = 200, height = 100, xRange = [0, 1], yMin = 0, yMax = 1 }: CurvePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const divRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match display size
    canvas.width = width * window.devicePixelRatio
    canvas.height = height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw background
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, width, height)

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1

    // Vertical grid lines
    for (let i = 0; i <= 4; i++) {
      const x = (i / 4) * width
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Draw curve
    if (curve) {
      ctx.strokeStyle = '#00a7ff'
      ctx.lineWidth = 2
      ctx.beginPath()

      let first = true
      for (let x = 0; x < width; x++) {
        const t = (x / width) * (xRange[1] - xRange[0]) + xRange[0]
        const y = curve.evaluate(t)
        
        // Normalize y value to canvas coordinates
        const normalizedY = 1 - ((y - yMin) / (yMax - yMin))
        const pixelY = Math.max(0, Math.min(height, normalizedY * height))
        
        if (first) {
          ctx.moveTo(x, pixelY)
          first = false
        } else {
          ctx.lineTo(x, pixelY)
      }
      }
      ctx.stroke()
    }
  }, [curve, width, height, xRange, yMin, yMax])

  return (
    <div
      ref={divRef}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
          display: 'block',
      }}
    />
    </div>
  )
}
