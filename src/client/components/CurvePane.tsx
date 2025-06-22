import React from 'react'
import { css } from '@firebolt-dev/css'
import { useEffect, useRef } from 'react'
import { cls } from '../utils'
import { curveManager } from '../../core/extras/curveManager'
import { Curve } from '../../core/extras/Curve'

interface CurvePaneProps {
  curve: Curve;
  title: string;
  xLabel: string;
  yLabel: string;
  yMin: number;
  yMax: number;
  onCommit: (curve: Curve) => void;
  onCancel: () => void;
}

export function CurvePane({ curve, title, xLabel, yLabel, yMin, yMax, onCommit, onCancel }: CurvePaneProps) {
  const paneRef = useRef<HTMLDivElement | null>(null)
  const headRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const width = container.offsetWidth
    const height = container.offsetHeight
    const manager = curveManager({
      curve,
      xLabel,
      yLabel,
      yMin,
      yMax,
      width,
      height,
    })
    if (manager.elem) {
      container.appendChild(manager.elem)
    }
    return () => {
      manager.elem?.remove()
    }
  }, [])
  return (
    <div
      ref={paneRef}
      className='curvepane'
      css={css`
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 70%;
        height: 70%;
        background: rgba(0, 0, 0, 0.9);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 0.5rem;
        display: flex;
        flex-direction: column;
        pointer-events: auto;
        .curvepane-head {
          padding: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
        }
        .curvepane-title {
          flex: 1;
          font-size: 1.25rem;
          font-weight: 600;
        }
        .curvepane-btns {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .curvepane-container {
          flex: 1;
          position: relative;
        }
      `}
    >
      <div className='curvepane-head' ref={headRef}>
        <div className='curvepane-title'>{title}</div>
        <div className='curvepane-btns'>
          <button
            className={cls('btn')}
            onClick={() => {
              onCommit(curve)
            }}
          >
            Apply
          </button>
          <button className={cls('btn', 'outline')} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
      <div className='curvepane-body'>
        <div className='curvepane-container' ref={containerRef} />
      </div>
    </div>
  )
}
