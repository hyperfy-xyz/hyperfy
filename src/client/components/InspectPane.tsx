import {
  BlendIcon,
  BoxIcon,
  CircleCheckIcon,
  CircleIcon,
  DownloadIcon,
  DumbbellIcon,
  EarthIcon,
  EyeIcon,
  FileCode2Icon,
  FolderIcon,
  LayersIcon,
  LockKeyholeIcon,
  MagnetIcon,
  PersonStandingIcon,
  SparkleIcon,
  Trash2Icon,
  XIcon,
  ZapIcon
} from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { isArray } from 'lodash-es'
import { exportApp } from '../../core/extras/appTools'
import { downloadFile } from '../../core/extras/downloadFile'
import { hasRole } from '../../core/utils'
import { hashFile } from '../../core/utils-client'
import { cls } from './cls'
import {
  fileKinds,
  InputDropdown,
  InputFile,
  InputNumber,
  InputRange,
  InputSwitch,
  InputText,
  InputTextarea,
} from './Inputs'
import { usePane } from './usePane'

interface InspectPaneProps {
  world: any;
  entity: any;
}

export function InspectPane({ world, entity }: InspectPaneProps) {
  if (entity.isApp) {
    return <AppPane world={world} app={entity} />
  }
  if (entity.isPlayer) {
    return <PlayerPane world={world} player={entity} />
  }
  return null
}

const extToType: Record<string, string> = {
  glb: 'model',
  vrm: 'avatar',
}
const allowedModels = ['glb', 'vrm']

interface AppPaneProps {
  world: any;
  app: any;
}

