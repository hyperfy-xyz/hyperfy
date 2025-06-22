import React, { useEffect, useMemo, useRef, useState } from 'react'

import {
  BlendIcon,
  BoxIcon,
  CircleIcon,
  DumbbellIcon,
  EyeIcon,
  FolderIcon,
  LayersIcon,
  MagnetIcon,
  PersonStandingIcon,
  Rows3Icon,
  XIcon
} from 'lucide-react'
import { storage } from '../../core/storage'
import { hashFile } from '../../core/utils-client'
import { cls } from './cls'

interface CodeEditorProps {
  app: any
  blur: boolean
  onClose: () => void
}

export function CodeEditor({ app, blur, onClose }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const resizeRef = useRef<HTMLDivElement | null>(null)
  const [nodes, setNodes] = useState(false)
  const world = app.world
  useEffect(() => {
    const elem = resizeRef.current
    const container = containerRef.current
    if (!elem || !container) return
    
    container.style.width = `${storage?.get('code-editor-width', 640) || 640}px`
    let active = false
    function onPointerDown(e: PointerEvent) {
      if (!elem) return
      active = true
      elem.addEventListener('pointermove', onPointerMove)
      elem.addEventListener('pointerup', onPointerUp)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    function onPointerMove(e: PointerEvent) {
      if (!container) return
      const newWidth = container.offsetWidth - e.movementX
      container.style.width = `${newWidth}px`
      storage?.set('code-editor-width', newWidth)
    }
    function onPointerUp(e: PointerEvent) {
      if (!elem) return
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      elem.removeEventListener('pointermove', onPointerMove)
      elem.removeEventListener('pointerup', onPointerUp)
    }
    elem.addEventListener('pointerdown', onPointerDown)
    return () => {
      elem.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])
  return (
    <div
      ref={containerRef}
      className='acode'
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '640px',
        backgroundColor: 'rgba(15, 16, 24, 0.8)',
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        opacity: blur ? 0.3 : 1,
        transform: blur ? 'translateX(90%)' : 'translateX(0%)',
        transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
      }}
    >
      <style>{`
        .acode-head {
          height: 50px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          padding: 0 10px 0 20px;
        }
        .acode-head-title {
          font-weight: 500;
          font-size: 20px;
          flex: 1;
        }
        .acode-head-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #7d7d7d;
        }
        .acode-head-btn:hover {
          cursor: pointer;
          color: white;
        }
        .acode-head-btn.selected {
          color: white;
        }
        .acode-head-close {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #7d7d7d;
        }
        .acode-head-close:hover {
          cursor: pointer;
          color: white;
        }
        .acode-resizer {
          position: absolute;
          top: 0;
          bottom: 0;
          left: -5px;
          width: 10px;
          cursor: ew-resize;
        }
        .monaco-editor {
          --vscode-focusBorder: #00000000 !important;
        }
      `}</style>
      <div className='acode-head'>
        <div className='acode-head-title'>Code</div>
        <div className={cls('acode-head-btn', { selected: nodes })} onClick={() => setNodes(!nodes)}>
          <Rows3Icon size={20} />
        </div>
        <div className='acode-head-close' onClick={() => world.ui.toggleCode()}>
          <XIcon size={24} />
        </div>
      </div>
      {!nodes && <Editor app={app} />}
      {nodes && <Nodes app={app} />}
      <div className='acode-resizer' ref={resizeRef} />
    </div>
  )
}

function Editor({ app }: { app: any }) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const codeRef = useRef<string>('')
  const [editor, setEditor] = useState<any>(null)
  const save = async () => {
    const world = app.world
    const blueprint = app.blueprint
    const code = codeRef.current
    // convert to file
    const blob = new Blob([code], { type: 'text/plain' })
    const file = new File([blob], 'script.js', { type: 'text/plain' })
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as glb filename
    const filename = `${hash}.js`
    // canonical url to this file
    const url = `asset://${filename}`
    // cache file locally so this client can insta-load it
    world.loader.insert('script', url, file)
    // update blueprint locally (also rebuilds apps)
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, script: url })
    // upload script
    await world.network.upload(file)
    // broadcast blueprint change to server + other clients
    world.network.send('blueprintModified', { id: blueprint.id, version, script: url })
  }
  useEffect(() => {
    let dead = false
    load().then((monaco: any) => {
      if (dead) return
      codeRef.current = app.script?.code || '// ...'
      const mount = mountRef.current
      const editor = monaco.editor.create(mount, {
        value: codeRef.current,
        language: 'javascript',
        scrollBeyondLastLine: true,
        lineNumbers: 'on',
        minimap: {
          enabled: false,
        },
        automaticLayout: true,
        tabSize: 2,
        insertSpaces: true,
      })
      editor.onDidChangeModelContent((event: any) => {
        codeRef.current = editor.getValue()
      })
      editor.addAction({
        id: 'save',
        label: 'Save',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: save,
      })
      setEditor(editor)
    })
    return () => {
      dead = true
    }
  }, [])

  return (
    <div
      className='editor'
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        borderBottomLeftRadius: '10px',
        borderBottomRightRadius: '10px',
      }}
    >
      <style>{`
        .editor-mount {
          position: absolute;
          inset: 0;
        }
      `}</style>
      <div className='editor-mount' ref={mountRef} />
    </div>
  )
}

