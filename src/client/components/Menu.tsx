import { LoaderIcon, XIcon } from 'lucide-react'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Curve } from '../../core/extras/Curve'
import { downloadFile } from '../../core/extras/downloadFile'
import { hashFile } from '../../core/utils-client'
import { CurvePane } from './CurvePane'
import { CurvePreview } from './CurvePreview'
import { ChevronLeftIcon, ChevronRightIcon } from './Icons'
import { Portal } from './Portal'
import { useUpdate } from './useUpdate'

interface MenuContextType {
  setHint: (hint: string | null) => void;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined)

export function Menu({ title, blur, children }) {
  const [hint, setHint] = useState<string | null>(null)
  return (
    <MenuContext.Provider value={{ setHint }}>
      <div
        className='menu'
        style={{
          pointerEvents: 'auto',
          opacity: blur ? 0.3 : 1,
          transition: 'opacity 0.15s ease-out',
          fontSize: '1rem',
        }}
      >
        <style>{`
          .menu-head {
            background: #0f1018;
            padding: 1rem;
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
          }
          .menu-head span {
              font-size: 1.3rem;
              font-weight: 600;
          }
          .menu-items {
            background-color: rgba(15, 16, 24, 0.8);
            overflow-y: auto;
            max-height: calc(2.5rem * 9.5);
          }
        `}</style>
        <div className='menu-head'>
          <span>{title}</span>
        </div>
        <div className='menu-items noscrollbar'>{children}</div>
        {hint && <MenuHint text={hint} />}
      </div>
    </MenuContext.Provider>
  )
}

function MenuHint({ text }) {
  return (
    <div
      className='menuhint'
      style={{
        marginTop: '0.2rem',
        padding: '0.875rem',
        fontSize: '1rem',
        lineHeight: '1.4',
        backgroundColor: 'rgba(15, 16, 24, 0.8)',
        borderTop: '0.1rem solid black',
      }}
    >
      <span>{text}</span>
    </div>
  )
}

export function MenuItemBack({ hint, onClick }) {
  const context = useContext(MenuContext)
  const setHint = context?.setHint
  return (
    <label
      className='menuback'
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '2.5rem',
        padding: '0 0.825rem',
        fontSize: '1rem',
        cursor: 'pointer',
      }}
      onPointerEnter={() => setHint?.(hint)}
      onPointerLeave={() => setHint?.(null)}
      onClick={onClick}
    >
      <style>{`
        .menuback svg {
          margin-left: -0.25rem;
        }
        .menuback:hover {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
      <ChevronLeftIcon size={'1.5rem'} />
      <div className='menuback-label' style={{ flex: 1 }}>
        <span>Back</span>
      </div>
    </label>
  )
}

export function MenuLine() {
  return (
    <div
      className='menuline'
      style={{
        height: '0.1rem',
        background: 'rgba(255, 255, 255, 0.1)',
      }}
    />
  )
}

export function MenuSection({ label }) {
  return (
    <div
      style={{
        padding: '0.25rem 0.875rem',
        fontSize: '0.75rem',
        fontWeight: '500',
        opacity: '0.3',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
      }}
    >
      <span>{label}</span>
    </div>
  )
}

export function MenuItemBtn({ label, hint, nav, onClick }) {
  const context = useContext(MenuContext)
  const setHint = context?.setHint
  return (
    <div
      className='menuitembtn'
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '2.5rem',
        padding: '0 0.875rem',
        cursor: 'pointer',
      }}
      onPointerEnter={() => setHint?.(hint)}
      onPointerLeave={() => setHint?.(null)}
      onClick={onClick}
    >
      <style>{`
        .menuitembtn:hover {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
      <div className='menuitembtn-label' style={{
        flex: 1,
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
      }}>
        {label}
      </div>
      {nav && <ChevronRightIcon size='1.5rem' />}
    </div>
  )
}

