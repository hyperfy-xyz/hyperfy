import { css } from '@firebolt-dev/css'
import { useEffect, useRef, useState, useCallback } from 'react'
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
  LockIcon,
  UnlockIcon,
  CopyIcon,
  ClipboardIcon,
  HandIcon
} from 'lucide-react'
import * as THREE from 'three'

import { hashFile } from '../../core/utils-client'
import { usePane } from './usePane'
import { useUpdate } from './useUpdate'
import { cls } from './cls'
import { exportApp, isDevBuild } from '../../core/extras/appTools'
import { downloadFile } from '../../core/extras/downloadFile'

// Add a global store for copied values
const copiedValues = {
  current: null
}

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
  const [frozen, setFrozen] = useState(app.frozen || false)
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
  useEffect(() => {
    const onUpdate = () => {
      setFrozen(app.frozen)
    }
    app.on('update', onUpdate)
    return () => app.off('update', onUpdate)
  }, [app])
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
  const togglePreload = () => {
    const preload = !blueprint.preload
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, preload })
    world.network.send('blueprintModified', { id: blueprint.id, version, preload })
  }
  const toggleLock = () => {
    const newValue = !frozen
    app.frozen = newValue
    world.network.send('entityModified', {
      id: app.data.id,
      frozen: newValue
    })
    setFrozen(newValue)
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
            position: relative;
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

            .hypertip {
              position: absolute;
              bottom: calc(100% + 10px);
              left: 50%;
              transform: translateX(-50%);
              background: linear-gradient(
                90deg,
                #D90479,
                #A61C81,
                #8E37A6,
                #2975D9,
                #D90479
              );
              background-size: 500% 100%;
              animation: gradient 10s linear infinite;
              border-radius: 4px;
              padding: 4px 8px;
              font-size: 14px;
              line-height: 1.3;
              color: rgba(255, 255, 255, 0.9);
              pointer-events: none;
              z-index: 1000;
              text-align: left;
              opacity: 0;
              visibility: hidden;
              transition: opacity 0.15s ease, visibility 0.15s ease;
              width: max-content;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
              text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);

              &.right {
                bottom: auto;
                left: calc(100% + 15px);
                top: 50%;
                transform: translateY(-50%);
                z-index: 1001;
              }
            }

            &:hover .hypertip {
              opacity: 1;
              visibility: visible;
            }
          }
        }

        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
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
      <div className='apane-content noscrollbar' css={css`
        .hypertip {
          position: absolute;
          bottom: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(
            90deg,
            #D90479,
            #A61C81,
            #8E37A6,
            #2975D9,
            #D90479
          );
          background-size: 500% 100%;
          animation: gradient 10s linear infinite;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 14px;
          line-height: 1.3;
          color: rgba(255, 255, 255, 0.9);
          pointer-events: none;
          z-index: 1000;
          text-align: left;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.15s ease, visibility 0.15s ease;
          width: max-content;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        }

        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .apane-lilbtns-btn {
          position: relative;
          &:hover .hypertip {
            opacity: 1;
            visibility: visible;
          }
        }
      `}>
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
            <div className="hypertip right">
              Load this object<br />before the world loads.
            </div>
          </div>
          <div className={cls('apane-lilbtns-btn', { active: frozen })} onClick={toggleLock}>
            {frozen ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
            <span>Lock</span>
            <div className="hypertip">
              Lock position, rotation and scale.<br />Prevents accidental changes.
            </div>
          </div>
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
  const [position, setPosition] = useState(app.root?.position || new THREE.Vector3())
  const [rotation, setRotation] = useState(app.root?.rotation || new THREE.Euler())
  const [scale, setScale] = useState(app.root?.scale || new THREE.Vector3(1, 1, 1))
  const [frozen, setFrozen] = useState(app.frozen || false)
  const props = blueprint.props || {}

  // Update state when app changes
  useEffect(() => {
    const onUpdate = () => {
      if (app.root) {
        setPosition(app.root.position.clone())
        setRotation(app.root.rotation.clone())
        setScale(app.root.scale.clone())
      }
      setFrozen(app.frozen)
    }

    // Initial update
    onUpdate()

    // Subscribe to updates
    app.on('update', onUpdate)
    return () => app.off('update', onUpdate)
  }, [app])

  // Add transform fields
  const transformFields = [
    {
      type: 'section',
      key: 'transform',
      label: 'Transform',
    },
    {
      type: 'vector3',
      key: 'position',
      label: 'Position',
      value: position,
    },
    {
      type: 'euler',
      key: 'rotation',
      label: 'Rotation',
      value: rotation,
    },
    {
      type: 'vector3',
      key: 'scale',
      label: 'Scale',
      value: scale,
    },
    ...fields
  ]

  useEffect(() => {
    app.onFields = setFields
    return () => {
      app.onFields = null
    }
  }, [])

  const modify = (key, value) => {
    if (props[key] === value) return

    // Don't allow transform changes if frozen
    if ((key === 'position' || key === 'rotation' || key === 'scale') && app.frozen) return

    // Handle transform updates
    if (key === 'position' && app.root) {
      app.root.position.copy(value)
      app.data.position = value.toArray()
      world.network.send('entityModified', {
        id: app.data.id,
        position: app.data.position
      })
      if (app.networkPos) {
        app.networkPos.pushArray(app.data.position)
      }
      setPosition(value.clone())
      return
    }

    if (key === 'rotation' && app.root) {
      // Ensure we maintain the same rotation order
      const euler = value.clone()
      euler.order = 'YXZ' // Match the app's rotation order

      app.root.rotation.copy(euler)
      const quaternion = new THREE.Quaternion().setFromEuler(euler)
      app.data.quaternion = quaternion.toArray()

      world.network.send('entityModified', {
        id: app.data.id,
        quaternion: app.data.quaternion
      })

      if (app.networkQuat) {
        app.networkQuat.pushArray(app.data.quaternion)
      }

      setRotation(euler)
      return
    }

    if (key === 'scale' && app.root) {
      app.root.scale.copy(value)
      app.data.scale = value.toArray()
      world.network.send('entityModified', {
        id: app.data.id,
        scale: app.data.scale
      })
      setScale(value.clone())
      return
    }

    if (key === 'frozen') {
      app.frozen = value
      world.network.send('entityModified', {
        id: app.data.id,
        frozen: value
      })
      setFrozen(value)
      return
    }

    // Handle TOD switch
    if (key === 'tod') {
      props[key] = value

      // update blueprint locally (also rebuilds apps)
      const id = blueprint.id
      const version = blueprint.version + 1
      world.blueprints.modify({ id, version, props })

      // broadcast blueprint change to server + other clients
      world.network.send('blueprintModified', { id, version, props })
      return
    }

    // Update config for other fields
    config[key] = value

    // update blueprint locally (also rebuilds apps)
    const id = blueprint.id
    const version = blueprint.version + 1
    world.blueprints.modify({ id, version, config })

    // broadcast blueprint change to server + other clients
    world.network.send('blueprintModified', { id, version, config })
  }

  return transformFields.map(field => (
    <Field key={field.key} world={world} props={props} field={field} value={props[field.key] ?? field.value} modify={modify} />
  ))
}

