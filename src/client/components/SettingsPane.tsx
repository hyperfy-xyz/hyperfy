import React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Settings, Sun, User, Volume2, X } from 'lucide-react'

import { hasRole } from '../../core/utils'
import { InputDropdown, InputNumber, InputRange, InputSwitch, InputText } from './Inputs'
import { usePane } from './usePane'

export function SettingsPane({ world, player, close }) {
  const paneRef = useRef<HTMLDivElement | null>(null)
  const headRef = useRef<HTMLDivElement | null>(null)
  usePane('settings', paneRef, headRef)
  const [tab, setTab] = useState('general')
  const canBuild = useMemo(() => {
    return hasRole(player.data.roles, 'admin', 'builder')
  }, [player])
  return (
    <div
      ref={paneRef}
      className='spane'
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        width: '100%',
        maxWidth: '350px',
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
        .spane-head {
          height: 50px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          padding: 0 8px 0 20px;
        }
        .spane-head-title {
          padding-left: 7px;
          font-weight: 500;
          flex: 1;
        }
        .spane-head-tabs {
          align-self: stretch;
          display: flex;
          align-items: stretch;
        }
        .spane-head-tab {
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid transparent;
          margin-bottom: -1px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
          margin: 0 0 0 16px;
        }
        .spane-head-tab:hover:not(.active) {
          cursor: pointer;
          color: rgba(255, 255, 255, 0.7);
        }
        .spane-head-tab.active {
          color: white;
          border-bottom-color: white;
        }
        .spane-head-close {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.5);
        }
        .spane-head-close:hover {
          cursor: pointer;
          color: white;
        }
        .spane-content {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
        }
      `}</style>
      <div className='spane-head' ref={headRef}>
        <Settings size={16} />
        <div className='spane-head-title'>Settings</div>
        {/* <div className='spane-head-tabs'>
          {canBuild && (
            <>
              <div className={cls('spane-head-tab', { active: tab === 'general' })} onClick={() => setTab('general')}>
                <span>General</span>
              </div>
              <div className={cls('spane-head-tab', { active: tab === 'world' })} onClick={() => setTab('world')}>
                <span>World</span>
              </div>
            </>
          )}
        </div> */}
        <div className='spane-head-close' onClick={close}>
          <X size={20} />
        </div>
      </div>
      {tab === 'general' && <GeneralSettings world={world} player={player} />}
      {tab === 'world' && <WorldSettings world={world} />}
    </div>
  )
}

const shadowOptions = [
  { label: 'None', value: 'none' },
  { label: 'Low', value: 'low' },
  { label: 'Med', value: 'med' },
  { label: 'High', value: 'high' },
]
const onOffOptions = [
  { label: 'Off', value: false },
  { label: 'On', value: true },
]
function GeneralSettings({ world, player }) {
  const [name, setName] = useState(() => player.data.name)
  const [dpr, setDPR] = useState(world.prefs.dpr)
  const [shadows, setShadows] = useState(world.prefs.shadows)
  const [postprocessing, setPostprocessing] = useState(world.prefs.postprocessing)
  const [bloom, setBloom] = useState(world.prefs.bloom)
  const [music, setMusic] = useState(world.prefs.music)
  const [sfx, setSFX] = useState(world.prefs.sfx)
  const [voice, setVoice] = useState(world.prefs.voice)
  const dprOptions = useMemo(() => {
    const width = world.graphics.width
    const height = world.graphics.height
    const dpr = window.devicePixelRatio
    const options: { label: string; value: string }[] = []
    const add = (label: string, dpr: number) => {
      options.push({
        label: `${label} (${Math.round(width * dpr)} x ${Math.round(height * dpr)})`,
        value: dpr.toString(),
      })
    }
    add('Low', 0.5)
    add('High', 1)
    if (dpr >= 2) add('Ultra', 2)
    if (dpr >= 3) add('Insane', dpr)
    return options
  }, [])
  useEffect(() => {
    const onChange = changes => {
      // TODO: rename .dpr
      if (changes.dpr) setDPR(changes.dpr.value)
      if (changes.shadows) setShadows(changes.shadows.value)
      if (changes.postprocessing) setPostprocessing(changes.postprocessing.value)
      if (changes.bloom) setBloom(changes.bloom.value)
      if (changes.music) setMusic(changes.music.value)
      if (changes.sfx) setSFX(changes.sfx.value)
      if (changes.voice) setVoice(changes.voice.value)
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])
  return (
    <div
      className='general noscrollbar'
      style={{
        padding: '20px 20px 10px',
        maxHeight: '500px',
        overflowY: 'auto',
      }}
    >
      <style>{`
        .general-section {
          display: flex;
          align-items: center;
          margin: 30px 0 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 20px;
        }
        .general-section svg {
          margin-right: 10px;
        }
        .general-section span {
          font-weight: 500;
          font-size: 14px;
        }
        .general-section:first-child {
          margin-top: 0;
          padding-top: 0;
          border-top: 0;
        }
        .general-field {
          display: flex;
          align-items: center;
          margin: 0 0 10px;
        }
        .general-field-label {
          width: 120px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }
        .general-field-input {
          flex: 1;
        }
      `}</style>
      <div className='general-section'>
        <User size={16} />
        <span>Player</span>
      </div>
      <div className='general-field'>
        <div className='general-field-label'>Name</div>
        <div className='general-field-input'>
          <InputText
            value={name}
            onChange={name => {
              if (!name) {
                return setName(player.data.name)
              }
              player.modify({ name })
            }}
          />
        </div>
      </div>
      <div className='general-section'>
        <Sun size={16} />
        <span>Graphics</span>
      </div>
      <div className='general-field'>
        <div className='general-field-label'>Resolution</div>
        <div className='general-field-input'>
          <InputDropdown 
            options={dprOptions} 
            value={dpr.toString()} 
            onChange={dpr => world.prefs.setDPR(parseFloat(dpr))} 
          />
        </div>
      </div>
      <div className='general-field'>
        <div className='general-field-label'>Shadows</div>
        <div className='general-field-input'>
          <InputDropdown 
            options={shadowOptions} 
            value={shadows} 
            onChange={shadows => world.prefs.setShadows(shadows)} 
          />
        </div>
      </div>
      <div className='general-field'>
        <div className='general-field-label'>Postprocessing</div>
        <div className='general-field-input'>
          <InputSwitch
            value={postprocessing}
            onChange={postprocessing => world.prefs.setPostprocessing(postprocessing)}
          />
        </div>
      </div>
      {postprocessing && (
        <div className='general-field'>
          <div className='general-field-label'>Bloom</div>
          <div className='general-field-input'>
            <InputSwitch value={bloom} onChange={bloom => world.prefs.setBloom(bloom)} />
          </div>
        </div>
      )}
      <div className='general-section'>
        <Volume2 size={16} />
        <span>Audio</span>
      </div>
      <div className='general-field'>
        <div className='general-field-label'>Music</div>
        <div className='general-field-input'>
          <InputRange
            value={music * 100}
            onChange={volume => world.prefs.setMusic(volume / 100)}
            min={0}
            max={200}
            step={5}
          />
        </div>
      </div>
      <div className='general-field'>
        <div className='general-field-label'>SFX</div>
        <div className='general-field-input'>
          <InputRange 
            value={sfx * 100} 
            onChange={volume => world.prefs.setSFX(volume / 100)} 
            min={0} 
            max={200} 
            step={5} 
          />
        </div>
      </div>
      <div className='general-field'>
        <div className='general-field-label'>Voice</div>
        <div className='general-field-input'>
          <InputRange
            value={voice * 100}
            onChange={volume => world.prefs.setVoice(volume / 100)}
            min={0}
            max={200}
            step={5}
          />
        </div>
      </div>
    </div>
  )
}

function WorldSettings({ world }) {
  return <div>World settings coming soon...</div>
}