export function MenuItemText({ label, hint, placeholder, value, onChange }) {
  const context = useContext(MenuContext)
  const setHint = context?.setHint
  const [localValue, setLocalValue] = useState(value)
  useEffect(() => {
    if (localValue !== value) setLocalValue(value)
  }, [value])
  return (
    <label
      className='menuitemtext'
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '2.5rem',
        padding: '0 0.875rem',
        cursor: 'text',
      }}
      onPointerEnter={() => setHint?.(hint)}
      onPointerLeave={() => setHint?.(null)}
    >
      <style>{`
        .menuitemtext:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }
        .menuitemtext input::selection {
            background-color: white;
            color: rgba(0, 0, 0, 0.8);
          }
      `}</style>
      <div className='menuitemtext-label' style={{
        width: '9.4rem',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
      }}>
        {label}
      </div>
      <div className='menuitemtext-field' style={{ flex: 1 }}>
        <input
          type='text'
          value={localValue || ''}
          placeholder={placeholder}
          style={{
            textAlign: 'right',
            cursor: 'inherit',
          }}
          onFocus={e => e.target.select()}
          onChange={e => setLocalValue(e.target.value)}
          onKeyDown={e => {
            if (e.code === 'Enter') {
              e.preventDefault()
              onChange(localValue)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          onBlur={e => {
            onChange(localValue)
          }}
        />
      </div>
    </label>
  )
}

export function MenuItemTextarea({ label, hint, placeholder, value, onChange }) {
  const context = useContext(MenuContext)
  const setHint = context?.setHint
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [localValue, setLocalValue] = useState(value)
  useEffect(() => {
    if (localValue !== value) setLocalValue(value)
  }, [value])
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    function update() {
      if (!textarea) return
      textarea.style.height = 'auto'
      textarea.style.height = textarea.scrollHeight + 'px'
    }
    update()
    textarea.addEventListener('input', update)
    return () => {
      textarea.removeEventListener('input', update)
    }
  }, [])
  return (
    <label
      className='menuitemtext'
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        minHeight: '2.5rem',
        padding: '0 0.875rem',
        cursor: 'text',
      }}
      onPointerEnter={() => setHint?.(hint)}
      onPointerLeave={() => setHint?.(null)}
    >
      <style>{`
        .menuitemtext:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }
        .menuitemtext textarea::selection {
            background-color: white;
            color: rgba(0, 0, 0, 0.8);
          }
      `}</style>
      <div className='menuitemtext-label' style={{
        paddingTop: '0.6rem',
        width: '9.4rem',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
      }}>
        {label}
      </div>
      <div className='menuitemtext-field' style={{
        flex: 1,
        padding: '0.6rem 0 0.6rem 0',
      }}>
        <textarea
          ref={textareaRef}
          value={localValue || ''}
          placeholder={placeholder}
          style={{
            width: '100%',
            textAlign: 'right',
            height: 'auto',
            overflow: 'hidden',
            resize: 'none',
            cursor: 'inherit',
          }}
          onFocus={e => e.target.select()}
          onChange={e => setLocalValue(e.target.value)}
          onKeyDown={e => {
            if (e.metaKey && e.code === 'Enter') {
              e.preventDefault()
              onChange(localValue)
              ;(e.target as HTMLTextAreaElement).blur()
            }
          }}
          onBlur={e => {
            onChange(localValue)
          }}
        />
      </div>
    </label>
  )
}