const fieldTypes = {
  section: FieldSection,
  text: FieldText,
  textarea: FieldTextArea,
  file: FieldFile,
  switch: FieldSwitch,
  vector3: FieldVector3,
  euler: FieldEuler,
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

function FieldWithLabel({ label, field, value, modify, children }) {
  const [hasCopiedValues, setHasCopiedValues] = useState(false)
  const isTransformField = field?.type === 'vector3' || field?.type === 'euler'

  const handleCopy = () => {
    if (!isTransformField || !value) return
    copiedValues.current = {
      type: field.type,
      value: value.toArray()
    }
    setHasCopiedValues(true)
  }

  const handlePaste = () => {
    if (!isTransformField || !copiedValues.current) return
    if (copiedValues.current.type !== field.type) return

    const newValue = field.type === 'euler'
      ? new THREE.Euler().fromArray(copiedValues.current.value)
      : new THREE.Vector3().fromArray(copiedValues.current.value)

    modify(field.key, newValue)
  }

  useEffect(() => {
    setHasCopiedValues(!!copiedValues.current && copiedValues.current.type === field.type)
  }, [field?.type])

  return (
    <div
      className='fieldwlabel'
      css={css`
        margin: 0 0 10px;
        position: relative;
        
        .fieldwlabel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
          height: 24px;
        }
        margin: 0 0 10px;
        position: relative;
        
        .fieldwlabel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
          height: 24px;
        }
        .fieldwlabel-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }
        .fieldwlabel-content {
          width: 100%;
        }
        .transform-controls {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .transform-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          background: #252630;
          cursor: pointer;
          &:hover {
            background: #2f3040;
          }
          svg {
            width: 14px;
            height: 14px;
            color: rgba(255, 255, 255, 0.5);
          }
          &:hover svg {
            color: rgba(255, 255, 255, 0.8);
          }
        }
      `}
    >
      <div className='fieldwlabel-header'>
        <div className='fieldwlabel-label'>
          {label}
          {isTransformField && (
            <div className='transform-controls'>
              <div
                className='transform-button'
                onClick={handleCopy}
                title='Copy values'
              >
                <CopyIcon size={14} />
              </div>
              {hasCopiedValues && (
                <div
                  className='transform-button'
                  onClick={handlePaste}
                  title='Paste copied values'
                >
                  <ClipboardIcon size={14} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className='fieldwlabel-content'>
        {children}
      </div>
    </div>
  )
}

function FieldSection({ world, field, value, modify }) {
  const handleReset = () => {
    if (field.label === 'Transform') {
      modify('position', new THREE.Vector3(0, 0, 0))
      modify('rotation', new THREE.Euler(0, 0, 0))
      modify('scale', new THREE.Vector3(1, 1, 1))
    }
  }

  return (
    <div
      className='fieldsection'
      css={css`
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        margin: 20px 0 14px;
        padding: 16px 0 0 0;
        position: relative;
        
        .fieldsection-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .fieldsection-label {
          font-size: 14px;
          font-weight: 400;
          line-height: 1;
          cursor: ${field.label === 'Transform' ? 'help' : 'default'};
          display: inline-block;
          position: relative;
        }

        .reset-button {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 20px;
          padding: 0 8px;
          border-radius: 4px;
          background: #252630;
          cursor: pointer;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          &:hover {
            background: #2f3040;
            color: rgba(255, 255, 255, 0.8);
          }
        }

        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .tooltip {
          position: absolute;
          top: -28px;
          left: 0;
          background: linear-gradient(
            90deg,
            #D90479,
            #A61C81,
            #8E37A6,
            #2975D9,
            #D90479
          );
          background-size: 500% 100%;
          animation: gradient 10s linear infinite;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 14px;
          line-height: 1.3;
          color: rgba(255, 255, 255, 0.9);
          pointer-events: none;
          z-index: 1000;
          text-align: left;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.15s ease, visibility 0.15s ease;
          width: max-content;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        }

        .fieldsection-label:hover .tooltip {
          opacity: 1;
          visibility: visible;
        }
      `}
    >
      <div className='fieldsection-header'>
        <div className='fieldsection-label'>
          {field.label}
          {field.label === 'Transform' && (
            <div className="tooltip">
              Hold Ctrl + drag to adjust values. <br />Hold Shift for fine control.
            </div>
          )}
        </div>
        {field.label === 'Transform' && (
          <div className="reset-button" onClick={handleReset}>
            Reset
          </div>
        )}
      </div>
    </div>
  )
}

function FieldText({ world, field, value, modify }) {
  const [localValue, setLocalValue] = useState(value)
  useEffect(() => {
    if (localValue !== value) setLocalValue(value)
  }, [value])
  return (
    <FieldWithLabel label={field.label} field={field} value={value} modify={modify}>
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
    <FieldWithLabel label={field.label} field={field} value={value} modify={modify}>
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
    <FieldWithLabel label={field.label} field={field} value={value} modify={modify}>
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
    <FieldWithLabel label={field.label} field={field} value={value} modify={modify}>
      <div
        className='field-switch'
        css={css`
          display: flex;
          align-items: center;
          border: 1px solid #252630;
          border-radius: 10px;
          padding: 3px;
          background: rgba(0, 0, 0, 0.2);
          .field-switch-option {
            flex: 1;
            border-radius: 7px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            span {
              line-height: 1;
              font-size: 14px;
              transition: color 0.2s ease;
            }
            &:hover:not(.selected) {
              background: rgba(37, 38, 48, 0.5);
            }
            &.selected {
              background: #252630;
              span {
                color: #fff;
              }
            }
            &:not(.selected) span {
              color: rgba(255, 255, 255, 0.5);
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

function DraggableNumberInput({ value, onChange, step = 0.1, className = '' }) {
  const [isDragging, setIsDragging] = useState(false)
  const [localValue, setLocalValue] = useState(value?.toString())
  const startY = useRef(0)
  const startValue = useRef(0)

  useEffect(() => {
    setLocalValue(value?.toString())
  }, [value])

  const evaluateExpression = (expr) => {
    try {
      // Replace common math functions with Math equivalents
      const sanitized = expr.replace(/[^0-9+\-*/().]/g, '')
      // eslint-disable-next-line no-new-func
      return Function(`return ${sanitized}`)()
    } catch (err) {
      return value // Return original value if evaluation fails
    }
  }

  const handleMouseDown = (e) => {
    if (e.target.type === 'text' && e.ctrlKey) {
      e.preventDefault()
      setIsDragging(true)
      startY.current = e.clientY
      startValue.current = parseFloat(value) || 0

      const handleMouseMove = (e) => {
        const delta = startY.current - e.clientY
        const multiplier = e.shiftKey ? 0.1 : 1 // Fine control with shift
        const newValue = startValue.current + (delta * step * multiplier)
        onChange(Number(newValue.toFixed(3))) // Round to 3 decimal places
      }

      const handleMouseUp = () => {
        setIsDragging(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
  }

  const handleChange = (e) => {
    setLocalValue(e.target.value)
  }

  const handleBlur = () => {
    const evaluated = evaluateExpression(localValue)
    if (!isNaN(evaluated)) {
      onChange(Number(evaluated))
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const evaluated = evaluateExpression(localValue)
      if (!isNaN(evaluated)) {
        onChange(Number(evaluated))
        e.target.blur()
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const increment = e.shiftKey ? step * 10 : step
      const currentValue = parseFloat(value) || 0
      const newValue = e.key === 'ArrowUp'
        ? currentValue + increment
        : currentValue - increment
      onChange(Number(newValue.toFixed(3)))
    }
  }

  return (
    <input
      type="text"
      value={isDragging ? Number(value).toFixed(3) : localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      className={className}
      css={css`
        cursor: ${props => props.ctrlKey ? 'ns-resize' : 'text'};
        user-select: none;
        &::-webkit-inner-spin-button,
        &::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        -moz-appearance: textfield;
      `}
      onMouseMove={(e) => {
        e.target.style.cursor = e.ctrlKey ? 'ns-resize' : 'text'
      }}
    />
  )
}

function FieldVector3({ world, field, value, modify }) {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    if (localValue !== value) setLocalValue(value)
  }, [value])

  return (
    <FieldWithLabel label={field.label} field={field} value={value} modify={modify}>
      <div
        css={css`
          display: flex;
          gap: 8px;
          label {
            flex: 1;
            display: block;
            background-color: #252630;
            border-radius: 10px;
            padding: 0 8px;
            cursor: text;
            input {
              height: 34px;
              font-size: 14px;
              width: 100%;
            }
          }
        `}
      >
        <label>
          <DraggableNumberInput
            value={localValue.x || 0}
            onChange={(newValue) => {
              const newVector = new THREE.Vector3(newValue, localValue.y, localValue.z)
              setLocalValue(newVector)
              modify(field.key, newVector)
            }}
            step={field.key === 'scale' ? 0.01 : 0.1}
          />
        </label>
        <label>
          <DraggableNumberInput
            value={localValue.y || 0}
            onChange={(newValue) => {
              const newVector = new THREE.Vector3(localValue.x, newValue, localValue.z)
              setLocalValue(newVector)
              modify(field.key, newVector)
            }}
            step={field.key === 'scale' ? 0.01 : 0.1}
          />
        </label>
        <label>
          <DraggableNumberInput
            value={localValue.z || 0}
            onChange={(newValue) => {
              const newVector = new THREE.Vector3(localValue.x, localValue.y, newValue)
              setLocalValue(newVector)
              modify(field.key, newVector)
            }}
            step={field.key === 'scale' ? 0.01 : 0.1}
          />
        </label>
      </div>
    </FieldWithLabel>
  )
}

function FieldEuler({ world, field, value, modify }) {
  const [localValue, setLocalValue] = useState(value)
  const [inputValues, setInputValues] = useState({
    x: (value.x * 180 / Math.PI) || 0,
    y: (value.y * 180 / Math.PI) || 0,
    z: (value.z * 180 / Math.PI) || 0
  })
  const eulerRef = useRef(new THREE.Euler())
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (localValue !== value) {
      eulerRef.current.copy(value)
      setLocalValue(value)
      setInputValues({
        x: (value.x * 180 / Math.PI) || 0,
        y: (value.y * 180 / Math.PI) || 0,
        z: (value.z * 180 / Math.PI) || 0
      })
    }
  }, [value])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleChange = useCallback((axis, value) => {
    // Update the input value immediately for responsiveness
    setInputValues(prev => ({
      ...prev,
      [axis]: value
    }))

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set a new timeout to update the actual rotation
    timeoutRef.current = setTimeout(() => {
      const radians = value * Math.PI / 180
      eulerRef.current.copy(localValue)
      eulerRef.current[axis] = radians
      setLocalValue(eulerRef.current)
      modify(field.key, eulerRef.current)
    }, 100) // 100ms debounce
  }, [localValue, modify, field.key])

  return (
    <FieldWithLabel label={field.label} field={field} value={value} modify={modify}>
      <div
        css={css`
          display: flex;
          gap: 8px;
          label {
            flex: 1;
            display: block;
            background-color: #252630;
            border-radius: 10px;
            padding: 0 8px;
            cursor: text;
            input {
              height: 34px;
              font-size: 14px;
              width: 100%;
            }
          }
        `}
      >
        <label>
          <DraggableNumberInput
            value={inputValues.x}
            onChange={(val) => handleChange('x', val)}
            step={1}
          />
        </label>
        <label>
          <DraggableNumberInput
            value={inputValues.y}
            onChange={(val) => handleChange('y', val)}
            step={1}
          />
        </label>
        <label>
          <DraggableNumberInput
            value={inputValues.z}
            onChange={(val) => handleChange('z', val)}
            step={1}
          />
        </label>
      </div>
    </FieldWithLabel>
  )
}