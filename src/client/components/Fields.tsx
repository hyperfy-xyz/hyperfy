import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { css } from '@firebolt-dev/css'
import { ChevronLeftIcon, ChevronRightIcon, XIcon, LoaderIcon } from 'lucide-react'
import { cls } from '../utils'
import { HintContext } from './Hint'
import { useUpdate } from './useUpdate'
import { hashFile } from '../../core/utils-client'
import { downloadFile } from '../../core/extras/downloadFile'
import { Curve } from '../../core/extras/Curve'
import { CurvePreview } from './CurvePreview'
import { CurvePane } from './CurvePane'
import { Portal } from './Portal'

interface FieldTextProps {
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

export function FieldText({ label, hint, placeholder, value, onChange }: FieldTextProps) {
  const hintContext = useContext(HintContext)
  const setHint = hintContext?.setHint
  return (
    <label
      className='field field-text'
      {...{ css: css`
        display: block;
        margin: 0 0 0.5rem;
        position: relative;
        .field-label {
          font-size: 0.8125rem;
          margin: 0 0 0.375rem;
          opacity: 0.7;
          font-weight: 500;
        }
        input {
          width: 100%;
          font-size: 0.875rem;
          padding: 0.375rem 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.25rem;
          &:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
          }
          &:focus {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.3);
          }
        }
      ` }}
      onPointerEnter={() => hint && setHint?.(hint)}
      onPointerLeave={() => hint && setHint?.(null)}
    >
      <div className='field-label'>{label}</div>
      <input
        type='text'
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.code === 'Escape') {
            const target = e.target as HTMLInputElement
            target.blur()
          }
        }}
        onBlur={() => {
          // ...
        }}
      />
    </label>
  )
}

interface FieldTextareaProps {
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

export function FieldTextarea({ label, hint, placeholder, value, onChange }: FieldTextareaProps) {
  const hintContext = useContext(HintContext)
  const setHint = hintContext?.setHint
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
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
      className='field field-textarea'
      {...{ css: css`
        display: block;
        margin: 0 0 0.5rem;
        position: relative;
        .field-label {
          font-size: 0.8125rem;
          margin: 0 0 0.375rem;
          opacity: 0.7;
          font-weight: 500;
        }
        textarea {
          width: 100%;
          font-size: 0.875rem;
          padding: 0.375rem 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.25rem;
          resize: none;
          min-height: 3rem;
          &:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
          }
          &:focus {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.3);
          }
        }
      ` }}
      onPointerEnter={() => hint && setHint?.(hint)}
      onPointerLeave={() => hint && setHint?.(null)}
    >
      <div className='field-label'>{label}</div>
      <textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.code === 'Escape') {
            const target = e.target as HTMLTextAreaElement
            target.blur()
          }
        }}
        onBlur={() => {
          // ...
        }}
      />
    </label>
  )
}

interface SwitchOption {
  label: string;
  value: any;
}

interface FieldSwitchProps {
  label: string;
  hint?: string;
  options: SwitchOption[];
  value: any;
  onChange: (value: any) => void;
}