export function MenuItemNumber({ label, hint, dp = 0, min = -Infinity, max = Infinity, step = 1, value, onChange }) {
  const context = useContext(MenuContext)
  const setHint = context?.setHint
  if (value === undefined || value === null) {
    value = 0
  }
  const [local, setLocal] = useState(value.toFixed(dp))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused && local !== value.toFixed(dp)) setLocal(value.toFixed(dp))
  }, [focused, value])
  const setTo = str => {
    // try parse math
    let num
    try {
      num = (0, eval)(str)
      if (typeof num !== 'number') {
        throw new Error('input number parse fail')
      }
    } catch (err) {
      console.error(err)
      num = value // revert back to original
    }
    if (num < min || num > max) {
      num = value
    }
    setLocal(num.toFixed(dp))
    onChange(+num.toFixed(dp))
  }
  return (
    <label
      className='menuitemnumber'
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '2.5rem',
        padding: '0 0.875rem',
        cursor: 'text',
      }}
      onPointerEnter={() => setHint?.(hint)}
      onPointerLeave={() => setHint?.(null)}
    >
      <style>{`
        .menuitemnumber:hover {
          cursor: pointer;
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
      <div className='menuitemnumber-label' style={{
        width: '9.4rem',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
      }}>
        {label}
      </div>
      <div className='menuitemnumber-field' style={{ flex: 1 }}>
        <input
          type='text'
          value={local}
          onChange={e => setLocal(e.target.value)}
          onKeyDown={e => {
            if (e.code === 'Enter') {
              ;(e.target as HTMLInputElement).blur()
            }
            if (e.code === 'ArrowUp') {
              setTo(value + step)
            }
            if (e.code === 'ArrowDown') {
              setTo(value - step)
            }
          }}
          onFocus={e => {
            setFocused(true)
            e.target.select()
          }}
          onBlur={e => {
            setFocused(false)
            // if blank, set back to original
            if (local === '') {
              setLocal(value.toFixed(dp))
              return
            }
            // otherwise run through pipeline
            setTo(local)
          }}
        />
      </div>
    </label>
  )
}

export function MenuItemRange({ label, hint, min = 0, max = 1, step = 0.05, instant, value, onChange }) {
  const context = useContext(MenuContext)
  const setHint = context?.setHint
  const trackRef = useRef<HTMLDivElement | null>(null)
  if (value === undefined || value === null) {
    value = 0
  }
  const [local, setLocal] = useState(value)
  const [sliding, setSliding] = useState(false)
  useEffect(() => {
    if (!sliding && local !== value) setLocal(value)
  }, [sliding, value])
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    function calculateValueFromPointer(e, trackElement) {
      const rect = trackElement.getBoundingClientRect()
      const position = (e.clientX - rect.left) / rect.width
      const rawValue = min + position * (max - min)
      // Round to nearest step
      const steppedValue = Math.round(rawValue / step) * step
      // Clamp between min and max
      return Math.max(min, Math.min(max, steppedValue))
    }
    let sliding
    function onPointerDown(e) {
      sliding = true
      setSliding(true)
      const newValue = calculateValueFromPointer(e, e.currentTarget)
      setLocal(newValue)
      if (instant) onChange(newValue)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    function onPointerMove(e) {
      if (!sliding) return
      const newValue = calculateValueFromPointer(e, e.currentTarget)
      setLocal(newValue)
      if (instant) onChange(newValue)
    }
    function onPointerUp(e) {
      if (!sliding) return
      sliding = false
      setSliding(false)
      const finalValue = calculateValueFromPointer(e, e.currentTarget)
      setLocal(finalValue)
      onChange(finalValue)
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    track.addEventListener('pointerdown', onPointerDown)
    track.addEventListener('pointermove', onPointerMove)
    track.addEventListener('pointerup', onPointerUp)
    return () => {
      track.removeEventListener('pointerdown', onPointerDown)
      track.removeEventListener('pointermove', onPointerMove)
      track.removeEventListener('pointerup', onPointerUp)
    }
  }, [])
  const barWidthPercentage = ((local - min) / (max - min)) * 100 + ''
  const text = useMemo(() => {
    const num = local
    const decimalDigits = (num.toString().split('.')[1] || '').length
    if (decimalDigits <= 2) {
      return num.toString()
    }
    return num.toFixed(2)
  }, [local])
  return (
    <div
      className='menuitemrange'
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '2.5rem',
        padding: '0 0.875rem',
      }}
      onPointerEnter={() => setHint?.(hint)}
      onPointerLeave={() => setHint?.(null)}
    >
      <style>{`
        .menuitemrange:hover {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
      <div className='menuitemrange-label' style={{
        flex: 1,
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        paddingRight: '1rem',
      }}>
        {label}
      </div>
      <div className='menuitemrange-text' style={{
        fontSize: '0.7rem',
        marginRight: '0.5rem',
        opacity: 0,
        transition: 'opacity 0.1s ease-out',
      }}>
        {text}
      </div>
      <div className='menuitemrange-track' ref={trackRef} style={{
        width: '5rem',
        height: '0.3rem',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '1rem',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
      }}>
        <div
          className='menuitemrange-bar'
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            background: '#039be5',
            borderRadius: '1rem',
            transition: 'width 0.1s ease-out',
            width: barWidthPercentage + '%',
          }}
        />
      </div>
    </div>
  )
}

export function MenuItemSwitch({ label, hint, options, value, onChange }) {
  options = options || []
  const context = useContext(MenuContext)
  const setHint = context?.setHint
  const idx = options.findIndex(o => o.value === value)
  const selected = options[idx]
  const prev = () => {
    let nextIdx = idx - 1
    if (nextIdx < 0) nextIdx = options.length - 1
    onChange(options[nextIdx].value)
  }
  const next = () => {
    let nextIdx = idx + 1
    if (nextIdx > options.length - 1) nextIdx = 0
    onChange(options[nextIdx].value)
  }
  return (
    <div
      className='menuitemswitch'
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '2.5rem',
        padding: '0 0.875rem',
      }}
      onPointerEnter={() => setHint?.(hint)}
      onPointerLeave={() => setHint?.(null)}
    >
      <style>{`
        .menuitemswitch:hover {
          padding: 0 0.275rem 0 0.875rem;
          background-color: rgba(255, 255, 255, 0.05);
        }
        .menuitemswitch-btn {
          width: 2.125rem;
          height: 2.125rem;
          display: none;
          align-items: center;
          justify-content: center;
          opacity: 0.2;
        }
        .menuitemswitch-btn:hover {
            cursor: pointer;
            opacity: 1;
          }
      `}</style>
      <div className='menuitemswitch-label' style={{
        flex: 1,
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        paddingRight: '1rem',
      }}>
        {label}
      </div>
      <div className='menuitemswitch-btn left' onClick={prev} style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <ChevronLeftIcon size='1.5rem' />
      </div>
      <div className='menuitemswitch-text'>{selected?.label || '???'}</div>
      <div className='menuitemswitch-btn right' onClick={next} style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <ChevronRightIcon size='1.5rem' />
      </div>
    </div>
  )
}

