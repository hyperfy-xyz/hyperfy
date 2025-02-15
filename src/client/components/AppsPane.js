import { css } from '@firebolt-dev/css'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BoxIcon,
  BrickWall,
  BrickWallIcon,
  CrosshairIcon,
  EyeIcon,
  FileCode2Icon,
  HardDriveIcon,
  HashIcon,
  LayoutGridIcon,
  PencilIcon,
  RotateCcwIcon,
  SearchIcon,
  SettingsIcon,
  TargetIcon,
  TriangleIcon,
  XIcon,
  ZapIcon,
} from 'lucide-react'

import { usePane } from './usePane'
import { cls } from './cls'
import { orderBy } from 'lodash-es'
import { formatBytes } from '../../core/extras/formatBytes'

export function AppsPane({ world, close }) {
  const paneRef = useRef()
  const headRef = useRef()
  usePane('apps', paneRef, headRef)
  const [query, setQuery] = useState('')
  const [refresh, setRefresh] = useState(0)
  return (
    <div
      ref={paneRef}
      className='apane'
      css={css`
        position: absolute;
        top: 20px;
        left: 20px;
        width: 540px;
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
          &-search {
            width: 150px;
            display: flex;
            align-items: center;
            svg {
              margin-right: 5px;
            }
            input {
              flex: 1;
              font-size: 14px;
            }
          }
          &-btn {
            width: 30px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.5);
            &:hover {
              cursor: pointer;
              color: white;
            }
          }
        }
      `}
    >
      <div className='apane-head' ref={headRef}>
        <ZapIcon size={16} />
        <div className='apane-head-title'>Apps</div>
        <div className='apane-head-search'>
          <SearchIcon size={16} />
          <input type='text' placeholder='Search' value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className='apane-head-btn' onClick={() => setRefresh(n => n + 1)}>
          <RotateCcwIcon size={16} />
        </div>
        <div className='apane-head-btn' onClick={close}>
          <XIcon size={20} />
        </div>
      </div>
      <AppsPaneContent world={world} query={query} refresh={refresh} />
    </div>
  )
}