export function FieldSwitch({ label, hint, options, value, onChange }: FieldSwitchProps) {
  const hintContext = useContext(HintContext)
  const setHint = hintContext?.setHint
  const idx = options.findIndex((o: SwitchOption) => o.value === value)
  const prev = () => {
    const newIdx = idx - 1
    if (newIdx < 0) {
      onChange(options[options.length - 1].value)
    } else {
      onChange(options[newIdx].value)
    }
  }
  const next = () => {
    const newIdx = idx + 1
    if (newIdx >= options.length) {
      onChange(options[0].value)
    } else {
      onChange(options[newIdx].value)
    }
  }
  return (
    <div
      className='field field-switch'
      {...{ css: css`
        margin: 0 0 0.5rem;
        .field-label {
          font-size: 0.8125rem;
          margin: 0 0 0.375rem;
          opacity: 0.7;
          font-weight: 500;
        }
        .field-switch-control {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          .field-switch-value {
            flex: 1;
            text-align: center;
          }
          .field-switch-btn {
            width: 1.5rem;
            height: 1.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 0.25rem;
            cursor: pointer;
            &:hover {
              background: rgba(255, 255, 255, 0.1);
              border-color: rgba(255, 255, 255, 0.2);
            }
          }
        }
      ` }}
      onPointerEnter={() => hint && setHint?.(hint)}
      onPointerLeave={() => hint && setHint?.(null)}
    >
      <div className='field-label'>{label}</div>
      <div className='field-switch-control'>
        <div className='field-switch-btn' onClick={prev}>
          <ChevronLeftIcon size={16} />
        </div>
        <div className='field-switch-value'>{options[idx]?.label || ''}</div>
        <div className='field-switch-btn' onClick={next}>
          <ChevronRightIcon size={16} />
        </div>
      </div>
    </div>
  )
}

interface FieldToggleProps {
  label: string;
  hint?: string;
  trueLabel?: string;
  falseLabel?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function FieldToggle({ label, hint, trueLabel = 'Yes', falseLabel = 'No', value, onChange }: FieldToggleProps) {
  return (
    <FieldSwitch
      label={label}
      hint={hint}
      options={[
        { label: falseLabel, value: false },
        { label: trueLabel, value: true },
      ]}
      value={value}
      onChange={onChange}
    />
  )
}

interface FieldRangeProps {
  label: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  instant?: boolean;
  value: number;
  onChange: (value: number) => void;
}

export function FieldRange({ label, hint, min = 0, max = 1, step = 0.05, instant, value, onChange }: FieldRangeProps) {
  const hintContext = useContext(HintContext)
  const setHint = hintContext?.setHint
  const trackRef = useRef<HTMLDivElement | null>(null)
  if (value === undefined || value === null) {
    value = 0
  }
  const [local, setLocal] = useState(value)
  const [sliding, setSliding] = useState(false)
  useEffect(() => {
    if (!sliding && local !== value) setLocal(value)
  }, [sliding, value, local])
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    function calculateValueFromPointer(e: PointerEvent, trackElement: HTMLElement) {
      const rect = trackElement.getBoundingClientRect()
      const position = (e.clientX - rect.left) / rect.width
      const rawValue = min + position * (max - min)
      // Round to nearest step
      const steppedValue = Math.round(rawValue / step) * step
      // Clamp between min and max
      return Math.max(min, Math.min(max, steppedValue))
    }
    let sliding = false
    function onPointerDown(e: PointerEvent) {
      sliding = true
      setSliding(true)
      const newValue = calculateValueFromPointer(e, e.currentTarget as HTMLElement)
      setLocal(newValue)
      if (instant) onChange(newValue)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    function onPointerMove(e: PointerEvent) {
      if (!sliding) return
      const newValue = calculateValueFromPointer(e, e.currentTarget as HTMLElement)
      setLocal(newValue)
      if (instant) onChange(newValue)
    }
    function onPointerUp(e: PointerEvent) {
      if (!sliding) return
      sliding = false
      setSliding(false)
      const finalValue = calculateValueFromPointer(e, e.currentTarget as HTMLElement)
      setLocal(finalValue)
      onChange(finalValue)
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    }
    track.addEventListener('pointerdown', onPointerDown)
    track.addEventListener('pointermove', onPointerMove)
    track.addEventListener('pointerup', onPointerUp)
    return () => {
      track.removeEventListener('pointerdown', onPointerDown)
      track.removeEventListener('pointermove', onPointerMove)
      track.removeEventListener('pointerup', onPointerUp)
    }
  }, [min, max, step, instant, onChange])
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
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '2.5rem',
        padding: '0 1rem',
      }}
      onPointerEnter={() => hint && setHint?.(hint)}
      onPointerLeave={() => hint && setHint?.(null)}
    >
      <style>{`
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
          cursor: pointer;
        }
        .fieldrange-bar {
          background-color: white;
          border-radius: 0.1rem;
          width: ${barWidthPercentage}%;
        }
        .fieldrange:hover {
          background-color: rgba(255, 255, 255, 0.03);
        }
        .fieldrange:hover .fieldrange-text {
          opacity: 1;
        }
      `}</style>
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

