import { useEffect, useRef } from 'react'
import { css } from '@firebolt-dev/css'

import { curveManager } from '../../core/extras/curveManager'
import { usePane } from './usePane'

export function CurvePane({ curve, title, xLabel, yLabel, yMin, yMax, onCommit, onCancel }) {
  const paneRef = useRef()
  const headRef = useRef()
  const containerRef = useRef()
  usePane('curve', paneRef, headRef)
  useEffect(() => {
    const container = containerRef.current
    const width = container.offsetWidth
    const height = container.offsetHeight
    const manager = curveManager({
      curve,
      width,
      height,
      xLabel,
      yLabel,
      yMin,
      yMax,
    })
    container.appendChild(manager.elem)
    return () => {
      // todo: destroy?
    }
  }, [curve])
  return (
    <div
      ref={paneRef}
      className='curvepane'
      css={css`
        position: absolute;
        top: 20px;
        left: 20px;
        width: 25rem;
        background-color: rgba(15, 16, 24, 0.8);
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        font-size: 1rem;
        .curvepane-head {
          height: 3.125rem;
          background: black;
          display: flex;
          align-items: center;
          padding: 0 0.4375rem 0 1.25rem;
          &-title {
            font-size: 1.2rem;
            font-weight: 500;
            flex: 1;
          }
          &-close {
            width: 2.5rem;
            height: 2.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.5);
            &:hover {
              cursor: pointer;
              color: white;
            }
          }
        }
        .curvepane-chart {
          width: 25rem;
          height: 25rem;
          position: relative;
        }
        .curvepane-container {
          position: absolute;
          inset: 1.25rem 1.25rem 1.25rem 2.175rem; // axis margin
        }
        .curvepane-btns {
          padding: 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .curvepane-btn {
          border: 1px solid rgba(255, 255, 255, 0.1);
          flex-basis: 50%;
          height: 38px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}
    >
      <div className='curvepane-head' ref={headRef}>
        <div className='curvepane-head-title'>{title}</div>
        {/* <div className='curvepane-head-close' onClick={() => world.emit('avatar', null)}>
          <XIcon size={20} />
        </div> */}
      </div>
      <div className='curvepane-chart'>
        <div className='curvepane-container' ref={containerRef} />
      </div>
      <div className='curvepane-btns'>
        <div className='curvepane-btn' onClick={onCommit}>
          <span>Apply</span>
        </div>
        <div className='curvepane-btn' onClick={onCancel}>
          <span>Cancel</span>
        </div>
      </div>
    </div>
  )
}
