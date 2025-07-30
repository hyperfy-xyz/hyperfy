import { css } from '@firebolt-dev/css'
import { useEffect, useRef, useState } from 'react'
import { UserIcon, XIcon } from 'lucide-react'

import { usePane } from './usePane'
import { AvatarPreview } from '../AvatarPreview'

export function AvatarPane({ world, info }) {
  const viewportRef = useRef()
  const previewRef = useRef()
  const [stats, setStats] = useState(null)
  useEffect(() => {
    const viewport = viewportRef.current
    const preview = new AvatarPreview(world, viewport)
    previewRef.current = preview
    preview.load(info.file, info.url).then(stats => {
      console.log('stats', stats)
      setStats(stats)
    })
    return () => preview.destroy()
  }, [])
  return (
    <div
      className='vpane'
      css={css`
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 16rem;
        background: rgba(11, 10, 21, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 1.375rem;
        backdrop-filter: blur(5px);
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        font-size: 1rem;
        overflow: hidden;
        .vpane-head {
          height: 3.125rem;
          display: flex;
          align-items: center;
          padding: 0 0.3rem 0 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          &-title {
            font-size: 1rem;
            font-weight: 500;
            flex: 1;
          }
          &-close {
            width: 2.5rem;
            height: 2.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #5d6077;
            &:hover {
              cursor: pointer;
              color: white;
            }
          }
        }
        .vpane-content {
          flex: 1;
          position: relative;
        }
        .vpane-viewport {
          height: 17rem;
          position: relative;
        }
        .vpane-viewport-inner {
          position: absolute;
          inset: 0;
        }
        .vpane-actions {
          display: flex;
          align-items: center;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .vpane-action {
          flex: 1;
          height: 2.7rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9375rem;
          &.bl {
            border-left: 1px solid rgba(255, 255, 255, 0.1);
          }
          &:hover {
            cursor: pointer;
          }
        }
      `}
    >
      <div className='vpane-head'>
        <div className='vpane-head-title'>Avatar</div>
        <div className='vpane-head-close' onClick={() => world.emit('avatar', null)}>
          <XIcon size={20} />
        </div>
      </div>
      <div className='vpane-content'>
        <div className='vpane-viewport'>
          <div className='vpane-viewport-inner' ref={viewportRef}></div>
        </div>
        <div className='vpane-actions'>
          <div className='vpane-action' onClick={info.onEquip}>
            <span>Equip</span>
          </div>
          {info.canPlace && (
            <div className='vpane-action bl' onClick={info.onPlace}>
              <span>Place</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
