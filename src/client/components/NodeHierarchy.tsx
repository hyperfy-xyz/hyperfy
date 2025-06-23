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
} from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { cls } from './cls'

export function NodeHierarchy({ app }) {
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const rootNode = useMemo(() => app.getNodes(), [])

  useEffect(() => {
    if (rootNode && !selectedNode) {
      setSelectedNode(rootNode)
    }
  }, [rootNode])

  // Helper function to safely get vector string
  const getVectorString = vec => {
    if (!vec || typeof vec.x !== 'number') return null
    return `${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)}`
  }

  // Helper function to safely check if a property exists
  const hasProperty = (obj, prop) => {
    try {
      return obj && typeof obj[prop] !== 'undefined'
    } catch (err) {
      return false
    }
  }

  const renderHierarchy = (nodes, depth, selectedNode, setSelectedNode) => {
    return nodes.map(node => {
      if (!node) return null
      
      const isSelected = selectedNode && selectedNode.id === node.id
      const nodeIcon = getNodeIcon(node.constructor.name)
      
      return (
        <div key={node.id || node.name}>
          <div
            className={cls('nodehierarchy-item', { selected: isSelected })}
            style={{ paddingLeft: `${depth * 20 + 6}px` }}
            onClick={() => setSelectedNode(node)}
          >
            {nodeIcon}
            <span>{node.name || node.constructor.name}</span>
          </div>
          {node.children && node.children.length > 0 && (
            <div className='nodehierarchy-item-indent'>
              {renderHierarchy(node.children, depth + 1, selectedNode, setSelectedNode)}
            </div>
          )}
        </div>
      )
    })
  }

  const getNodeIcon = (nodeName) => {
    switch (nodeName) {
      case 'Group':
        return <FolderIcon size={16} />
      case 'Mesh':
        return <BoxIcon size={16} />
      case 'Collider':
        return <MagnetIcon size={16} />
      case 'RigidBody':
        return <DumbbellIcon size={16} />
      case 'Avatar':
        return <PersonStandingIcon size={16} />
      case 'LOD':
        return <LayersIcon size={16} />
      case 'Anchor':
        return <BlendIcon size={16} />
      default:
        return <CircleIcon size={16} />
    }
  }

  return (
    <div
      className='nodehierarchy noscrollbar'
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        paddingTop: '0.5rem',
      }}
    >
      <style>{`
        .nodehierarchy-tree {
          flex: 1;
          padding: 0 1rem;
          overflow-y: auto;
          margin-bottom: 1.25rem;
        }
        .nodehierarchy-item {
          display: flex;
          align-items: center;
          padding: 0.25rem 0.375rem;
          border-radius: 0.325rem;
          font-size: 0.9375rem;
          cursor: pointer;
        }
        .nodehierarchy-item:hover {
          color: #00a7ff;
        }
        .nodehierarchy-item.selected {
          color: #00a7ff;
          background: rgba(0, 167, 255, 0.1);
        }
        .nodehierarchy-item svg {
          margin-right: 0.5rem;
          opacity: 0.5;
          flex-shrink: 0;
        }
        .nodehierarchy-item span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .nodehierarchy-item-indent {
          margin-left: 1.25rem;
        }
        .nodehierarchy-empty {
          color: rgba(255, 255, 255, 0.5);
          text-align: center;
          padding: 1rem;
        }
        .nodehierarchy-details {
          flex-shrink: 0;
          border-top: 0.0625rem solid rgba(255, 255, 255, 0.05);
          padding: 1rem;
          max-height: 40vh;
          overflow-y: auto;
        }
        .nodehierarchy-detail {
          display: flex;
          margin-bottom: 0.5rem;
          font-size: 0.9375rem;
        }
        .nodehierarchy-detail-label {
          width: 6.25rem;
          color: rgba(255, 255, 255, 0.5);
          flex-shrink: 0;
        }
        .nodehierarchy-detail-value {
          flex: 1;
          word-break: break-word;
        }
        .nodehierarchy-detail-value.copy {
          cursor: pointer;
        }
      `}</style>
      <div className='nodehierarchy-tree'>
        {rootNode ? (
          renderHierarchy([rootNode], 0, selectedNode, setSelectedNode)
        ) : (
          <div className='nodehierarchy-empty'>
            <LayersIcon size={24} />
            <div>No nodes found</div>
          </div>
        )}
      </div>

      {selectedNode && (
        <div className='nodehierarchy-details'>
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

function HierarchyDetail({ label, value, copy }) {
  let handleCopy = copy 
    ? (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault()
        navigator.clipboard.writeText(value)
      }
    : undefined
  return (
    <div className='nodehierarchy-detail'>
      <div className='nodehierarchy-detail-label'>{label}</div>
      <div className={cls('nodehierarchy-detail-value', { copy })} onClick={handleCopy}>
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
          className={cls('nodehierarchy-item', {
            'nodehierarchy-item-indent': depth > 0,
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
