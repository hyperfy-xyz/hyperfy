// import { ChevronDownIcon, UploadIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { cls } from './cls'

interface InputTextProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function InputText({ label, value, onChange, placeholder, disabled }: InputTextProps) {
  return (
    <div className='inputtext' style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {label && <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>{label}</label>}
      <input
        type='text'
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '0.5rem',
          background: '#252630',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '0.375rem',
          color: 'white',
          fontSize: '0.875rem',
          outline: 'none',
        }}
      />
    </div>
  )
}

interface InputTextareaProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}

export function InputTextarea({ label, value, onChange, placeholder, disabled, rows = 3 }: InputTextareaProps) {
  return (
    <div className='inputtextarea' style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {label && <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>{label}</label>}
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        style={{
          width: '100%',
          padding: '0.5rem',
          background: '#252630',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '0.375rem',
          color: 'white',
          fontSize: '0.875rem',
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />
    </div>
  )
}

interface InputNumberProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export function InputNumber({ label, value, onChange, min, max, step = 1, disabled }: InputNumberProps) {
  return (
    <div className='inputnumber' style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {label && <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>{label}</label>}
      <input
        type='number'
        value={value || 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '0.5rem',
          background: '#252630',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '0.375rem',
          color: 'white',
          fontSize: '0.875rem',
          outline: 'none',
        }}
      />
    </div>
  )
}

interface InputRangeProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export function InputRange({ label, value, onChange, min = 0, max = 100, step = 1, disabled }: InputRangeProps) {
  return (
    <div className='inputrange' style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <style>{`
        .inputrange-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 0.5rem;
          border-radius: 0.25rem;
          background: #252630;
          outline: none;
        }
        .inputrange-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 1rem;
          height: 1rem;
          border-radius: 50%;
          background: #00a7ff;
          cursor: pointer;
        }
        .inputrange-slider::-moz-range-thumb {
          width: 1rem;
          height: 1rem;
          border-radius: 50%;
          background: #00a7ff;
          cursor: pointer;
          border: none;
        }
      `}</style>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>{label}</label>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>{value}</span>
        </div>
      )}
      <input
        type='range'
        className='inputrange-slider'
        value={value || 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
    </div>
  )
}

interface InputSwitchProps {
  label?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function InputSwitch({ label, value, onChange, disabled }: InputSwitchProps) {
  return (
    <div className='inputswitch' style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <style>{`
        .inputswitch-toggle {
          position: relative;
          width: 2.5rem;
          height: 1.25rem;
          background: ${value ? '#00a7ff' : '#252630'};
          border-radius: 0.625rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .inputswitch-toggle::before {
          content: '';
          position: absolute;
          top: 0.125rem;
          left: ${value ? '1.375rem' : '0.125rem'};
          width: 1rem;
          height: 1rem;
          background: white;
          border-radius: 50%;
          transition: left 0.2s;
        }
        .inputswitch-toggle:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
      <div
        className='inputswitch-toggle'
        onClick={() => !disabled && onChange(!value)}
        style={{ pointerEvents: disabled ? 'none' : 'auto' }}
      />
      {label && <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>{label}</label>}
    </div>
  )
}

interface InputDropdownProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}

export function InputDropdown({ label, value, onChange, options, disabled }: InputDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className='inputdropdown' style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <style>{`
        .inputdropdown-list {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: #252630;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.375rem;
          border-top-left-radius: 0;
          border-top-right-radius: 0;
          z-index: 10;
          max-height: 200px;
          overflow-y: auto;
        }
        .inputdropdown-option {
          padding: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
        }
        .inputdropdown-option:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .inputdropdown-option.selected {
          background: #00a7ff;
        }
      `}</style>
      {label && <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          style={{
            width: '100%',
            padding: '0.5rem',
            background: '#252630',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0.375rem',
            color: 'white',
            fontSize: '0.875rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{options.find(opt => opt.value === value)?.label || 'Select...'}</span>
          <span style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontSize: '16px' }}>▼</span>
        </div>
        {isOpen && (
          <div className='inputdropdown-list'>
            {options.map(option => (
              <div
                key={option.value}
                className={cls('inputdropdown-option', { selected: option.value === value })}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
              >
                {option.label}
              </div>
            ))}
          </div>
        )}
      </div>
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
    accept: '.glb,.vrm',
    exts: ['glb'],
    placeholder: '.glb',
  },
  texture: {
    type: 'texture',
    accept: 'image/*',
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
    accept: 'audio/*',
    exts: ['mp3'],
    placeholder: '.mp3',
  },
  video: {
    type: 'video',
    accept: 'video/*',
    exts: ['mp4'],
    placeholder: '.mp4',
  },
  script: {
    type: 'script',
    accept: '.js,.mjs,.ts',
    exts: ['js', 'mjs', 'ts'],
    placeholder: '.js / .mjs / .ts',
  },
}

interface InputFileProps {
  label?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function InputFile({ label, value, onChange, accept, disabled, placeholder }: InputFileProps) {
  const fileRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className='inputfile' style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {label && <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>{label}</label>}
      <input
        ref={fileRef}
        type='file'
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0] || null
          onChange(file)
        }}
        disabled={disabled}
        style={{ display: 'none' }}
      />
      <div
        onClick={() => !disabled && fileRef.current?.click()}
        style={{
          width: '100%',
          padding: '0.5rem',
          background: '#252630',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '0.375rem',
          color: value ? 'white' : 'rgba(255, 255, 255, 0.5)',
          fontSize: '0.875rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span style={{ fontSize: '16px' }}>📁</span>
        <span>{value ? value.name : placeholder || 'Choose file...'}</span>
      </div>
    </div>
  )
}