export function AppPane({ world, app }: AppPaneProps) {
  const paneRef = useRef<HTMLDivElement | null>(null)
  const headRef = useRef<HTMLDivElement | null>(null)
  const [blueprint, setBlueprint] = useState(app.blueprint)
  const canEdit = !blueprint.frozen && hasRole(world.entities.player.data.roles, 'admin', 'builder')
  const [tab, setTab] = useState('main')
  usePane('inspect', paneRef, headRef)
  useEffect(() => {
    (window as any).app = app
  }, [app])
  useEffect(() => {
    const onModify = (bp: any) => {
      if (bp.id !== blueprint.id) return
      setBlueprint(bp)
    }
    world.blueprints.on('modify', onModify)
    return () => {
      world.blueprints.off('modify', onModify)
    }
  }, [world.blueprints, blueprint.id])
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
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        width: '320px',
        maxHeight: 'calc(100vh - 40px)',
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
        .apane-head {
          height: 50px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          padding: 0 10px;
        }
        .apane-head-icon {
            width: 60px;
            height: 40px;
            display: flex;
            align-items: center;
        }
        .apane-head-icon svg {
              margin-left: 10px;
            }
        .apane-head-tabs {
            flex: 1;
            align-self: stretch;
            display: flex;
            justify-content: center;
          }
        .apane-head-tab {
            align-self: stretch;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 16px 0 0;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.5);
        }
        .apane-head-tab:hover:not(.active) {
              cursor: pointer;
              color: rgba(255, 255, 255, 0.7);
            }
        .apane-head-tab.active {
              border-bottom: 1px solid white;
              margin-bottom: -1px;
              color: white;
            }
        .apane-head-btns {
            width: 60px;
            display: flex;
            align-items: center;
        }
        .apane-head-btns.right {
              justify-content: flex-end;
            }
        .apane-head-btn {
            color: #515151;
            width: 30px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .apane-head-btn:hover {
              cursor: pointer;
              color: white;
        }
        .apane-download {
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .apane-download svg {
            margin-right: 8px;
          }
        .apane-download span {
            font-size: 14px;
          }
        .apane-download:hover {
            cursor: pointer;
          }
        .amain-image {
          align-self: center;
          width: 120px;
          height: 120px;
          background-position: center;
          background-size: cover;
          border-radius: 10px;
          margin: 20px 0 0;
          background-image: ${blueprint.image ? `url(${world.resolveURL(blueprint.image.url)})` : 'none'};
        }
        .amain-name {
          text-align: center;
          font-size: 18px;
          font-weight: 500;
          margin: 16px 0 0;
        }
        .amain-author {
          text-align: center;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 7px 0 0;
        }
        .amain-author a {
          color: #00a7ff;
        }
        .amain-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 16px 0 0;
        }
        .amain-line {
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          margin: 0 -20px;
        }
        .amain-line.mt {
          margin-top: 20px;
        }
        .amain-line.mb {
          margin-bottom: 20px;
        }
        .amain-btns {
          display: flex;
          gap: 5px;
          margin: 0 0 5px;
        }
        .amain-btns-btn {
          flex: 1;
          background: #252630;
          border-radius: 10px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          cursor: pointer;
        }
        .amain-btns-btn input {
          position: absolute;
          top: -9999px;
        }
        .amain-btns-btn svg {
          margin: 0 8px 0 0;
        }
        .amain-btns-btn span {
          font-size: 14px;
        }
        .amain-btns2 {
          display: flex;
          gap: 5px;
        }
        .amain-btns2-btn {
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
        }
        .amain-btns2-btn svg {
          margin: 0 0 5px;
        }
        .amain-btns2-btn span {
          font-size: 12px;
        }
        .amain-btns2-btn.active {
          color: white;
        }
        .amain-btns2-btn.active.blue svg {
          color: #5097ff;
        }
        .amain-btns2-btn.active.yellow svg {
          color: #fbff50;
        }
        .amain-btns2-btn.active.red svg {
          color: #ff5050;
        }
        .amain-btns2-btn.active.green svg {
          color: #50ff51;
        }
        .amain-fields {
          margin-top: 20px;
        }
        .ameta-field {
          display: flex;
          align-items: center;
          margin: 0 0 10px;
        }
        .ameta-field-label {
          width: 90px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }
        .ameta-field-input {
          flex: 1;
        }
        .anodes-tree {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 20px;
          padding-right: 10px;
        }
        .anodes-item {
          display: flex;
          align-items: center;
          padding: 4px 6px;
          border-radius: 10px;
          font-size: 14px;
          cursor: pointer;
        }
        .anodes-item:hover {
          color: #00a7ff;
        }
        .anodes-item.selected {
          color: #00a7ff;
          background: rgba(0, 167, 255, 0.1);
        }
        .anodes-item svg {
          margin-right: 8px;
          opacity: 0.5;
          flex-shrink: 0;
        }
        .anodes-item span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .anodes-item-indent {
          margin-left: 20px;
        }
        .anodes-empty {
          color: rgba(255, 255, 255, 0.5);
          text-align: center;
          padding: 20px;
        }
        .anodes-details {
          flex-shrink: 0;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 20px;
          max-height: 40vh;
          overflow-y: auto;
          padding-right: 10px;
        }
        .anodes-detail {
          display: flex;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .anodes-detail-label {
          width: 100px;
          color: rgba(255, 255, 255, 0.5);
          flex-shrink: 0;
        }
        .anodes-detail-value {
          flex: 1;
          word-break: break-word;
        }
        .anodes-detail-value.copy {
          cursor: pointer;
        }
        .fieldwlabel-label {
          width: 90px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }
        .fieldwlabel-content {
          flex: 1;
        }
        .fieldsection-label {
          font-size: 14px;
          font-weight: 400;
          line-height: 1;
        }
        .fieldbuttons-button {
          flex: 1;
          background: #252630;
          border-radius: 10px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }
        .fieldbuttons-button:hover {
          cursor: pointer;
          background: #30323e;
        }
      `}</style>
      <div className='apane-head' ref={headRef}>
        <div className='apane-head-icon'>
          <ZapIcon size={16} />
        </div>
        <div className='apane-head-tabs'>
          <div className={cls('apane-head-tab', { active: tab === 'main' })} onClick={() => setTab('main')}>
            <span>App</span>
          </div>
          {canEdit && (
            <div className={cls('apane-head-tab', { active: tab === 'meta' })} onClick={() => setTab('meta')}>
              <span>Meta</span>
            </div>
          )}
          <div className={cls('apane-head-tab', { active: tab === 'nodes' })} onClick={() => setTab('nodes')}>
            <span>Nodes</span>
          </div>
        </div>
        <div className='apane-head-btns right'>
          {canEdit && (
            <div
              className='apane-head-btn'
              onClick={() => {
                world.emit('inspect', null)
                app.destroy(true)
              }}
            >
              <Trash2Icon size={16} />
            </div>
          )}
          <div className='apane-head-btn' onClick={() => world.emit('inspect', null)}>
            <XIcon size={20} />
          </div>
        </div>
      </div>
      {tab === 'main' && (
        <>
          <AppPaneMain world={world} app={app} blueprint={blueprint} canEdit={canEdit} />
          <div className='apane-download' onClick={download}>
            <DownloadIcon size={16} />
            <span>Download</span>
          </div>
        </>
      )}
      {tab === 'meta' && <AppPaneMeta world={world} app={app} blueprint={blueprint} />}
      {tab === 'nodes' && <AppPaneNodes app={app} />}
    </div>
  )
}

interface AppPaneMainProps {
  world: any;
  app: any;
  blueprint: any;
  canEdit: boolean;
}

function AppPaneMain({ world, app, blueprint, canEdit }: AppPaneMainProps) {
  const [fileInputKey, setFileInputKey] = useState(0)
  const downloadModel = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      e.preventDefault()
      const file = world.loader.getFile(blueprint.model)
      if (!file) return
      downloadFile(file)
    }
  }
  const changeModel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileInputKey(n => n + 1)
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !allowedModels.includes(ext)) return
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
  const toggle = async (key: string) => {
    const value = !blueprint[key]
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, [key]: value })
    world.network.send('blueprintModified', { id: blueprint.id, version, [key]: value })
  }
  return (
    <div
      className='amain noscrollbar'
      style={{
        flex: 1,
        padding: '0 20px 10px',
        maxHeight: '500px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
      }}
    >
      {blueprint.image && (
        <div
          className='amain-image'
          style={{
            alignSelf: 'center',
            width: '120px',
            height: '120px',
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            borderRadius: '10px',
            margin: '20px 0 0',
            backgroundImage: `url(${world.resolveURL(blueprint.image.url)})`,
          }}
        />
      )}
      {blueprint.name && <div className='amain-name'>{blueprint.name}</div>}
      {blueprint.author && (
        <div className='amain-author'>
          <span>by </span>
          {blueprint.url && (
            <a href={world.resolveURL(blueprint.url)} target='_blank' rel='noreferrer'>
              {blueprint.author || 'Unknown'}
            </a>
          )}
          {!blueprint.url && <span>{blueprint.author || 'Unknown'}</span>}
        </div>
      )}
      {blueprint.desc && <div className='amain-desc'>{blueprint.desc}</div>}
      {canEdit && (
        <>
          <div className='amain-line mt mb' />
          <div className='amain-btns'>
            <label className='amain-btns-btn' onClick={downloadModel}>
              <input key={fileInputKey} type='file' accept='.glb,.vrm' onChange={changeModel} />
              <BoxIcon size={16} />
              <span>Model</span>
            </label>
            <div className='amain-btns-btn' onClick={editCode}>
              <FileCode2Icon size={16} />
              <span>Code</span>
            </div>
          </div>
          <div className='amain-btns2'>
            <div
              className={cls('amain-btns2-btn green', { active: blueprint.preload })}
              onClick={() => toggle('preload')}
            >
              <CircleCheckIcon size={12} />
              <span>Preload</span>
            </div>
            <div className={cls('amain-btns2-btn blue', { active: blueprint.public })} onClick={() => toggle('public')}>
              <EarthIcon size={12} />
              <span>Public</span>
            </div>
            <div className={cls('amain-btns2-btn red', { active: blueprint.locked })} onClick={() => toggle('locked')}>
              <LockKeyholeIcon size={12} />
              <span>Lock</span>
            </div>
            <div
              className={cls('amain-btns2-btn yellow', { active: blueprint.unique })}
              onClick={() => toggle('unique')}
            >
              <SparkleIcon size={12} />
              <span>Unique</span>
            </div>
          </div>
          {app.fields.length > 0 && <div className='amain-line mt' />}
          <div className='amain-fields'>
            <Fields app={app} blueprint={blueprint} />
          </div>
        </>
      )}
    </div>
  )
}

interface AppPaneMetaProps {
  world: any;
  app: any;
  blueprint: any;
}

function AppPaneMeta({ world, app, blueprint }: AppPaneMetaProps) {
  const set = async (key: string, value: any) => {
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, [key]: value })
    world.network.send('blueprintModified', { id: blueprint.id, version, [key]: value })
  }
  return (
    <div
      className='ameta noscrollbar'
      style={{
        flex: 1,
        padding: '20px 20px 10px',
        maxHeight: '500px',
        overflowY: 'auto',
      }}
    >
      <div className='ameta-field'>
        <div className='ameta-field-label'>Name</div>
        <div className='ameta-field-input'>
          <InputText value={blueprint.name} onChange={name => set('name', name)} />
        </div>
      </div>
      <div className='ameta-field'>
        <div className='ameta-field-label'>Image</div>
        <div className='ameta-field-input'>
          <InputFile accept='image/*' value={blueprint.image} onChange={image => set('image', image)} />
        </div>
      </div>
      <div className='ameta-field'>
        <div className='ameta-field-label'>Author</div>
        <div className='ameta-field-input'>
          <InputText value={blueprint.author} onChange={author => set('author', author)} />
        </div>
      </div>
      <div className='ameta-field'>
        <div className='ameta-field-label'>URL</div>
        <div className='ameta-field-input'>
          <InputText value={blueprint.url} onChange={url => set('url', url)} />
        </div>
      </div>
      <div className='ameta-field'>
        <div className='ameta-field-label'>Description</div>
        <div className='ameta-field-input'>
          <InputTextarea value={blueprint.desc} onChange={desc => set('desc', desc)} />
        </div>
      </div>
    </div>
  )
}

interface AppPaneNodesProps {
  app: any;
}

function AppPaneNodes({ app }: AppPaneNodesProps) {
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const rootNode = useMemo(() => app.getNodes(), [app])

  useEffect(() => {
    if (rootNode && !selectedNode) {
      setSelectedNode(rootNode)
    }
  }, [rootNode, selectedNode])

  // Helper function to safely get vector string
  const getVectorString = (vec: any) => {
    if (!vec || typeof vec.x !== 'number') return null
    return `${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)}`
  }

  // Helper function to safely check if a property exists
  const hasProperty = (obj: any, prop: string) => {
    try {
      return obj && typeof obj[prop] !== 'undefined'
    } catch (err) {
      return false
    }
  }

  return (
    <div
      className='anodes noscrollbar'
      style={{
        flex: 1,
        padding: '20px',
        minHeight: '200px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div className='anodes-tree'>
        {rootNode ? (
          renderHierarchy([rootNode], 0, selectedNode, setSelectedNode)
        ) : (
          <div className='anodes-empty'>
            <LayersIcon size={24} />
            <div>No nodes found</div>
          </div>
        )}
      </div>

      {selectedNode && (
        <div className='anodes-details'>
          <HierarchyDetail label='ID' value={selectedNode.id} copy />
          <HierarchyDetail label='Name' value={selectedNode.name} copy={false} />

          {/* Position */}
          {hasProperty(selectedNode, 'position') && getVectorString(selectedNode.position) && (
            <HierarchyDetail label='Position' value={getVectorString(selectedNode.position)} copy={false} />
          )}

          {/* Rotation */}
          {hasProperty(selectedNode, 'rotation') && getVectorString(selectedNode.rotation) && (
            <HierarchyDetail label='Rotation' value={getVectorString(selectedNode.rotation)} copy={false} />
          )}

          {/* Scale */}
          {hasProperty(selectedNode, 'scale') && getVectorString(selectedNode.scale) && (
            <HierarchyDetail label='Scale' value={getVectorString(selectedNode.scale)} copy={false} />
          )}

          {/* Material */}
          {hasProperty(selectedNode, 'material') && selectedNode.material && (
            <>
              <HierarchyDetail label='Material' value={selectedNode.material.type || 'Standard'} copy={false} />
              {hasProperty(selectedNode.material, 'color') && selectedNode.material.color && (
                <HierarchyDetail
                  label='Color'
                  value={
                    selectedNode.material.color.getHexString
                      ? `#${selectedNode.material.color.getHexString()}`
                      : 'Unknown'
                  }
                  copy={false}
                />
              )}
            </>
          )}

          {/* Geometry */}
          {hasProperty(selectedNode, 'geometry') && selectedNode.geometry && (
            <HierarchyDetail label='Geometry' value={selectedNode.geometry.type || 'Custom'} copy={false} />
          )}
        </div>
      )}
    </div>
  )
}