export function MenuItemCurve({ label, hint, x, xRange, y, yMin, yMax, value, onChange }) {
  const context = useContext(MenuContext)
  const setHint = context?.setHint
  const curve = useMemo(() => new Curve().deserialize(value || '0,0.5,0,0|1,0.5,0,0'), [value])
  const [edit, setEdit] = useState<Curve | null>(null)
  return (
    <div
      className='menuitemcurve'
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '2.5rem',
        padding: '0 0.875rem',
      }}
      onPointerEnter={() => setHint?.(hint)}
      onPointerLeave={() => setHint?.(null)}
    >
      <style>{`
        .menuitemcurve:hover {
          cursor: pointer;
          background-color: rgba(255, 255, 255, 0.05);
        }
      `}</style>
      <div
        className='menuitemcurve-control'
        onClick={() => {
          if (edit) {
            setEdit(null)
          } else {
            setEdit(curve.clone())
          }
        }}
      >
        <div className='menuitemcurve-label' style={{
          flex: 1,
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          paddingRight: '1rem',
        }}>
          {label}
        </div>
        <div className='menuitemcurve-curve'>
          <CurvePreview curve={curve} yMin={yMin} yMax={yMax} />
        </div>
      </div>
      {edit && (
        <Portal>
          <CurvePane
            curve={edit}
            xLabel={x}
            xRange={[0, 1]}
            yLabel={y}
            yMin={yMin}
            yMax={yMax}
            onCommit={() => {
              onChange(edit.serialize())
              setEdit(null)
            }}
            onCancel={() => {
              setEdit(null)
            }}
          />
        </Portal>
      )}
    </div>
  )
}