function AppsPaneContent({ world, query, refresh }) {
  const [sort, setSort] = useState('count')
  const [asc, setAsc] = useState(false)
  const [target, setTarget] = useState(null)
  let items = useMemo(() => {
    const itemMap = new Map() // id -> { blueprint, count }
    let items = []
    for (const [_, entity] of this.world.entities.items) {
      if (!entity.isApp) continue
      const blueprint = entity.blueprint
      if (!blueprint) continue // still loading?
      let item = itemMap.get(blueprint.id)
      if (!item) {
        let count = 0
        const type = blueprint.model.endsWith('.vrm') ? 'avatar' : 'model'
        const model = world.loader.get(type, blueprint.model)
        if (!model) continue
        const stats = model.getStats()
        const name = blueprint.name || '-'
        item = {
          blueprint,
          keywords: name.toLowerCase(),
          name,
          count,
          geometries: stats.geometries.size,
          triangles: stats.triangles,
          textureBytes: stats.textureBytes,
          textureSize: formatBytes(stats.textureBytes),
          code: blueprint.script ? 1 : 0,
          fileBytes: stats.fileBytes,
          fileSize: formatBytes(stats.fileBytes),
        }
        itemMap.set(blueprint.id, item)
      }
      item.count++
    }
    for (const [_, item] of itemMap) {
      items.push(item)
    }
    return items
  }, [refresh])
  items = useMemo(() => {
    let newItems = items
    if (query) {
      query = query.toLowerCase()
      newItems = newItems.filter(item => item.keywords.includes(query))
    }
    newItems = orderBy(newItems, sort, asc ? 'asc' : 'desc')
    return newItems
  }, [items, sort, asc, query])
  const reorder = key => {
    if (sort === key) {
      setAsc(!asc)
    } else {
      setSort(key)
      setAsc(false)
    }
  }
  useEffect(() => {
    return () => world.target.hide()
  }, [])
  const getClosest = item => {
    // find closest entity
    const playerPosition = world.rig.position
    let closestEntity
    let closestDistance = null
    for (const [_, entity] of this.world.entities.items) {
      if (entity.blueprint === item.blueprint) {
        const distance = playerPosition.distanceTo(entity.root.position)
        if (closestDistance === null || closestDistance > distance) {
          closestEntity = entity
          closestDistance = distance
        }
      }
    }
    return closestEntity
  }
  const toggleTarget = item => {
    if (target === item) {
      world.target.hide()
      setTarget(null)
      return
    }
    const entity = getClosest(item)
    if (!entity) return
    world.target.show(entity.root.position)
    setTarget(item)
  }
  const inspect = item => {
    const entity = getClosest(item)
    world.emit('inspect', entity)
  }
  return (
    <div
      className='asettings'
      css={css`
        flex: 1;
        padding: 20px 20px 0;
        .asettings-head {
          position: sticky;
          top: 0;
          background: rgba(22, 22, 28, 1);
          display: flex;
          align-items: center;
          margin: 0 0 5px;
        }
        .asettings-headitem {
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          &.name {
            flex: 1;
          }
          &.count,
          &.geometries,
          &.triangles,
          &.code {
            width: 50px;
            text-align: right;
          }
          &.textureSize,
          &.fileSize {
            width: 70px;
            text-align: right;
          }
          &.actions {
            width: 60px;
            text-align: right;
          }
          &:hover:not(.active) {
            cursor: pointer;
          }
          &.active {
            color: #4088ff;
          }
        }
        .asettings-rows {
          overflow-y: auto;
          padding-bottom: 20px;
          max-height: 300px;
        }
        .asettings-row {
          display: flex;
          align-items: center;
          margin: 0 0 5px;
        }
        .asettings-rowitem {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          &.name {
            flex: 1;
          }
          &.count,
          &.geometries,
          &.triangles,
          &.code {
            width: 50px;
            text-align: right;
          }
          &.textureSize,
          &.fileSize {
            width: 70px;
            text-align: right;
          }
          &.actions {
            width: 60px;
            display: flex;
            justify-content: flex-end;
          }
        }
        .asettings-action {
          margin-left: 10px;
          color: rgba(255, 255, 255, 0.4);
          &:hover:not(.active) {
            cursor: pointer;
            color: white;
          }
          &.active {
            color: #4088ff;
          }
        }
      `}
    >
      <div className='asettings-head'>
        <div
          className={cls('asettings-headitem name', { active: sort === 'name' })}
          onClick={() => reorder('name')}
          title='Name'
        >
          <span>Name</span>
        </div>
        <div
          className={cls('asettings-headitem count', { active: sort === 'count' })}
          onClick={() => reorder('count')}
          title='Instances'
        >
          <HashIcon size={16} />
        </div>
        <div
          className={cls('asettings-headitem geometries', { active: sort === 'geometries' })}
          onClick={() => reorder('geometries')}
          title='Geometries'
        >
          <BoxIcon size={16} />
        </div>
        <div
          className={cls('asettings-headitem triangles', { active: sort === 'triangles' })}
          onClick={() => reorder('triangles')}
          title='Triangles'
        >
          <TriangleIcon size={16} />
        </div>
        <div
          className={cls('asettings-headitem textureSize', { active: sort === 'textureBytes' })}
          onClick={() => reorder('textureBytes')}
          title='Texture Memory Size'
        >
          <BrickWallIcon size={16} />
        </div>
        <div
          className={cls('asettings-headitem code', { active: sort === 'code' })}
          onClick={() => reorder('code')}
          title='Code'
        >
          <FileCode2Icon size={16} />
        </div>
        <div
          className={cls('asettings-headitem fileSize', { active: sort === 'fileBytes' })}
          onClick={() => reorder('fileBytes')}
          title='File Size'
        >
          <HardDriveIcon size={16} />
        </div>
        <div className='asettings-headitem actions' />
      </div>
      <div className='asettings-rows noscrollbar'>
        {items.map(item => (
          <div key={item.blueprint.id} className='asettings-row'>
            <div className='asettings-rowitem name' onClick={() => target(item)}>
              <span>{item.name}</span>
            </div>
            <div className='asettings-rowitem count'>
              <span>{item.count}</span>
            </div>
            <div className='asettings-rowitem geometries'>
              <span>{item.geometries}</span>
            </div>
            <div className='asettings-rowitem triangles'>
              <span>{item.triangles}</span>
            </div>
            <div className='asettings-rowitem textureSize'>
              <span>{item.textureSize}</span>
            </div>
            <div className='asettings-rowitem code'>
              <span>{item.code ? 'Yes' : 'No'}</span>
            </div>
            <div className='asettings-rowitem fileSize'>
              <span>{item.fileSize}</span>
            </div>
            <div className={'asettings-rowitem actions'}>
              <div className={cls('asettings-action', { active: target === item })} onClick={() => toggleTarget(item)}>
                <CrosshairIcon size={16} />
              </div>
              <div className={'asettings-action'} onClick={() => inspect(item)}>
                <EyeIcon size={16} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