function Nodes({ app }: { app: any }) {
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const rootNode = useMemo(() => app.getNodes(), [])

  useEffect(() => {
    if (rootNode && !selectedNode) {
      setSelectedNode(rootNode)
    }
  }, [rootNode])

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
      <style>{`
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
      `}</style>
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

function HierarchyDetail({ label, value, copy = false }: { label: string; value: any; copy?: boolean }) {
  let handleCopy = copy ? () => navigator.clipboard.writeText(value) : undefined
  return (
    <div className='anodes-detail'>
      <div className='anodes-detail-label'>{label}</div>
      <div className={cls('anodes-detail-value', { copy })} onClick={handleCopy}>
        {value}
      </div>
    </div>
  )
}

const nodeIcons: Record<string, any> = {
  default: CircleIcon,
  group: FolderIcon,
  mesh: BoxIcon,
  rigidbody: DumbbellIcon,
  collider: BlendIcon,
  lod: EyeIcon,
  avatar: PersonStandingIcon,
  snap: MagnetIcon,
}

function renderHierarchy(nodes: any[], depth = 0, selectedNode: any, setSelectedNode: (node: any) => void) {
  if (!Array.isArray(nodes)) return null

  return (
    <>
      {nodes.map(node => {
        if (!node) return null

        // Skip the root node but show its children
        // if (depth === 0 && node.id === '$root') {
        //   return renderHierarchy(node.children || [], depth, selectedNode, setSelectedNode)
        // }

        // Safely get children
        const children = node.children || []
        const hasChildren = Array.isArray(children) && children.length > 0
        const isSelected = selectedNode?.id === node.id
        const Icon = nodeIcons[node.name] || nodeIcons['default']

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
      })}
    </>
  )
}

let promise: Promise<any> | undefined
const load = () => {
  if (promise) return promise
  promise = new Promise(async resolve => {
    // init require
    (window as any).require = {
      paths: {
        vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.49.0/min/vs',
      },
    }
    // load loader
    await new Promise<void>(resolve => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.49.0/min/vs/loader.js' // prettier-ignore
      script.onload = () => resolve()
      document.head.appendChild(script)
    })
    // load editor
    await new Promise<void>(resolve => {
      (window as any).require(['vs/editor/editor.main'], () => {
        resolve()
      })
    })
    ;(window as any).monaco.editor.defineTheme('default', darkPlusTheme)
    ;(window as any).monaco.editor.setTheme('default')
    resolve((window as any).monaco)
  })
  return promise
}

