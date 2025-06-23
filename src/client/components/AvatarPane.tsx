import { XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { AvatarPreview } from '../AvatarPreview'

interface AvatarPaneProps {
  world: any
  info: {
    file: File
    url: string
    onEquip: () => void
    onPlace: () => void
  }
}

export function AvatarPane({ world, info }: AvatarPaneProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const previewRef = useRef<AvatarPreview | null>(null)
  const [_stats, setStats] = useState<any>(null)
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const preview = new AvatarPreview(world, viewport)
    previewRef.current = preview
    preview.load(info.file, info.url).then(stats => {
      console.log('stats', stats)
      setStats(stats)
    })
    return () => preview.destroy()
  }, [world, info.file, info.url])
  return (
    <div
      className='vpane'
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '16rem',
        height: '24rem',
        background: 'rgba(11, 10, 21, 0.85)',
        border: '0.0625rem solid #2a2b39',
        backdropFilter: 'blur(5px)',
        borderRadius: '1rem',
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        fontSize: '1rem',
        overflow: 'hidden',
      }}
    >
      <style>{`
        .vpane-head {
          height: 3.125rem;
          display: flex;
          align-items: center;
          padding: 0 0.3rem 0 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }
        .vpane-head-title {
          font-size: 1rem;
          font-weight: 500;
          flex: 1;
        }
        .vpane-head-close {
          width: 2.5rem;
          height: 2.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #5d6077;
        }
        .vpane-head-close:hover {
          cursor: pointer;
          color: white;
        }
        .vpane-content {
          flex: 1;
          position: relative;
        }
        .vpane-viewport {
          position: absolute;
          inset: 0;
        }
        .vpane-actions {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 1rem;
        }
        .vpane-action {
          flex-basis: 50%;
          height: 2.5rem;
          background: rgba(11, 10, 21, 0.85);
          border: 0.0625rem solid #2a2b39;
          border-radius: 0.5rem;
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9375rem;
        }
        .vpane-action:hover {
          cursor: pointer;
        }
      `}</style>
      <div className='vpane-head'>
        <div className='vpane-head-title'>Avatar</div>
        <div className='vpane-head-close' onClick={() => world.emit('avatar', null)}>
          <XIcon size={20} />
        </div>
      </div>
      <div className='vpane-content'>
        <div className='vpane-viewport' ref={viewportRef}>
          <div className='vpane-actions'>
            <div className='vpane-action' onClick={info.onEquip}>
              <span>Equip</span>
            </div>
            <div className='vpane-action' onClick={info.onPlace}>
              <span>Place</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
