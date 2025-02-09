import { css } from '@firebolt-dev/css'
import { useEffect, useRef, useState } from 'react'
import {
  BoxIcon,
  CircleCheckIcon,
  DownloadIcon,
  EarthIcon,
  EyeIcon,
  FileCode2Icon,
  FileIcon,
  LoaderIcon,
  LockKeyhole,
  PackageCheckIcon,
  ShuffleIcon,
  XIcon,
} from 'lucide-react'

import { hashFile } from '../../core/utils-client'
import { usePane } from './usePane'
import { useUpdate } from './useUpdate'
import { cls } from './cls'
import { exportApp } from '../../core/extras/appTools'
import { downloadFile } from '../../core/extras/downloadFile'
import { clamp, hasRole } from '../../core/utils'
import { isNumber } from 'lodash-es'

export function InspectPane({ world, entity }) {
  if (entity.isApp) {
    return <AppPane world={world} app={entity} />
  }
  if (entity.isPlayer) {
    return <PlayerPane world={world} player={entity} />
  }
}

const extToType = {
  glb: 'model',
  vrm: 'avatar',
}
const allowedModels = ['glb', 'vrm']

export function AppPane({ world, app }) {
  const paneRef = useRef()
  const headRef = useRef()
  const [blueprint, setBlueprint] = useState(app.blueprint)
  const canEdit = !blueprint.frozen && hasRole(world.entities.player.data.user.roles, 'admin', 'builder')
  const [tab, setTab] = useState(canEdit ? 'edit' : 'overview')
  usePane('inspect', paneRef, headRef)
  useEffect(() => {
    window.app = app
  }, [])
  useEffect(() => {
    const onModify = bp => {
      if (bp.id !== blueprint.id) return
      setBlueprint(bp)
    }
    world.blueprints.on('modify', onModify)
    return () => {
      world.blueprints.off('modify', onModify)
    }
  }, [])
  const download = async () => {
    try {
      const file = await exportApp(app.blueprint, world.loader.loadFile)
      downloadFile(file)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div
      ref={paneRef}
      className='apane'
      css={css`
        position: absolute;
        top: 20px;
        left: 20px;
        width: 320px;
        background: rgba(22, 22, 28, 1);
        border: 1px solid rgba(255, 255, 255, 0.03);
        border-radius: 10px;
        box-shadow: rgba(0, 0, 0, 0.5) 0px 10px 30px;
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        .apane-head {
          height: 40px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          padding: 0 5px 0 16px;
          &-tab {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 16px 0 0;
            cursor: pointer;
            span {
              font-size: 14px;
              color: #595959;
            }
            &.selected {
              border-bottom: 1px solid white;
              margin-bottom: -1px;
              span {
                color: white;
              }
            }
          }
          &-gap {
            flex: 1;
          }
          &-close {
            color: #515151;
            width: 30px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            &:hover {
              cursor: pointer;
              color: white;
            }
          }
        }
        .apane-download {
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          svg {
            margin-right: 8px;
          }
          span {
            font-size: 14px;
          }
          &:hover {
            cursor: pointer;
          }
        }
      `}
    >
      <div className='apane-head' ref={headRef}>
        <div className={cls('apane-head-tab', { selected: tab === 'overview' })} onClick={() => setTab('overview')}>
          <span>Overview</span>
        </div>
        {canEdit && (
          <div className={cls('apane-head-tab', { selected: tab === 'edit' })} onClick={() => setTab('edit')}>
            <span>Edit</span>
          </div>
        )}
        <div className='apane-head-gap' />
        <div className='apane-head-close' onClick={() => world.emit('inspect', null)}>
          <XIcon size={20} />
        </div>
      </div>
      {tab === 'overview' && (
        <>
          <AppPaneOverview world={world} app={app} blueprint={blueprint} />
          <div className='apane-download' onClick={download}>
            <DownloadIcon size={16} />
            <span>Download</span>
          </div>
        </>
      )}
      {tab === 'edit' && <AppPaneEdit world={world} app={app} blueprint={blueprint} />}
    </div>
  )
}

function AppPaneOverview({ world, app, blueprint }) {
  const isFields = true
  return (
    <div
      className='aoverview noscrollbar'
      css={css`
        flex: 1;
        padding: 20px 20px 10px;
        max-height: 500px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        .aoverview-image {
          align-self: center;
          width: 120px;
          height: 120px;
          background-color: #252630;
          background-image: ${blueprint.image ? `url(${resolveURL(blueprint.image.url)})` : 'none'};
          background-position: center;
          background-size: cover;
          border-radius: 10px;
          margin: 0 0 16px;
        }
        .aoverview-name {
          text-align: center;
          font-size: 18px;
          font-weight: 500;
          margin: 0 0 5px;
        }
        .aoverview-author {
          text-align: center;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 20px;
          a {
            color: #00a7ff;
          }
        }
        .aoverview-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 10px;
        }
        .aoverview-fields {
          margin-top: 20px;
        }
      `}
    >
      <div className='aoverview-image' />
      <div className='aoverview-name'>{blueprint.name || 'Untitled'}</div>
      <div className='aoverview-author'>
        <span>by </span>
        {blueprint.url && (
          <a href={resolveURL(blueprint.url)} target='_blank'>
            {blueprint.author || 'Unknown'}
          </a>
        )}
        {!blueprint.url && <span>{blueprint.author || 'Unknown'}</span>}
      </div>
      {blueprint.desc && <div className='aoverview-desc'>{blueprint.desc}</div>}
      {isFields && (
        <div className='aoverview-fields'>
          <Fields app={app} blueprint={blueprint} />
        </div>
      )}
    </div>
  )
}

function AppPaneEdit({ world, app, blueprint }) {
  const changeModel = async e => {
    const file = e.target.files[0]
    if (!file) return
    const ext = file.name.split('.').pop()
    if (!allowedModels.includes(ext)) return
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as glb filename
    const filename = `${hash}.${ext}`
    // canonical url to this file
    const url = `asset://${filename}`
    // cache file locally so this client can insta-load it
    const type = extToType[ext]
    world.loader.insert(type, url, file)
    // update blueprint locally (also rebuilds apps)
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, model: url })
    // upload model
    await world.network.upload(file)
    // broadcast blueprint change to server + other clients
    world.network.send('blueprintModified', { id: blueprint.id, version, model: url })
  }
  const editCode = () => {
    world.emit('code', true)
  }
  const set = async (key, value) => {
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, [key]: value })
    world.network.send('blueprintModified', { id: blueprint.id, version, [key]: value })
  }
  const toggle = async key => {
    const value = !blueprint[key]
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, [key]: value })
    world.network.send('blueprintModified', { id: blueprint.id, version, [key]: value })
  }
  return (
    <div
      className='aedit noscrollbar'
      css={css`
        flex: 1;
        padding: 20px;
        max-height: 500px;
        overflow-y: auto;
        .aedit-top {
          display: flex;
          gap: 10px;
          margin: 0 0 20px;
          &-btn {
            flex: 1;
            background: #252630;
            border-radius: 10px;
            height: 78px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            cursor: pointer;
            input {
              position: absolute;
              top: -9999px;
            }
            svg {
              margin: 0 0 10px;
            }
            span {
              font-size: 14px;
            }
          }
        }
        .aedit-field {
          display: flex;
          align-items: center;
          margin: 0 0 10px;
          &-label {
            width: 90px;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.5);
          }
          &-input {
            flex: 1;
          }
        }
        .aedit-btm {
          margin-top: 40px;
          display: flex;
          gap: 10px;
          &-btn {
            flex: 1;
            background: #252630;
            border-radius: 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 10px 0;
            color: #606275;
            cursor: pointer;
            svg {
              margin: 0 0 5px;
            }
            span {
              font-size: 12px;
            }
            &.active {
              color: white;
            }
          }
        }
      `}
    >
      <div className='aedit-top'>
        <label className='aedit-top-btn'>
          <input type='file' accept='.glb,.vrm' onChange={changeModel} />
          <BoxIcon size={20} />
          <span>Change Model</span>
        </label>
        <div className='aedit-top-btn' onClick={editCode}>
          <FileCode2Icon size={20} />
          <span>Edit Code</span>
        </div>
      </div>
      <div className='aedit-field'>
        <div className='aedit-field-label'>Name</div>
        <div className='aedit-field-input'>
          <InputText value={blueprint.name} onChange={name => set('name', name)} />
        </div>
      </div>
      <div className='aedit-field'>
        <div className='aedit-field-label'>Image</div>
        <div className='aedit-field-input'>
          <InputFile world={world} kind='texture' value={blueprint.image} onChange={image => set('image', image)} />
        </div>
      </div>
      <div className='aedit-field'>
        <div className='aedit-field-label'>Author</div>
        <div className='aedit-field-input'>
          <InputText value={blueprint.author} onChange={author => set('author', author)} />
        </div>
      </div>
      <div className='aedit-field'>
        <div className='aedit-field-label'>URL</div>
        <div className='aedit-field-input'>
          <InputText value={blueprint.url} onChange={url => set('url', url)} />
        </div>
      </div>
      <div className='aedit-field'>
        <div className='aedit-field-label'>Description</div>
        <div className='aedit-field-input'>
          <InputTextarea value={blueprint.desc} onChange={desc => set('desc', desc)} />
        </div>
      </div>
      <div className='aedit-btm'>
        <div className={cls('aedit-btm-btn', { active: blueprint.preload })} onClick={() => toggle('preload')}>
          <CircleCheckIcon size={16} />
          <span>Preload</span>
        </div>
        <div className={cls('aedit-btm-btn', { active: blueprint.public })} onClick={() => toggle('public')}>
          <EarthIcon size={16} />
          <span>Public</span>
        </div>
        <div className={cls('aedit-btm-btn', { active: blueprint.locked })} onClick={() => toggle('locked')}>
          <LockKeyhole size={16} />
          <span>Lock</span>
        </div>
      </div>
    </div>
  )
}