// see https://stackoverflow.com/questions/65921179/vs-code-theme-dark-plus-css-for-monaco-editor
// see https://github.com/ChristopherHButler/vscode-themes-in-monaco
// see https://vsctim.vercel.app/
const darkPlusTheme = {
  inherit: true,
  base: 'vs-dark',
  rules: [
    {
      foreground: '#DCDCAA',
      token: 'entity.name.function',
    },
    {
      foreground: '#DCDCAA',
      token: 'support.function',
    },
    {
      foreground: '#DCDCAA',
      token: 'support.constant.handlebars',
    },
    {
      foreground: '#DCDCAA',
      token: 'source.powershell variable.other.member',
    },
    {
      foreground: '#DCDCAA',
      token: 'entity.name.operator.custom-literal',
    },
    {
      foreground: '#4EC9B0',
      token: 'meta.return-type',
    },
    {
      foreground: '#4EC9B0',
      token: 'support.class',
    },
    {
      foreground: '#4EC9B0',
      token: 'support.type',
    },
    {
      foreground: '#4EC9B0',
      token: 'entity.name.type',
    },
    {
      foreground: '#4EC9B0',
      token: 'entity.name.namespace',
    },
    {
      foreground: '#4EC9B0',
      token: 'entity.other.attribute',
    },
    {
      foreground: '#4EC9B0',
      token: 'entity.name.scope-resolution',
    },
    {
      foreground: '#4EC9B0',
      token: 'entity.name.class',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.numeric.go',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.byte.go',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.boolean.go',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.string.go',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.uintptr.go',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.error.go',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.rune.go',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.cs',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.generic.cs',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.modifier.cs',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.variable.cs',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.annotation.java',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.generic.java',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.java',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.object.array.java',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.primitive.array.java',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.primitive.java',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.token.java',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.groovy',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.annotation.groovy',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.parameters.groovy',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.generic.groovy',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.object.array.groovy',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.primitive.array.groovy',
    },
    {
      foreground: '#4EC9B0',
      token: 'storage.type.primitive.groovy',
    },
    {
      foreground: '#4EC9B0',
      token: 'meta.type.cast.expr',
    },
    {
      foreground: '#4EC9B0',
      token: 'meta.type.new.expr',
    },
    {
      foreground: '#4EC9B0',
      token: 'support.constant.math',
    },
    {
      foreground: '#4EC9B0',
      token: 'support.constant.dom',
    },
    {
      foreground: '#4EC9B0',
      token: 'support.constant.json',
    },
    {
      foreground: '#4EC9B0',
      token: 'entity.other.inherited-class',
    },
    {
      foreground: '#C586C0',
      token: 'keyword.control',
    },
    {
      foreground: '#C586C0',
      token: 'source.cpp keyword.operator.new',
    },
    {
      foreground: '#C586C0',
      token: 'keyword.operator.delete',
    },
    {
      foreground: '#C586C0',
      token: 'keyword.other.using',
    },
    {
      foreground: '#C586C0',
      token: 'keyword.other.operator',
    },
    {
      foreground: '#C586C0',
      token: 'entity.name.operator',
    },
    {
      foreground: '#9CDCFE',
      token: 'variable',
    },
    {
      foreground: '#9CDCFE',
      token: 'meta.definition.variable.name',
    },
    {
      foreground: '#9CDCFE',
      token: 'support.variable',
    },
    {
      foreground: '#9CDCFE',
      token: 'entity.name.variable',
    },
    {
      foreground: '#4FC1FF',
      token: 'variable.other.constant',
    },
    {
      foreground: '#4FC1FF',
      token: 'variable.other.enummember',
    },
    {
      foreground: '#9CDCFE',
      token: 'meta.object-literal.key',
    },
    {
      foreground: '#CE9178',
      token: 'support.constant.property-value',
    },
    {
      foreground: '#CE9178',
      token: 'support.constant.font-name',
    },
    {
      foreground: '#CE9178',
      token: 'support.constant.media-type',
    },
    {
      foreground: '#CE9178',
      token: 'support.constant.media',
    },
    {
      foreground: '#CE9178',
      token: 'constant.other.color.rgb-value',
    },
    {
      foreground: '#CE9178',
      token: 'constant.other.rgb-value',
    },
    {
      foreground: '#CE9178',
      token: 'support.constant.color',
    },
    {
      foreground: '#CE9178',
      token: 'punctuation.definition.group.regexp',
    },
    {
      foreground: '#CE9178',
      token: 'punctuation.definition.group.assertion.regexp',
    },
    {
      foreground: '#CE9178',
      token: 'punctuation.definition.character-class.regexp',
    },
    {
      foreground: '#CE9178',
      token: 'punctuation.character.set.begin.regexp',
    },
    {
      foreground: '#CE9178',
      token: 'punctuation.character.set.end.regexp',
    },
    {
      foreground: '#CE9178',
      token: 'keyword.operator.negation.regexp',
    },
    {
      foreground: '#CE9178',
      token: 'support.other.parenthesis.regexp',
    },
    {
      foreground: '#d16969',
      token: 'constant.character.character-class.regexp',
    },
    {
      foreground: '#d16969',
      token: 'constant.other.character-class.set.regexp',
    },
    {
      foreground: '#d16969',
      token: 'constant.other.character-class.regexp',
    },
    {
      foreground: '#d16969',
      token: 'constant.character.set.regexp',
    },
    {
      foreground: '#DCDCAA',
      token: 'keyword.operator.or.regexp',
    },
    {
      foreground: '#DCDCAA',
      token: 'keyword.control.anchor.regexp',
    },
    {
      foreground: '#d7ba7d',
      token: 'keyword.operator.quantifier.regexp',
    },
    {
      foreground: '#569cd6',
      token: 'constant.character',
    },
    {
      foreground: '#d7ba7d',
      token: 'constant.character.escape',
    },
    {
      foreground: '#C8C8C8',
      token: 'entity.name.label',
    },
    {
      foreground: '#569CD6',
      token: 'constant.language',
    },
    {
      foreground: '#569CD6',
      token: 'entity.name.tag',
    },
    {
      foreground: '#569cd6',
      token: 'storage',
    },
  ],
  colors: {
    // 'editor.foreground': '#f8f8f2',
    // 'editor.background': '#16161c',
    'editor.background': '#00000000',
    // 'editor.selectionBackground': '#44475a',
    // // 'editor.lineHighlightBackground': '#44475a',
    // 'editor.lineHighlightBorder': '#44475a',
    // 'editorCursor.foreground': '#f8f8f0',
    // 'editorWhitespace.foreground': '#3B3A32',
    // 'editorIndentGuide.activeBackground': '#9D550FB0',
    // 'editor.selectionHighlightBorder': '#222218',
  },
  encodedTokensColors: [],
}
