import React, { useEffect, useRef, useState } from 'react'
import { css } from '@firebolt-dev/css'
import { useUpdate } from './useUpdate'
import { ChevronDownIcon, FileIcon, LoaderIcon, XIcon } from 'lucide-react'
import { cls } from './cls'
import { hashFile } from '../../core/utils-client'

interface InputTextProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function InputText({ value, onChange, placeholder }: InputTextProps) {
  const [localValue, setLocalValue] = useState(value)
  useEffect(() => {
    if (localValue !== value) setLocalValue(value)
  }, [value, localValue])
  return (
    <label
      {...{ css: css`
        display: block;
        background-color: #252630;
        border-radius: 10px;
        padding: 0 8px;
        cursor: text;
        input {
          height: 34px;
          font-size: 14px;
        }
      ` }}
    >
      <input
        type='text'
        value={localValue || ''}
        placeholder={placeholder}
        onChange={e => setLocalValue(e.target.value)}
        onKeyDown={e => {
          if (e.code === 'Enter') {
            e.preventDefault()
            onChange(localValue)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        onBlur={_e => {
          onChange(localValue)
        }}
      />
    </label>
  )
}

interface InputTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function InputTextarea({ value, onChange, placeholder }: InputTextareaProps) {
  const [localValue, setLocalValue] = useState(value)
  useEffect(() => {
    if (localValue !== value) setLocalValue(value)
  }, [value, localValue])
  return (
    <label
      {...{ css: css`
        display: block;
        background-color: #252630;
        border-radius: 10px;
        cursor: text;
        textarea {
          padding: 6px 8px;
          line-height: 1.4;
          font-size: 14px;
          min-height: 56px;
          max-width: 100%;
          min-width: 100%;
        }
      ` }}
    >
      <textarea
        value={localValue || ''}
        onChange={e => setLocalValue(e.target.value)}
        onKeyDown={e => {
          if (e.metaKey && e.code === 'Enter') {
            e.preventDefault()
            onChange(localValue)
            ;(e.target as HTMLTextAreaElement).blur()
          }
        }}
        onBlur={_e => {
          onChange(localValue)
        }}
        placeholder={placeholder}
      />
    </label>
  )
}

interface InputNumberProps {
  value: number;
  onChange: (value: number) => void;
  dp?: number;
  min?: number;
  max?: number;
  step?: number;
}

export function InputNumber({ value, onChange, dp = 0, min = -Infinity, max = Infinity, step = 1 }: InputNumberProps) {
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
      {...{ css: css`
        display: block;
        background-color: #252630;
        border-radius: 10px;
        padding: 0 8px;
        cursor: text;
        input {
          height: 34px;
          font-size: 14px;
        }
      ` }}
    >
      <input
        type='text'
        value={local}
        onChange={e => setLocal(e.target.value)}
        onKeyDown={e => {
          if (e.code === 'Enter') {
            ;(e.target as HTMLInputElement).blur()
          }
          if (e.code === 'ArrowUp') {
            setTo((value + step).toString())
          }
          if (e.code === 'ArrowDown') {
            setTo((value - step).toString())
          }
        }}
        onFocus={e => {
          setFocused(true)
          ;(e.target as HTMLInputElement).select()
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
    </label>
  )
}

interface InputRangeProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  instant?: boolean;
}

export function InputRange({ value, onChange, min = 0, max = 1, step = 0.05, instant }: InputRangeProps) {
  if (value === undefined || value === null) {
    value = 0
  }
  const [local, setLocal] = useState(value)
  const [sliding, setSliding] = useState(false)
  useEffect(() => {
    if (!sliding && local !== value) setLocal(value)
  }, [sliding, value, local])
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    if (instant) {
      onChange(value)
    }
    setLocal(value)
  }
  return (
    <div
      className='inputrange'
      {...{ css: css`
        display: flex;
        align-items: center;
        border: 1px solid #252630;
        border-radius: 10px;
        height: 34px;
        padding: 3px;
        input {
          appearance: none;
          width: 100%;
          cursor: pointer;
          outline: none;
          &::-webkit-slider-runnable-track {
          }
          &::-webkit-slider-thumb {
            appearance: none;
            height: 28px;
            width: 20px;
            background: #3a3c4c;
            border-radius: 7px;
          }
        }
        .inputrange-value {
          height: 34px;
          border-right: 1px solid #252630;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          padding: 0 8px;
          flex-shrink: 0;
        }
      ` }}
    >
      {/* <div className='inputrange-value'>
        <span>{local}</span>
      </div> */}
      <input
        type='range'
        min={min}
        max={max}
        step={step}
        value={local}
        onChange={handleChange}
        onPointerDown={() => setSliding(true)}
        onPointerUp={() => {
          setSliding(false)
          if (!instant) {
            onChange(local)
          }
        }}
      />
    </div>
  )
}

interface SwitchOption {
  label: string;
  value: any;
}

interface InputSwitchProps {
  options: SwitchOption[];
  value: any;
  onChange: (value: any) => void;
}

export function InputSwitch({ options, value, onChange }: InputSwitchProps) {
  return (
    <div
      className='inputswitch'
      {...{ css: css`
        display: flex;
        align-items: center;
        border: 1px solid #252630;
        border-radius: 10px;
        padding: 3px;
        .inputswitch-option {
          flex: 1;
          border-radius: 7px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          span {
            line-height: 1;
            font-size: 14px;
          }
          &.selected {
            background: #252630;
          }
        }
      ` }}
    >
      {options.map((option: SwitchOption) => (
        <div
          key={option.value}
          className={cls('inputswitch-option', { selected: value === option.value })}
          onClick={() => onChange(option.value)}
        >
          <span>{option.label}</span>
        </div>
      ))}
    </div>
  )
}

interface DropdownOption {
  label: string;
  value: any;
}

interface InputDropdownProps {
  options: DropdownOption[];
  value: any;
  onChange: (value: any) => void;
}

export function InputDropdown({ options, value, onChange }: InputDropdownProps) {
  const current = options.find((o: DropdownOption) => o.value === value)
  const [open, setOpen] = useState(false)
  const toggle = () => setOpen(!open)
  return (
    <div
      className='inputdropdown'
      {...{ css: css`
        position: relative;
        .inputdropdown-current {
          display: flex;
          align-items: center;
          background: #252630;
          border-radius: 10px;
          height: 34px;
          padding: 0 8px;
          cursor: pointer;
          span {
            font-size: 14px;
            flex: 1;
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
          }
        }
        .inputdropdown-menu {
          z-index: 1;
          margin: 3px 0 20px;
          position: absolute;
          left: 0;
          right: 0;
          background: #252630;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
          border-radius: 10px;
          overflow: hidden;
          padding: 4px 0;
        }
        .inputdropdown-option {
          font-size: 14px;
          padding: 8px;
          &:hover {
            cursor: pointer;
            background: rgb(46, 47, 59);
          }
        }
      ` }}
    >
      <div className='inputdropdown-current' onClick={toggle}>
        <span>{current?.label || ''}</span>
        <ChevronDownIcon size={12} />
      </div>
      {open && (
        <div className='inputdropdown-menu'>
          {options.map((option: DropdownOption) => (
            <div
              key={option.value}
              className={cls('inputdropdown-option', { selected: value === option.value })}
              onClick={() => {
                setOpen(false)
                onChange(option.value)
              }}
            >
              <span>{option.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const fileKinds = {
  avatar: {
    type: 'avatar',
    accept: '.vrm',
    exts: ['vrm'],
    placeholder: '.vrm',
  },
  emote: {
    type: 'emote',
    accept: '.glb',
    exts: ['glb'],
    placeholder: '.glb',
  },
  model: {
    type: 'model',
    accept: '.glb',
    exts: ['glb'],
    placeholder: '.glb',
  },
  texture: {
    type: 'texture',
    accept: '.jpg,.jpeg,.png,.webp',
    exts: ['jpg', 'jpeg', 'png', 'webp'],
    placeholder: '.jpg / .png / .webp',
  },
  hdr: {
    type: 'hdr',
    accept: '.hdr',
    exts: ['hdr'],
    placeholder: '.hdr',
  },
  audio: {
    type: 'audio',
    accept: '.mp3',
    exts: ['mp3'],
    placeholder: '.mp3',
  },
}

interface InputFileProps {
  world: any;
  kind: keyof typeof fileKinds;
  value: any;
  onChange: (value: any) => void;
}

export function InputFile({ world, kind: kindName, value, onChange }: InputFileProps) {
  const nRef = useRef(0)
  const update = useUpdate()
  const [loading, setLoading] = useState<any>(null)
  const kind = fileKinds[kindName]
  if (!kind) return null
  const set = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // trigger input rebuild
    const n = ++nRef.current
    update()
    // get file
    const file = e.target.files?.[0]
    if (!file) return
    // check ext
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !kind.exts.includes(ext)) {
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
    // apply!
    setLoading(null)
    onChange(newValue)
  }
  const remove = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onChange(null)
  }
  const n = nRef.current
  const label = loading?.name || value?.name
  return (
    <label
      className='inputfile'
      {...{ css: css`
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        height: 34px;
        background-color: #252630;
        border-radius: 10px;
        padding: 0 0 0 8px;
        input {
          position: absolute;
          top: -9999px;
          left: -9999px;
          opacity: 0;
        }
        svg {
          line-height: 0;
        }
        .inputfile-placeholder {
          flex: 1;
          font-size: 14px;
          padding: 0 5px;
          color: rgba(255, 255, 255, 0.5);
        }
        .inputfile-name {
          flex: 1;
          font-size: 14px;
          padding: 0 5px;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .inputfile-x {
          width: 30px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .inputfile-loading {
          width: 30px;
          height: 34px;
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
      ` }}
    >
      <FileIcon size={14} />
      {!value && !loading && <div className='inputfile-placeholder'>{kind.placeholder}</div>}
      {label && <div className='inputfile-name'>{label}</div>}
      {value && !loading && (
        <div className='inputfile-x' onClick={remove}>
          <XIcon size={14} />
        </div>
      )}
      {loading && (
        <div className='inputfile-loading'>
          <LoaderIcon size={14} />
        </div>
      )}
      <input key={n} type='file' onChange={set} accept={kind.accept} />
    </label>
  )
}
