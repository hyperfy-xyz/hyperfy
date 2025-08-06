import { css } from '@firebolt-dev/css'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { HintContext } from './Hint'
import { ChevronLeftIcon, ChevronRightIcon } from './Icons'
import { useUpdate } from './useUpdate'
import { hashFile } from '../../core/utils-client'
import { LoaderIcon, XIcon } from 'lucide-react'
import { Curve } from '../../core/extras/Curve'
import { CurvePreview } from './CurvePreview'
import { Portal } from './Portal'
import { CurvePane } from './CurvePane'
import { isArray } from 'lodash-es'
import { downloadFile } from '../../core/extras/downloadFile'
import { HexColorPicker } from 'react-colorful'

export function FieldText({ label, hint, placeholder, value, onChange }) {
  const { setHint } = useContext(HintContext)
  const [localValue, setLocalValue] = useState(value)
  useEffect(() => {
    if (localValue !== value) setLocalValue(value)
  }, [value])
  return (
    <label
      className='fieldtext'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1rem;
        cursor: text;
        .fieldtext-label {
          width: 9.4rem;
          flex-shrink: 0;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          font-size: 0.9375rem;
          color: rgba(255, 255, 255, 0.6);
        }
        .fieldtext-field {
          flex: 1;
        }
        input {
          font-size: 0.9375rem;
          text-align: right;
          cursor: inherit;
          &::selection {
            background-color: white;
            color: rgba(0, 0, 0, 0.8);
          }
        }
        &:hover {
          background-color: rgba(255, 255, 255, 0.03);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
    >
      <div className='fieldtext-label'>{label}</div>
      <div className='fieldtext-field'>
        <input
          type='text'
          value={localValue || ''}
          placeholder={placeholder}
          onFocus={e => e.target.select()}
          onChange={e => setLocalValue(e.target.value)}
          onKeyDown={e => {
            if (e.code === 'Enter') {
              e.preventDefault()
              onChange(localValue)
              e.target.blur()
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

export function FieldTextarea({ label, hint, placeholder, value, onChange }) {
  const { setHint } = useContext(HintContext)
  const textareaRef = useRef()
  const [localValue, setLocalValue] = useState(value)
  useEffect(() => {
    if (localValue !== value) setLocalValue(value)
  }, [value])
  useEffect(() => {
    const textarea = textareaRef.current
    function update() {
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
      className='fieldtextarea'
      css={css`
        display: flex;
        align-items: flex-start;
        min-height: 2.5rem;
        padding: 0 1rem;
        cursor: text;
        .fieldtextarea-label {
          padding-top: 0.6rem;
          width: 9.4rem;
          flex-shrink: 0;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          font-size: 0.9375rem;
          color: rgba(255, 255, 255, 0.6);
        }
        .fieldtextarea-field {
          flex: 1;
          padding: 0.6rem 0 0.6rem 0;
        }
        textarea {
          font-size: 0.9375rem;
          width: 100%;
          height: 1rem;
          text-align: right;
          height: auto;
          overflow: hidden;
          resize: none;
          cursor: inherit;
          &::selection {
            background-color: white;
            color: rgba(0, 0, 0, 0.8);
          }
        }
        &:hover {
          background-color: rgba(255, 255, 255, 0.03);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
    >
      <div className='fieldtextarea-label'>{label}</div>
      <div className='fieldtextarea-field'>
        <textarea
          ref={textareaRef}
          value={localValue || ''}
          placeholder={placeholder}
          onFocus={e => e.target.select()}
          onChange={e => setLocalValue(e.target.value)}
          onKeyDown={e => {
            if (e.metaKey && e.code === 'Enter') {
              e.preventDefault()
              onChange(localValue)
              e.target.blur()
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

export function FieldSwitch({ label, hint, options, value, onChange }) {
  options = options || []
  const { setHint } = useContext(HintContext)
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
      className='fieldswitch'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1rem;
        .fieldswitch-label {
          flex: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          padding-right: 1rem;
          font-size: 0.9375rem;
          color: rgba(255, 255, 255, 0.6);
        }
        .fieldswitch-btn {
          width: 2.125rem;
          height: 2.125rem;
          display: none;
          align-items: center;
          justify-content: center;
          opacity: 0.2;
          &:hover {
            cursor: pointer;
            opacity: 1;
          }
        }
        .fieldswitch-text {
          font-size: 0.9375rem;
          line-height: 1;
        }
        &:hover {
          padding: 0 0.275rem 0 1rem;
          background-color: rgba(255, 255, 255, 0.03);
          .fieldswitch-btn {
            display: flex;
          }
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
    >
      <div className='fieldswitch-label'>{label}</div>
      <div className='fieldswitch-btn left' onClick={prev}>
        <ChevronLeftIcon size='1.5rem' />
      </div>
      <div className='fieldswitch-text'>{selected?.label || '???'}</div>
      <div className='fieldswitch-btn right' onClick={next}>
        <ChevronRightIcon size='1.5rem' />
      </div>
    </div>
  )
}

export function FieldToggle({ label, hint, trueLabel = 'Yes', falseLabel = 'No', value, onChange }) {
  const { setHint } = useContext(HintContext)
  return (
    <div
      className='fieldtoggle'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1rem;
        .fieldtoggle-label {
          flex: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          padding-right: 1rem;
          font-size: 0.9375rem;
          color: rgba(255, 255, 255, 0.6);
        }
        .fieldtoggle-text {
          font-size: 0.9375rem;
        }
        &:hover {
          cursor: pointer;
          background: rgba(255, 255, 255, 0.03);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
      onClick={() => onChange(!value)}
    >
      <div className='fieldtoggle-label'>{label}</div>
      <div className='fieldtoggle-text'>{value ? trueLabel : falseLabel}</div>
    </div>
  )
}

export function FieldRange({ label, hint, min = 0, max = 1, step = 0.05, instant, value, onChange }) {
  const { setHint } = useContext(HintContext)
  const trackRef = useRef()
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
      className='fieldrange'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1rem;
        .fieldrange-label {
          flex: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          font-size: 0.9375rem;
          color: rgba(255, 255, 255, 0.6);
          padding-right: 1rem;
        }
        .fieldrange-text {
          font-size: 0.7rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
          margin-right: 0.5rem;
          opacity: 0;
        }
        .fieldrange-track {
          width: 7rem;
          flex-shrink: 0;
          height: 0.5rem;
          border-radius: 0.1rem;
          display: flex;
          align-items: stretch;
          background-color: rgba(255, 255, 255, 0.1);
          &:hover {
            cursor: pointer;
          }
        }
        .fieldrange-bar {
          background-color: white;
          border-radius: 0.1rem;
          width: ${barWidthPercentage}%;
        }
        &:hover {
          background-color: rgba(255, 255, 255, 0.03);
          .fieldrange-text {
            opacity: 1;
          }
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
    >
      <div className='fieldrange-label'>{label}</div>
      <div className='fieldrange-text'>{text}</div>
      <div className='fieldrange-track' ref={trackRef}>
        <div className='fieldrange-bar' />
      </div>
    </div>
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

export function FieldFile({ world, label, hint, kind: kindName, value, onChange }) {
  const { setHint } = useContext(HintContext)
  const nRef = useRef(0)
  const update = useUpdate()
  const [loading, setLoading] = useState(null)
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
    await world.network.upload(file)
    // ignore if new value/upload
    if (nRef.current !== n) return
    // cache file locally so this client can insta-load it
    world.loader.insert(kind.type, url, file)

    // Preload texture if it's a texture type
    if (kind.type === 'texture') {
      try {
        await world.loader.load('texture', url)
      } catch (err) {
        console.warn('[FieldFile] Failed to preload texture:', err)
      }
    }

    // apply!
    setLoading(null)
    onChange(newValue)
  }
  const remove = e => {
    e.preventDefault()
    e.stopPropagation()
    onChange(null)
  }
  const handleDownload = async e => {
    if (e.shiftKey && value?.url) {
      e.preventDefault()
      if (!world.loader.hasFile(value.url)) {
        await world.loader.loadFile(value.url)
      }
      const file = world.loader.getFile(value.url, value.name)
      if (!file) return console.error('could not load file')
      downloadFile(file)
    }
  }
  const n = nRef.current
  const name = loading?.name || value?.name
  return (
    <label
      className='fieldfile'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1rem;
        overflow: hidden;
        input {
          position: absolute;
          top: -9999px;
          left: -9999px;
          opacity: 0;
        }
        svg {
          line-height: 0;
        }
        .fieldfile-label {
          flex: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          padding-right: 1rem;
          font-size: 0.9375rem;
          color: rgba(255, 255, 255, 0.6);
        }
        .fieldfile-placeholder {
          color: rgba(255, 255, 255, 0.3);
        }
        .fieldfile-name {
          font-size: 0.9375rem;
          text-align: right;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          max-width: 9rem;
        }
        .fieldfile-x {
          line-height: 0;
          margin: 0 -0.2rem 0 0.3rem;
          color: rgba(255, 255, 255, 0.3);
          &:hover {
            color: white;
          }
        }
        .fieldfile-loading {
          margin: 0 -0.1rem 0 0.3rem;
          display: flex;
          align-items: center;
          justify-content: center;
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
          svg {
            animation: spin 1s linear infinite;
          }
        }
        &:hover {
          cursor: pointer;
          background: rgba(255, 255, 255, 0.03);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
      onClick={handleDownload}
    >
      <div className='fieldfile-label'>{label}</div>
      {!value && !loading && <div className='fieldfile-placeholder'>{kind.placeholder}</div>}
      {name && <div className='fieldfile-name'>{name}</div>}
      {value && !loading && (
        <div className='fieldfile-x'>
          <XIcon size='1rem' onClick={remove} />
        </div>
      )}
      {loading && (
        <div className='fieldfile-loading'>
          <LoaderIcon size='1rem' />
        </div>
      )}
      <input key={n} type='file' onChange={set} accept={kind.accept} />
    </label>
  )
}

export function FieldNumber({
  label,
  hint,
  dp = 0,
  min = -Infinity,
  max = Infinity,
  step = 1,
  bigStep = 2,
  value,
  onChange,
}) {
  const { setHint } = useContext(HintContext)
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
      className='fieldnumber'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1rem;
        cursor: text;
        .fieldnumber-label {
          width: 9.4rem;
          flex-shrink: 0;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          font-size: 0.9375rem;
          color: rgba(255, 255, 255, 0.6);
        }
        .fieldnumber-field {
          flex: 1;
        }
        input {
          font-size: 0.9375rem;
          height: 1rem;
          text-align: right;
          overflow: hidden;
          cursor: inherit;
          &::selection {
            background-color: white;
            color: rgba(0, 0, 0, 0.8);
          }
        }
        &:hover {
          cursor: pointer;
          background: rgba(255, 255, 255, 0.03);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
    >
      <div className='fieldnumber-label'>{label}</div>
      <div className='fieldnumber-field'>
        <input
          type='text'
          value={local}
          onChange={e => setLocal(e.target.value)}
          onKeyDown={e => {
            if (e.code === 'Enter') {
              e.preventDefault()
              e.target.blur()
            }
            if (e.code === 'ArrowUp') {
              const amount = e.shiftKey ? bigStep : step
              setTo(value + amount)
            }
            if (e.code === 'ArrowDown') {
              const amount = e.shiftKey ? bigStep : step
              setTo(value - amount)
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

export function FieldVec3({
  label,
  hint,
  dp = 0,
  min = -Infinity,
  max = Infinity,
  step = 1,
  bigStep = 2,
  value,
  onChange,
}) {
  const { setHint } = useContext(HintContext)
  let valueX = value?.[0] || 0
  let valueY = value?.[1] || 0
  let valueZ = value?.[2] || 0
  const [localX, setLocalX] = useState(valueX.toFixed(dp))
  const [localY, setLocalY] = useState(valueY.toFixed(dp))
  const [localZ, setLocalZ] = useState(valueZ.toFixed(dp))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) {
      if (localX !== valueX.toFixed(dp)) setLocalX(valueX.toFixed(dp))
      if (localY !== valueY.toFixed(dp)) setLocalY(valueY.toFixed(dp))
      if (localZ !== valueZ.toFixed(dp)) setLocalZ(valueZ.toFixed(dp))
    }
  }, [focused, valueX, valueY, valueZ])
  const parseStr = str => {
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
    return num
  }
  return (
    <label
      className='fieldvec3'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1rem;
        cursor: text;
        .fieldvec3-label {
          width: 9.4rem;
          flex-shrink: 0;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          font-size: 0.9375rem;
          color: rgba(255, 255, 255, 0.6);
        }
        .fieldvec3-field {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        input {
          font-size: 0.9375rem;
          height: 1rem;
          text-align: right;
          overflow: hidden;
          cursor: inherit;
          &::selection {
            background-color: white;
            color: rgba(0, 0, 0, 0.8);
          }
        }
        &:hover {
          cursor: pointer;
          background: rgba(255, 255, 255, 0.03);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
    >
      <div className='fieldvec3-label'>{label}</div>
      <div className='fieldvec3-field'>
        <input
          type='text'
          value={localX}
          onChange={e => setLocalX(e.target.value)}
          onKeyDown={e => {
            if (e.code === 'Enter') {
              e.preventDefault()
              e.target.blur()
            }
            if (e.code === 'ArrowUp') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr(valueX + amount)
              setLocalX(num.toFixed(dp))
              onChange([+num.toFixed(dp), valueY, valueZ])
            }
            if (e.code === 'ArrowDown') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr(valueX - amount)
              setLocalX(num.toFixed(dp))
              onChange([+num.toFixed(dp), valueY, valueZ])
            }
          }}
          onFocus={e => {
            setFocused(true)
            e.target.select()
          }}
          onBlur={e => {
            setFocused(false)
            // if blank, set back to original
            if (localX === '') {
              setLocalX(valueX.toFixed(dp))
              return
            }
            // otherwise run through pipeline
            const num = parseStr(localX)
            setLocalX(num.toFixed(dp))
            onChange([+num.toFixed(dp), valueY, valueZ])
          }}
        />
        <input
          type='text'
          value={localY}
          onChange={e => setLocalY(e.target.value)}
          onKeyDown={e => {
            if (e.code === 'Enter') {
              e.preventDefault()
              e.target.blur()
            }
            if (e.code === 'ArrowUp') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr(valueY + amount)
              setLocalY(num.toFixed(dp))
              onChange([valueX, +num.toFixed(dp), valueZ])
            }
            if (e.code === 'ArrowDown') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr(valueY - amount)
              setLocalY(num.toFixed(dp))
              onChange([valueX, +num.toFixed(dp), valueZ])
            }
          }}
          onFocus={e => {
            setFocused(true)
            e.target.select()
          }}
          onBlur={e => {
            setFocused(false)
            // if blank, set back to original
            if (localY === '') {
              setLocalY(valueY.toFixed(dp))
              return
            }
            // otherwise run through pipeline
            const num = parseStr(localY)
            setLocalY(num.toFixed(dp))
            onChange([valueX, +num.toFixed(dp), valueZ])
          }}
        />
        <input
          type='text'
          value={localZ}
          onChange={e => setLocalZ(e.target.value)}
          onKeyDown={e => {
            if (e.code === 'Enter') {
              e.preventDefault()
              e.target.blur()
            }
            if (e.code === 'ArrowUp') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr(valueZ + amount)
              setLocalZ(num.toFixed(dp))
              onChange([valueX, valueY, +num.toFixed(dp)])
            }
            if (e.code === 'ArrowDown') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr(valueZ - amount)
              setLocalZ(num.toFixed(dp))
              onChange([valueX, valueY, +num.toFixed(dp)])
            }
          }}
          onFocus={e => {
            setFocused(true)
            e.target.select()
          }}
          onBlur={e => {
            setFocused(false)
            // if blank, set back to original
            if (localZ === '') {
              setLocalZ(valueZ.toFixed(dp))
              return
            }
            // otherwise run through pipeline
            const num = parseStr(localZ)
            setLocalZ(num.toFixed(dp))
            onChange([valueX, valueY, +num.toFixed(dp)])
          }}
        />
      </div>
    </label>
  )
}

export function FieldCurve({ label, hint, x, xRange, y, yMin, yMax, value, onChange }) {
  const { setHint } = useContext(HintContext)
  const curve = useMemo(() => new Curve().deserialize(value || '0,0.5,0,0|1,0.5,0,0'), [value])
  const [edit, setEdit] = useState(false)
  return (
    <div
      className='fieldcurve'
      css={css`
        .fieldcurve-control {
          display: flex;
          align-items: center;
          height: 2.5rem;
          padding: 0 1rem;
        }
        .fieldcurve-label {
          flex: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          padding-right: 1rem;
          font-size: 0.9375rem;
          color: rgba(255, 255, 255, 0.6);
        }
        .fieldcurve-curve {
          width: 6rem;
          height: 1.2rem;
          position: relative;
        }
        &:hover {
          cursor: pointer;
          background-color: rgba(255, 255, 255, 0.03);
        }
      `}
    >
      <div
        className='fieldcurve-control'
        onClick={() => {
          if (edit) {
            setEdit(null)
          } else {
            setEdit(curve.clone())
          }
        }}
        onPointerEnter={() => setHint(hint)}
        onPointerLeave={() => setHint(null)}
      >
        <div className='fieldcurve-label'>{label}</div>
        <div className='fieldcurve-curve'>
          <CurvePreview curve={curve} yMin={yMin} yMax={yMax} />
        </div>
      </div>
      {edit && (
        <Portal>
          <CurvePane
            curve={edit}
            title={label}
            xLabel={x}
            xRange={xRange}
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

export function FieldBtn({ label, note, hint, nav, onClick }) {
  const { setHint } = useContext(HintContext)
  return (
    <div
      className='fieldbtn'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1rem;
        .fieldbtn-label {
          flex: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          font-size: 0.9375rem;
          color: rgba(255, 255, 255, 0.6);
        }
        .fieldbtn-note {
          font-size: 0.9375rem;
          color: rgba(255, 255, 255, 0.4);
        }
        &:hover {
          cursor: pointer;
          background: rgba(255, 255, 255, 0.03);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
      onClick={onClick}
    >
      <div className='fieldbtn-label'>{label}</div>
      {note && <div className='fieldbtn-note'>{note}</div>}
      {nav && <ChevronRightIcon size='1.5rem' />}
    </div>
  )
}

export function FieldColorWheel({ label, hint, value, onChange }) {
  const { setHint } = useContext(HintContext)
  const [showPicker, setShowPicker] = useState(false)
  const [localValue, setLocalValue] = useState(value || '#ffffff')
  const [hexInput, setHexInput] = useState(value || '#ffffff')
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 })
  const pickerRef = useRef()
  const controlRef = useRef()

  // Warm → cool; light → mid → deep (3×6)
  const presetColors = [
    '#FCA5A5',
    '#FDBA74',
    '#FDE68A',
    '#86EFAC',
    '#93C5FD',
    '#D8B4FE',
    '#EF4444',
    '#F59E0B',
    '#EAB308',
    '#22C55E',
    '#3B82F6',
    '#A855F7',
    '#B91C1C',
    '#9A3412',
    '#854D0E',
    '#166534',
    '#1E40AF',
    '#6D28D9',
  ]

  useEffect(() => {
    if (localValue !== value) {
      setLocalValue(value || '#ffffff')
      setHexInput(value || '#ffffff')
    }
  }, [value])

  useEffect(() => {
    if (!showPicker) return

    function handleClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPicker, localValue])

  const handleColorChange = color => {
    setLocalValue(color)
    setHexInput(color)
    onChange(color) // Update immediately when color changes
  }

  const handleHexInputChange = e => {
    const input = e.target.value
    setHexInput(input)
    
    // Validate hex color
    const hexPattern = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/
    if (hexPattern.test(input)) {
      setLocalValue(input)
      onChange(input)
    }
  }

  const handleHexInputBlur = () => {
    // Reset to current color if invalid
    const hexPattern = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/
    if (!hexPattern.test(hexInput)) {
      setHexInput(localValue)
    }
  }

  const handlePresetClick = color => {
    setLocalValue(color)
    setHexInput(color)
    onChange(color)
    // Don't close the picker when selecting a preset
  }

  const handleControlClick = () => {
    if (!showPicker && controlRef.current) {
      const rect = controlRef.current.getBoundingClientRect()
      const pickerWidth = 182 // 150px picker + 32px padding
      const pickerHeight = 250 // approximate height with presets

      // Calculate position to keep picker on screen
      let left = rect.right - pickerWidth
      let top = rect.bottom + 8

      // Check if picker would go off right edge
      if (left < 0) {
        left = rect.left
      }

      // Check if picker would go off bottom
      if (top + pickerHeight > window.innerHeight) {
        top = rect.top - pickerHeight - 8
      }

      setPickerPosition({ top, left })
    }
    setShowPicker(!showPicker)
  }

  return (
    <div
      className='fieldcolorwheel'
      css={css`
        position: relative;
        .fieldcolorwheel-control {
          display: flex;
          align-items: center;
          height: 2.5rem;
          padding: 0 1rem;
          cursor: pointer;
        }
        .fieldcolorwheel-label {
          width: 9.4rem;
          flex-shrink: 0;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          font-size: 0.9375rem;
          color: rgba(255, 255, 255, 0.6);
        }
        .fieldcolorwheel-preview {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.5rem;
        }
        .fieldcolorwheel-text {
          font-size: 0.9375rem;
          font-family: monospace;
          text-transform: uppercase;
          text-align: right;
        }
        .fieldcolorwheel-swatch {
          width: 1.25rem;
          height: 1.25rem;
          border-radius: 0.375rem;
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
          flex-shrink: 0;
        }
        .fieldcolorwheel-control:hover {
          background-color: rgba(255, 255, 255, 0.03);
        }
        .fieldcolorwheel-picker {
          position: fixed;
          z-index: 10000;
          background: rgba(11, 10, 21, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          padding: 1rem;
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
        }
        /* Custom styles for react-colorful */
        .react-colorful {
          width: 100%;
          height: 150px;
        }
        .react-colorful__saturation {
          border-radius: 0.5rem 0.5rem 0 0;
        }
        .react-colorful__hue {
          margin-top: 0.75rem;
          height: 0.75rem;
          border-radius: 0.375rem;
        }
        .react-colorful__saturation-pointer,
        .react-colorful__hue-pointer {
          width: 1rem;
          height: 1rem;
          border-width: 2px;
        }
        .fieldcolorwheel-hexinput {
          margin-top: 0.75rem;
          input {
            width: 100%;
            padding: 0.5rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 0.375rem;
            color: #ffffff;
            font-family: monospace;
            font-size: 0.875rem;
            text-align: center;
            text-transform: uppercase;
            transition: all 0.2s;
            &:focus {
              outline: none;
              border-color: rgba(255, 255, 255, 0.3);
              background: rgba(255, 255, 255, 0.08);
            }
            &::placeholder {
              color: rgba(255, 255, 255, 0.3);
            }
          }
        }
        .fieldcolorwheel-presets {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 0.375rem;
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .fieldcolorwheel-preset {
          width: 1.25rem;
          height: 1.25rem;
          border-radius: 0.25rem;
          border: 1px solid rgba(255, 255, 255, 0.2);
          cursor: pointer;
          transition: all 0.1s;
          position: relative;
        }
        .fieldcolorwheel-preset:hover {
          transform: scale(1.1);
          border-color: rgba(255, 255, 255, 0.4);
        }
        .fieldcolorwheel-preset.active {
          border-color: #ffffff;
          box-shadow:
            0 0 0 2px #ffffff,
            0 0 0 3px rgba(0, 0, 0, 0.5);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
    >
      <div ref={controlRef} className='fieldcolorwheel-control' onClick={handleControlClick}>
        <div className='fieldcolorwheel-label'>{label}</div>
        <div className='fieldcolorwheel-preview'>
          <div className='fieldcolorwheel-text'>{localValue}</div>
          <div className='fieldcolorwheel-swatch' style={{ backgroundColor: localValue }} />
        </div>
      </div>

      {showPicker && (
        <div
          className='fieldcolorwheel-picker'
          ref={pickerRef}
          style={{
            top: `${pickerPosition.top}px`,
            left: `${pickerPosition.left}px`,
          }}
        >
          <HexColorPicker color={localValue} onChange={handleColorChange} />
          <div className='fieldcolorwheel-hexinput'>
            <input
              type='text'
              value={hexInput}
              onChange={handleHexInputChange}
              onBlur={handleHexInputBlur}
              placeholder='#FFFFFF'
              maxLength={7}
            />
          </div>
          <div className='fieldcolorwheel-presets'>
            {presetColors.map(color => (
              <div
                key={color}
                className={`fieldcolorwheel-preset ${localValue === color ? 'active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => handlePresetClick(color)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