function HierarchyDetail({ label, value, copy }: { label: any; value: any; copy: any }) {
  let handleCopy = copy 
    ? (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault()
        navigator.clipboard.writeText(value)
      }
    : undefined
  return (
    <div className='anodes-detail'>
      <div className='anodes-detail-label'>{label}</div>
      <div className={cls('anodes-detail-value', { copy })} onClick={handleCopy}>
        {value}
      </div>
    </div>
  )
}

const nodeIcons = {
  default: CircleIcon,
  group: FolderIcon,
  mesh: BoxIcon,
  rigidbody: DumbbellIcon,
  collider: BlendIcon,
  lod: EyeIcon,
  avatar: PersonStandingIcon,
  snap: MagnetIcon,
}

function renderHierarchy(nodes, depth = 0, selectedNode, setSelectedNode) {
  if (!Array.isArray(nodes)) return null

  return nodes.map(node => {
    if (!node) return null

    // Skip the root node but show its children
    // if (depth === 0 && node.id === '$root') {
    //   return renderHierarchy(node.children || [], depth, selectedNode, setSelectedNode)
    // }

    // Safely get children
    const children = node.children || []
    const hasChildren = Array.isArray(children) && children.length > 0
    const isSelected = selectedNode?.id === node.id
    const Icon = nodeIcons[node.name] || nodeIcons.default

    return (
      <div key={node.id}>
        <div
          className={cls('anodes-item', {
            'anodes-item-indent': depth > 0,
            selected: isSelected,
          })}
          style={{ marginLeft: depth * 20 }}
          onClick={() => setSelectedNode(node)}
        >
          <Icon size={14} />
          <span>{node.id === '$root' ? 'app' : node.id}</span>
        </div>
        {hasChildren && renderHierarchy(children, depth + 1, selectedNode, setSelectedNode)}
      </div>
    )
  })
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
  dropdown: FieldDropdown,
  range: FieldRange,
  button: FieldButton,
  buttons: FieldButtons,
}