function PlayerPane({ world, player }) {
  return <div>PLAYER INSPECT</div>
}

function Fields({ app, blueprint }) {
  const world = app.world
  const [fields, setFields] = useState(app.fields)
  const props = blueprint.props
  useEffect(() => {
    app.onFields = setFields
    return () => {
      app.onFields = null
    }
  }, [])
  const modify = (key, value) => {
    if (props[key] === value) return
    props[key] = value
    // update blueprint locally (also rebuilds apps)
    const id = blueprint.id
    const version = blueprint.version + 1
    world.blueprints.modify({ id, version, props })
    // broadcast blueprint change to server + other clients
    world.network.send('blueprintModified', { id, version, props })
  }
  return fields.map(field => (
    <Field key={field.key} world={world} props={props} field={field} value={props[field.key]} modify={modify} />
  ))
}

const fieldTypes = {
  section: FieldSection,
  text: FieldText,
  textarea: FieldTextArea,
  number: FieldNumber,
  file: FieldFile,
  switch: FieldSwitch,
}

function Field({ world, props, field, value, modify }) {
  if (field.when) {
    for (const rule of field.when) {
      if (rule.op === 'eq' && props[rule.key] !== rule.value) {
        return null
      }
    }
  }
  const FieldControl = fieldTypes[field.type]
  if (!FieldControl) return null
  return <FieldControl world={world} field={field} value={value} modify={modify} />
}