interface FieldFileProps {
  world: any;
  label: string;
  hint?: string;
  kind: keyof typeof fileKinds;
  value: any;
  onChange: (value: any) => void;
}

interface LoadingFile {
  type: string;
  name: string;
  url: string;
}

export function FieldFile({ world, label, hint, kind: kindName, value, onChange }: FieldFileProps) {
  const hintContext = useContext(HintContext)
  const setHint = hintContext?.setHint
  const nRef = useRef(0)
  const update = useUpdate()
  const [loading, setLoading] = useState<LoadingFile | null>(null)
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
    const newValue: LoadingFile = {
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
      const file = world.loader.getFile(value.url, value.name)
      if (!file) return
      downloadFile(file)
    }
  }
  const n = nRef.current
  const name = loading?.name || value?.name
  return (
    <label
      className='fieldfile'
      {...{ css: css`
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
      ` }}
      onPointerEnter={() => hint && setHint?.(hint)}
      onPointerLeave={() => hint && setHint?.(null)}
      onClick={handleDownload}
    >
      <div className='fieldfile-label'>{label}</div>
      {!value && !loading && <div className='fieldfile-placeholder'>{kind.placeholder}</div>}
      {name && <div className='fieldfile-name'>{name}</div>}
      {value && !loading && (
        <div className='fieldfile-x' onClick={remove}>
          <XIcon size='1rem' />
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

interface FieldNumberProps {
  label: string;
  hint?: string;
  dp?: number;
  min?: number;
  max?: number;
  step?: number;
  bigStep?: number;
  value: number;
  onChange: (value: number) => void;
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
}: FieldNumberProps) {
  const hintContext = useContext(HintContext)
  const setHint = hintContext?.setHint
  if (value === undefined || value === null) {
    value = 0
  }
  const [local, setLocal] = useState(value.toFixed(dp))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused && local !== value.toFixed(dp)) setLocal(value.toFixed(dp))
  }, [focused, value, local, dp])
  const setTo = (str: string) => {
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
      {...{ css: css`
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
      ` }}
      onPointerEnter={() => hint && setHint?.(hint)}
      onPointerLeave={() => hint && setHint?.(null)}
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
              ;(e.target as HTMLInputElement).blur()
            }
            if (e.code === 'ArrowUp') {
              const amount = e.shiftKey ? bigStep : step
              setTo((value + amount).toString())
            }
            if (e.code === 'ArrowDown') {
              const amount = e.shiftKey ? bigStep : step
              setTo((value - amount).toString())
            }
          }}
          onFocus={e => {
            setFocused(true)
            e.target.select()
          }}
          onBlur={_e => {
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

interface FieldVec3Props {
  label: string;
  hint?: string;
  dp?: number;
  min?: number;
  max?: number;
  step?: number;
  bigStep?: number;
  value: number[];
  onChange: (value: number[]) => void;
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
}: FieldVec3Props) {
  const hintContext = useContext(HintContext)
  const setHint = hintContext?.setHint
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
  }, [focused, valueX, valueY, valueZ, localX, localY, localZ, dp])
  const parseStr = (str: string) => {
    // try parse math
    let num
    try {
      num = (0, eval)(str)
      if (typeof num !== 'number') {
        throw new Error('input number parse fail')
      }
    } catch (err) {
      console.error(err)
      num = 0 // default to 0
    }
    if (num < min || num > max) {
      num = 0
    }
    return num
  }
  return (
    <label
      className='fieldvec3'
      {...{ css: css`
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
      ` }}
      onPointerEnter={() => hint && setHint?.(hint)}
      onPointerLeave={() => hint && setHint?.(null)}
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
              ;(e.target as HTMLInputElement).blur()
            }
            if (e.code === 'ArrowUp') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr((valueX + amount).toString())
              setLocalX(num.toFixed(dp))
              onChange([+num.toFixed(dp), valueY, valueZ])
            }
            if (e.code === 'ArrowDown') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr((valueX - amount).toString())
              setLocalX(num.toFixed(dp))
              onChange([+num.toFixed(dp), valueY, valueZ])
            }
          }}
          onFocus={e => {
            setFocused(true)
            e.target.select()
          }}
          onBlur={_e => {
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
              ;(e.target as HTMLInputElement).blur()
            }
            if (e.code === 'ArrowUp') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr((valueY + amount).toString())
              setLocalY(num.toFixed(dp))
              onChange([valueX, +num.toFixed(dp), valueZ])
            }
            if (e.code === 'ArrowDown') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr((valueY - amount).toString())
              setLocalY(num.toFixed(dp))
              onChange([valueX, +num.toFixed(dp), valueZ])
            }
          }}
          onFocus={e => {
            setFocused(true)
            e.target.select()
          }}
          onBlur={_e => {
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
              ;(e.target as HTMLInputElement).blur()
            }
            if (e.code === 'ArrowUp') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr((valueZ + amount).toString())
              setLocalZ(num.toFixed(dp))
              onChange([valueX, valueY, +num.toFixed(dp)])
            }
            if (e.code === 'ArrowDown') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr((valueZ - amount).toString())
              setLocalZ(num.toFixed(dp))
              onChange([valueX, valueY, +num.toFixed(dp)])
            }
          }}
          onFocus={e => {
            setFocused(true)
            e.target.select()
          }}
          onBlur={_e => {
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

interface FieldCurveProps {
  label: string;
  hint?: string;
  x: string;
  xRange?: number;
  y: string;
  yMin: number;
  yMax: number;
  value: string;
  onChange: (value: string) => void;
}

export function FieldCurve({ label, hint, x, xRange, y, yMin, yMax, value, onChange }: FieldCurveProps) {
  const hintContext = useContext(HintContext)
  const setHint = hintContext?.setHint
  const curve = useMemo(() => new Curve().deserialize(value || '0,0.5,0,0|1,0.5,0,0'), [value])
  const [edit, setEdit] = useState<any>(false)
  return (
    <div
      className='fieldcurve'
      {...{ css: css`
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
      ` }}
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
        onPointerEnter={() => hint && setHint?.(hint)}
        onPointerLeave={() => hint && setHint?.(null)}
      >
        <div className='fieldcurve-label'>{label}</div>
        <div className='fieldcurve-curve'>
          <CurvePreview curve={curve} yMin={yMin} yMax={yMax} />
        </div>
      </div>
      {edit && (
        <Portal>
          <CurvePane
            curve={edit as Curve}
            title='Edit Curve'
            xLabel={x}
            yLabel={y}
            yMin={yMin}
            yMax={yMax}
            onCommit={() => {
              onChange((edit as Curve).serialize())
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

interface FieldBtnProps {
  label: string;
  note?: string;
  hint?: string;
  nav?: boolean;
  onClick: () => void;
}

export function FieldBtn({ label, note, hint, nav, onClick }: FieldBtnProps) {
  const hintContext = useContext(HintContext)
  const setHint = hintContext?.setHint
  return (
    <div
      className='fieldbtn'
      {...{ css: css`
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
      ` }}
      onPointerEnter={() => hint && setHint?.(hint)}
      onPointerLeave={() => hint && setHint?.(null)}
      onClick={onClick}
    >
      <div className='fieldbtn-label'>{label}</div>
      {note && <div className='fieldbtn-note'>{note}</div>}
      {nav && <ChevronRightIcon size='1.5rem' />}
    </div>
  )
}