function Field({ world, props, field, value, modify }) {
  if (field.hidden) {
    return null
  }
  if (field.when && isArray(field.when)) {
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
      style={{
        display: 'flex',
        alignItems: 'center',
        margin: '0 0 10px',
      }}
    >
      <div className='fieldwlabel-label' style={{
        width: '90px',
        fontSize: '14px',
        color: 'rgba(255, 255, 255, 0.5)',
      }}>
        {label}
      </div>
      <div className='fieldwlabel-content' style={{ flex: 1 }}>
        {children}
      </div>
    </div>
  )
}

function FieldSection({ world, field, value, modify }) {
  return (
    <div
      className='fieldsection'
      style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        margin: '20px 0 14px',
        padding: '16px 0 0 0',
      }}
    >
      <div className='fieldsection-label' style={{
        fontSize: '14px',
        fontWeight: '400',
        lineHeight: '1',
      }}>
        {field.label}
      </div>
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
        min={field.min}
        max={field.max}
        step={field.step}
      />
    </FieldWithLabel>
  )
}

function FieldRange({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputRange
        value={value}
        onChange={value => modify(field.key, value)}
        min={field.min}
        max={field.max}
        step={field.step}
      />
    </FieldWithLabel>
  )
}

function FieldFile({ world, field, value, modify }) {
  const kind = fileKinds[field.kind]
  if (!kind) return null
  return (
    <FieldWithLabel label={field.label}>
      <InputFile accept={kind.accept} value={value} onChange={value => modify(field.key, value)} />
    </FieldWithLabel>
  )
}

function FieldSwitch({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputSwitch value={value} onChange={value => modify(field.key, value)} />
    </FieldWithLabel>
  )
}

function FieldDropdown({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputDropdown options={field.options} value={value} onChange={value => modify(field.key, value)} />
    </FieldWithLabel>
  )
}

function FieldButton({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={''}>
      <div
        style={{
          background: '#252630',
          borderRadius: '10px',
          height: '34px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
        }}
        onClick={field.onClick}
      >
        <span>{field.label}</span>
      </div>
    </FieldWithLabel>
  )
}

function FieldButtons({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <div
        style={{
          height: '34px',
          display: 'flex',
          gap: '5px',
        }}
      >
        {field.buttons.map(button => (
          <div key={button.label} className='fieldbuttons-button' onClick={button.onClick} style={{
            flex: 1,
            background: '#252630',
            borderRadius: '10px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            cursor: 'pointer',
          }}>
            <span>{button.label}</span>
          </div>
        ))}
      </div>
    </FieldWithLabel>
  )
}
