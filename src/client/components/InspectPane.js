import { css } from '@firebolt-dev/css'
import { useEffect, useRef, useState } from 'react'
import {
  BoxIcon,
  CircleCheckIcon,
  DownloadIcon,
  EyeIcon,
  FileCode2Icon,
  FileIcon,
  LoaderIcon,
  PackageCheckIcon,
  XIcon,
} from 'lucide-react'

import { hashFile } from '../../core/utils-client'
import { usePane } from './usePane'
import { useUpdate } from './useUpdate'
import { cls } from './cls'
import { exportApp, isDevBuild } from '../../core/extras/appTools'
import { downloadFile } from '../../core/extras/downloadFile'

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
  const togglePreload = async () => {
    const preload = !blueprint.preload
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, preload })
    world.network.send('blueprintModified', { id: blueprint.id, version, preload })
  }
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
          align-items: center;
          padding: 0 5px 0 10px;
          &-title {
            padding-left: 7px;
            font-weight: 500;
            flex: 1;
          }
          &-btn {
            width: 30px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            &.download {
              color: ${isDevBuild() ? '#ff6161' : 'white'};
            }
          }
        }
        .apane-content {
          flex: 1;
          padding: 20px;
          max-height: 500px;
          overflow-y: auto;
        }
        .apane-info {
          display: flex;
          margin: 0 0 10px;
        }
        .apane-info-main {
          flex: 1;
        }
        .apane-info-name {
          display: block;
          flex: 1;
          height: 36px;
          background: #252630;
          border-radius: 10px;
          margin: 0 0 10px;
          padding: 0 10px;
          input {
            height: 36px;
            font-size: 14px;
          }
        }
        .apane-info-desc {
          display: block;
          flex: 1;
          min-height: 43px;
          background: #252630;
          border-radius: 10px;
          textarea {
            padding: 10px 10px 0 10px;
            min-height: 43px;
            min-width: 100%;
            max-width: 100%;
            font-size: 14px;
          }
        }
        .apane-info-icon {
          width: 88px;
          height: 88px;
          background: #252630;
          border-radius: 10px;
          margin-left: 10px;
        }
        .apane-top {
          display: flex;
          gap: 10px;
          margin: 0 0 10px;
          &-item {
            flex: 1;
            padding: 5px;
            display: flex;
            flex-direction: column;
            align-items: center;
            background: #252630;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 75px;
            cursor: pointer;
            &-icon {
              line-height: 0;
              margin: 0 0 4px;
            }
            span {
              font-size: 14px;
            }
            &.model {
              overflow: hidden;
              input {
                position: absolute;
                top: -9999px;
                left: -9999px;
              }
            }
          }
        }
        .apane-lilbtns {
          display: flex;
          gap: 10px;
          margin: 0 0 20px;
          &-btn {
            flex: 1;
            background: #252630;
            border-radius: 10px;
            padding: 8px 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            svg {
              margin: 0 0 4px;
              opacity: 0.3;
            }
            span {
              font-size: 12px;
              opacity: 0.3;
            }
            &.active {
              svg {
                opacity: 1;
              }
              span {
                opacity: 1;
              }
            }
          }
        }
      `}
    >
      <div className='apane-head' ref={headRef}>
        <EyeIcon size={20} />
        <div className='apane-head-title'>Inspect</div>
        <div className='apane-head-btn download' onClick={download}>
          <DownloadIcon size={18} />
        </div>
        <div className='apane-head-btn' onClick={() => world.emit('inspect', null)}>
          <XIcon size={20} />
        </div>
      </div>
      <div className='apane-content noscrollbar'>
        <div className='apane-top'>
          <label className='apane-top-item model'>
            <input type='file' accept='.glb,.vrm' onChange={changeModel} />
            <div className='apane-model-icon'>
              <BoxIcon size={20} />
            </div>
            <span>Model</span>
          </label>
          <div className='apane-top-item script' onClick={() => world.emit('code', true)}>
            <div className='apane-script-icon'>
              <FileCode2Icon size={20} />
            </div>
            <span>Script</span>
          </div>
        </div>
        <div className='apane-lilbtns'>
          <div className={cls('apane-lilbtns-btn', { active: blueprint.preload })} onClick={togglePreload}>
            <CircleCheckIcon size={16} />
            <span>Preload</span>
          </div>
          <div className='apane-lilbtns-btn'></div>
          <div className='apane-lilbtns-btn'></div>
          <div className='apane-lilbtns-btn'></div>
        </div>
        <Fields app={app} blueprint={blueprint} />
        {/* <div className='apane-info'>
          <div className='apane-info-main'>
            <label className='apane-info-name'>
              <input type='text' value={name} onChange={e => setName(e.target.value)} placeholder='Name' />
            </label>
            <label className='apane-info-desc'>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder='Description' />
            </label>
          </div>
          <div className='apane-info-icon' />
        </div> */}
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
  const [localValue, setLocalValue] = useState(value)
  useEffect(() => {
    if (localValue !== value) setLocalValue(value)
  }, [value])
  return (
    <FieldWithLabel label={field.label}>
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
          placeholder={field.placeholder}
          onChange={e => setLocalValue(e.target.value)}
          onKeyDown={e => {
            if (e.code === 'Enter') {
              modify(field.key, localValue)
              e.target.blur()
            }
          }}
          onBlur={e => {
            modify(field.key, localValue)
          }}
        />
      </label>
    </FieldWithLabel>
  )
}

function FieldTextArea({ world, field, value, modify }) {
  const [localValue, setLocalValue] = useState(value)
  useEffect(() => {
    if (localValue !== value) setLocalValue(value)
  }, [value])
  return (
    <FieldWithLabel label={field.label}>
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
              modify(field.key, localValue)
              e.target.blur()
            }
          }}
          onBlur={e => {
            modify(field.key, localValue)
          }}
        />
      </label>
    </FieldWithLabel>
  )
}

const supportedFiles = ['glb', 'vrm']
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
  const nRef = useRef(0)
  const update = useUpdate()
  const [loading, setLoading] = useState(null)
  const kind = kinds[field.kind]
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
      return console.error(`attempted invalid file extension for ${field.kind}: ${ext}`)
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
    await new Promise(resolve => setTimeout(resolve, 1000))
    // ignore if new value/upload
    if (nRef.current !== n) return
    // cache file locally so this client can insta-load it
    world.loader.insert(kind.type, url, file)
    // apply!
    setLoading(null)
    modify(field.key, newValue)
  }
  const remove = e => {
    e.preventDefault()
    e.stopPropagation()
    modify(field.key, null)
  }
  const n = nRef.current
  const label = loading?.name || value?.name
  return (
    <FieldWithLabel label={field.label}>
      <label
        className='field-file'
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
          .field-file-placeholder {
            flex: 1;
            font-size: 14px;
            padding: 0 5px;
            color: rgba(255, 255, 255, 0.5);
          }
          .field-file-name {
            flex: 1;
            font-size: 14px;
            padding: 0 5px;
          }
          .field-file-x {
            width: 30px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }
          .field-file-loading {
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
        {!value && !loading && <div className='field-file-placeholder'>{kind.placeholder}</div>}
        {label && <div className='field-file-name'>{label}</div>}
        {value && !loading && (
          <div className='field-file-x'>
            <XIcon size={14} onClick={remove} />
          </div>
        )}
        {loading && (
          <div className='field-file-loading'>
            <LoaderIcon size={14} />
          </div>
        )}
        <input key={n} type='file' onChange={set} accept={kind.accept} />
      </label>
    </FieldWithLabel>
  )
}

function FieldSwitch({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <div
        className='field-switch'
        css={css`
          display: flex;
          align-items: center;
          border: 1px solid #252630;
          border-radius: 10px;
          padding: 3px;
          .field-switch-option {
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
        {field.options.map(option => (
          <div
            key={option.value}
            className={cls('field-switch-option', { selected: value === option.value })}
            onClick={() => modify(field.key, option.value)}
          >
            <span>{option.label}</span>
          </div>
        ))}
      </div>
    </FieldWithLabel>
  )
}