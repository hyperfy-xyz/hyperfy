import React from 'react'
import { useEffect, useRef } from 'react'
import { Curve } from '../../core/extras/Curve'
import { usePane } from './usePane'
// import { X } from 'lucide-react'

interface CurvePaneProps {
  curve: Curve;
  xLabel: string;
  xRange?: [number, number];
  yLabel: string;
  yMin: number;
  yMax: number;
  onCommit: () => void;
  onCancel: () => void;
}

export function CurvePane({ curve, xLabel, xRange, yLabel, yMin, yMax, onCommit, onCancel }: CurvePaneProps) {
  const paneRef = useRef<HTMLDivElement | null>(null)
  const headRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const editorRef = useRef<{ curve: Curve; canvas: HTMLCanvasElement } | null>(null)

  usePane('curve', paneRef, headRef)

  useEffect(() => {
    if (!canvasRef.current) return

    // Initialize curve editor
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // Create editor
    const editor = {
      curve,
      canvas,
    }
    editorRef.current = editor

    // Render curve
    renderCurve(ctx, curve, rect.width, rect.height, xRange, yMin, yMax)

    return () => {
      editorRef.current = null
    }
  }, [curve, xRange, yMin, yMax])

  const renderCurve = (ctx: CanvasRenderingContext2D, curve: Curve, width: number, height: number, xRange: [number, number] | undefined, yMin: number, yMax: number) => {
    ctx.clearRect(0, 0, width, height)
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1

    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * width
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()

      const y = (i / 10) * height
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

      const range = xRange || [0, 1]
      for (let x = 0; x < width; x++) {
        const t = (x / width) * (range[1] - range[0]) + range[0]
        const y = curve.evaluate(t)
        const normalizedY = 1 - ((y - yMin) / (yMax - yMin))
        const pixelY = normalizedY * height
        
        if (x === 0) {
          ctx.moveTo(x, pixelY)
        } else {
          ctx.lineTo(x, pixelY)
        }
      }
      ctx.stroke()
    }
  }

  return (
    <div
      ref={paneRef}
      className='curvepane'
      style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '500px',
        height: '400px',
        background: 'rgba(22, 22, 28, 1)',
        border: '1px solid rgba(255, 255, 255, 0.03)',
        borderRadius: '10px',
        boxShadow: 'rgba(0, 0, 0, 0.5) 0px 10px 30px',
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        .curvepane-head {
          height: 50px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          padding: 0 20px;
        }
        .curvepane-head-title {
          flex: 1;
          font-weight: 500;
        }
        .curvepane-head-close {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.5);
        }
        .curvepane-head-close:hover {
          cursor: pointer;
          color: white;
        }
        .curvepane-content {
          flex: 1;
          padding: 20px;
          display: flex;
          flex-direction: column;
        }
        .curvepane-canvas {
          width: 100%;
          flex: 1;
          background: #1a1a1a;
          border-radius: 5px;
          cursor: crosshair;
        }
        .curvepane-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }
        .curvepane-footer {
          padding: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .curvepane-btn {
          padding: 8px 16px;
          border-radius: 5px;
          border: none;
          font-size: 14px;
          cursor: pointer;
        }
        .curvepane-btn-cancel {
          background: #333;
          color: white;
        }
        .curvepane-btn-commit {
          background: #00a7ff;
          color: white;
        }
      `}</style>
      <div className='curvepane-head' ref={headRef}>
        <div className='curvepane-head-title'>Curve Editor</div>
        <div className='curvepane-head-close' onClick={onCancel}>
          ×
        </div>
      </div>
      <div className='curvepane-content'>
        <canvas ref={canvasRef} className='curvepane-canvas' />
        <div className='curvepane-labels'>
          <span>{xLabel} ({xRange ? `${xRange[0]} - ${xRange[1]}` : '0 - 1'})</span>
          <span>{yLabel} ({yMin} - {yMax})</span>
        </div>
      </div>
      <div className='curvepane-footer'>
        <button className='curvepane-btn curvepane-btn-cancel' onClick={onCancel}>
          Cancel
        </button>
        <button className='curvepane-btn curvepane-btn-commit' onClick={onCommit}>
          Apply
        </button>
      </div>
    </div>
  )
}