function FieldWithLabel({ label, children }) {
  return (
    <div
      className='fieldwlabel'
      css={css`
        display: flex;
        align-items: center;
        margin: 0 0 10px;
        .fieldwlabel-label {
          width: 90px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }
        .fieldwlabel-content {
          flex: 1;
        }
      `}
    >
      <div className='fieldwlabel-label'>{label}</div>
      <div className='fieldwlabel-content'>{children}</div>
    </div>
  )
}

function FieldSection({ world, field, value, modify }) {
  return (
    <div
      className='fieldsection'
      css={css`
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        margin: 20px 0 14px;
        padding: 16px 0 0 0;
        .fieldsection-label {
          font-size: 14px;
          font-weight: 400;
          line-height: 1;
        }
      `}
    >
      <div className='fieldsection-label'>{field.label}</div>
    </div>
  )
}

function FieldText({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputText value={value} onChange={value => modify(field.key, value)} placeholder={field.placeholder} />
    </FieldWithLabel>
  )
}

function FieldTextArea({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputTextarea value={value} onChange={value => modify(field.key, value)} placeholder={field.placeholder} />
    </FieldWithLabel>
  )
}

function FieldNumber({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputNumber
        value={value}
        onChange={value => modify(field.key, value)}
        dp={field.dp}
        min={field.min}
        max={field.max}
        step={field.step}
      />
    </FieldWithLabel>
  )
}