// todo: blueprint models need migrating to file object format so
// we can replace needing this and instead use MenuItemFile, but
// that will also somehow need to support both model and avatar kinds.
export function MenuItemFileBtn({ label, hint, accept, value, onChange }) {
  const context = useContext(MenuContext)
  const setHint = context?.setHint
  const [key, setKey] = useState(0)
  const handleDownload = e => {
    if (e.shiftKey) {
      e.preventDefault()
      const file = world.loader?.getFile?.(value)
      if (!file) return
      downloadFile(file)
    }
  }
  const handleChange = e => {
    setKey(n => n + 1)
    onChange(e.target.files[0])
  }
  return (
    <label
      className='menuitemfilebtn'
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '2.5rem',
        padding: '0 0.875rem',
        overflow: 'hidden',
      }}
      onPointerEnter={() => setHint?.(hint)}
      onPointerLeave={() => setHint?.(null)}
      onClick={handleDownload}
    >
      <style>{`
        .menuitemfilebtn:hover {
          cursor: pointer;
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
      <div className='menuitemfilebtn-label' style={{
        width: '9.4rem',
        flexShrink: 0,
      }}>
        {label}
      </div>
      <input key={key} type='file' accept={accept} onChange={handleChange} style={{
        position: 'absolute',
        top: '-9999px',
      }} />
    </label>
  )
}

export const fileKinds = {
  avatar: {
    type: 'avatar',
    accept: '.vrm',
    exts: ['vrm'],
    placeholder: 'vrm',
  },
  emote: {
    type: 'emote',
    accept: '.glb',
    exts: ['glb'],
    placeholder: 'glb',
  },
  model: {
    type: 'model',
    accept: '.glb',
    exts: ['glb'],
    placeholder: 'glb',
  },
  texture: {
    type: 'texture',
    accept: '.jpg,.jpeg,.png,.webp',
    exts: ['jpg', 'jpeg', 'png', 'webp'],
    placeholder: 'jpg,png,webp',
  },
  image: {
    type: 'image',
    accept: '.jpg,.jpeg,.png,.webp',
    exts: ['jpg', 'jpeg', 'png', 'webp'],
    placeholder: 'jpg,png,webp',
  },
  video: {
    type: 'video',
    accept: '.mp4',
    exts: ['mp4'],
    placeholder: 'mp4',
  },
  hdr: {
    type: 'hdr',
    accept: '.hdr',
    exts: ['hdr'],
    placeholder: 'hdr',
  },
  audio: {
    type: 'audio',
    accept: '.mp3',
    exts: ['mp3'],
    placeholder: 'mp3',
  },
}

export function MenuItemFile({ world, label, hint, kind: kindName, value, onChange }) {
  const context = useContext(MenuContext)
  const setHint = context?.setHint
  const nRef = useRef(0)
  const update = useUpdate()
  const [loading, setLoading] = useState<any>(null)
  const kind = fileKinds[kindName]
  if (!kind) return null // invalid?
  const set = async e => {
    // trigger input rebuild
    const n = ++nRef.current
    update()
    // get file
    const file = e.target.files[0]
    if (!file) return
    // check ext
    const ext = file.name.split('.').pop().toLowerCase()
    if (!kind.exts.includes(ext)) {
      return console.error(`attempted invalid file extension for ${kindName}: ${ext}`)
    }
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as glb filename
    const filename = `${hash}.${ext}`
    // canonical url to this file
    const url = `asset://${filename}`
    // show loading
    const newValue = {
      type: kind.type,
      name: file.name,
      url,
    }
    setLoading(newValue)
    // upload file
    await world.network?.upload(file)
    // ignore if new value/upload
    if (nRef.current !== n) return
    // cache file locally so this client can insta-load it
    world.loader?.insert(kind.type, url, file)
    // apply!
    setLoading(null)
    onChange(newValue)
  }
  const remove = e => {
    e.preventDefault()
    e.stopPropagation()
    onChange(null)
  }
  const handleDownload = e => {
    if (e.shiftKey && value?.url) {
      e.preventDefault()
      const file = world.loader?.getFile?.(value.url, value.name)
      if (!file) return
      downloadFile(file)
    }
  }
  const n = nRef.current
  const name = loading?.name || value?.name
  return (
    <label
      className='menuitemfile'
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '2.5rem',
        padding: '0 0.875rem',
        overflow: 'hidden',
      }}
      onPointerEnter={() => setHint?.(hint)}
      onPointerLeave={() => setHint?.(null)}
      onClick={handleDownload}
    >
      <style>{`
        .menuitemfile:hover {
          cursor: pointer;
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
      <div className='menuitemfile-label' style={{
        flex: 1,
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        paddingRight: '1rem',
      }}>
        {label}
      </div>
      {!value && !loading && <div className='menuitemfile-placeholder' style={{
        color: 'rgba(255, 255, 255, 0.3)',
      }}>
        {kind.placeholder}
      </div>}
      {name && <div className='menuitemfile-name' style={{
        textAlign: 'right',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        maxWidth: '9rem',
      }}>
        {name}
      </div>}
      {value && !loading && (
        <div className='menuitemfile-x' style={{
          lineHeight: 0,
          margin: '0 -0.2rem 0 0.3rem',
          color: 'rgba(255, 255, 255, 0.3)',
        }} onClick={remove}>
          <XIcon size='1rem' />
        </div>
      )}
      {loading && (
        <div className='menuitemfile-loading' style={{
          margin: '0 -0.1rem 0 0.3rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <LoaderIcon size='1rem' />
        </div>
      )}
      <input key={n} type='file' onChange={set} accept={kind.accept} style={{
        position: 'absolute',
        top: '-9999px',
        left: '-9999px',
        opacity: 0,
      }} />
    </label>
  )
}

export function MenuItemToggle({ label, hint, trueLabel = 'Yes', falseLabel = 'No', value, onChange }) {
  const context = useContext(MenuContext)
  const setHint = context?.setHint
  return (
    <div
      className='menuitemtoggle'
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '2.5rem',
        padding: '0 0.875rem',
      }}
      onPointerEnter={() => setHint?.(hint)}
      onPointerLeave={() => setHint?.(null)}
      onClick={() => onChange(!value)}
    >
      <style>{`
        .menuitemtoggle:hover {
          cursor: pointer;
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
      <div className='menuitemtoggle-label' style={{
        flex: 1,
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        paddingRight: '1rem',
      }}>
        {label}
      </div>
      <div className='menuitemtoggle-text'>{value ? trueLabel : falseLabel}</div>
    </div>
  )
}