const kinds = {
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
    accept: '.jpg,.jpeg,.png',
    exts: ['jpg', 'jpeg', 'png'],
    placeholder: '.jpg / .png',
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

function FieldFile({ world, field, value, modify }) {
  const kind = kinds[field.kind]
  if (!kind) return null
  return (
    <FieldWithLabel label={field.label}>
      <InputFile world={world} kind={field.kind} value={value} onChange={value => modify(field.key, value)} />
    </FieldWithLabel>
  )
}

function FieldSwitch({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputSwitch options={field.options} value={value} onChange={value => modify(field.key, value)} />
    </FieldWithLabel>
  )
}

function InputText({ value, onChange, placeholder }) {
  const [localValue, setLocalValue] = useState(value)
  useEffect(() => {
    if (localValue !== value) setLocalValue(value)
  }, [value])
  return (
    <label
      css={css`
        display: block;
        background-color: #252630;
        border-radius: 10px;
        padding: 0 8px;
        cursor: text;
        input {
          height: 34px;
          font-size: 14px;
        }
      `}
    >
      <input
        type='text'
        value={localValue || ''}
        placeholder={placeholder}
        onChange={e => setLocalValue(e.target.value)}
        onKeyDown={e => {
          if (e.code === 'Enter') {
            onChange(localValue)
            e.target.blur()
          }
        }}
        onBlur={e => {
          onChange(localValue)
        }}
      />
    </label>
  )
}

function InputTextarea({ value, onChange, placeholder }) {
  const [localValue, setLocalValue] = useState(value)
  useEffect(() => {
    if (localValue !== value) setLocalValue(value)
  }, [value])
  return (
    <label
      css={css`
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
      `}
    >
      <textarea
        value={localValue || ''}
        onChange={e => setLocalValue(e.target.value)}
        onKeyDown={e => {
          if (e.metaKey && e.code === 'Enter') {
            onChange(localValue)
            e.target.blur()
          }
        }}
        onBlur={e => {
          onChange(localValue)
        }}
        placeholder={placeholder}
      />
    </label>
  )
}

function InputNumber({ value, onChange, dp = 0, min = -Infinity, max = Infinity, step = 1 }) {
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
      css={css`
        display: block;
        background-color: #252630;
        border-radius: 10px;
        padding: 0 8px;
        cursor: text;
        input {
          height: 34px;
          font-size: 14px;
        }
      `}
    >
      <input
        type='text'
        value={local}
        onChange={e => setLocal(e.target.value)}
        onKeyDown={e => {
          if (e.code === 'Enter') {
            e.target.blur()
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
    </label>
  )
}

function InputSwitch({ options, value, onChange }) {
  return (
    <div
      className='inputswitch'
      css={css`
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
      `}
    >
      {options.map(option => (
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

function InputFile({ world, kind: kindName, value, onChange }) {
  const nRef = useRef(0)
  const update = useUpdate()
  const [loading, setLoading] = useState(null)
  const kind = kinds[kindName]
  if (!kind) return null
  const set = async e => {
    // trigger input rebuild
    const n = ++nRef.current
    update()
    // get file
    const file = e.target.files[0]
    if (!file) return
    // check ext
    const ext = file.name.split('.')[1]
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
    // apply!
    setLoading(null)
    onChange(newValue)
  }
  const remove = e => {
    e.preventDefault()
    e.stopPropagation()
    onChange(null)
  }
  const n = nRef.current
  const label = loading?.name || value?.name
  return (
    <label
      className='inputfile'
      css={css`
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
      `}
    >
      <FileIcon size={14} />
      {!value && !loading && <div className='inputfile-placeholder'>{kind.placeholder}</div>}
      {label && <div className='inputfile-name'>{label}</div>}
      {value && !loading && (
        <div className='inputfile-x'>
          <XIcon size={14} onClick={remove} />
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

function resolveURL(url) {
  url = url.trim()
  if (url.startsWith('asset://')) {
    return url.replace('asset:/', process.env.PUBLIC_ASSETS_URL)
  }
  if (url.match(/^https?:\/\//i)) {
    return url
  }
  if (url.startsWith('//')) {
    return `https:${url}`
  }
  return `https://${url}`
}
