import { css } from '@firebolt-dev/css'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BoxIcon,
  BrickWall,
  BrickWallIcon,
  CrosshairIcon,
  EyeIcon,
  EyeOffIcon,
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
        width: 38rem;
        background-color: rgba(15, 16, 24, 0.8);
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        font-size: 1rem;
        .apane-head {
          height: 3.125rem;
          background: black;
          display: flex;
          align-items: center;
          padding: 0 0.8125rem 0 1.25rem;
          &-title {
            font-size: 1.2rem;
            font-weight: 500;
            flex: 1;
          }
          &-search {
            width: 9.375rem;
            display: flex;
            align-items: center;
            svg {
              margin-right: 0.3125rem;
            }
            input {
              flex: 1;
              font-size: 1rem;
            }
          }
          &-btn {
            width: 1.875rem;
            height: 2.5rem;
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
      <AppsPaneContent world={world} query={query} refresh={refresh} setRefresh={setRefresh} />
    </div>
  )
}

function AppsPaneContent({ world, query, refresh, setRefresh }) {
  const [sort, setSort] = useState('count')
  const [asc, setAsc] = useState(false)
  const [target, setTarget] = useState(null)
  let items = useMemo(() => {
    const itemMap = new Map() // id -> { blueprint, count }
    let items = []
    for (const [_, entity] of world.entities.items) {
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
    for (const [_, entity] of world.entities.items) {
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
    world.ui.setMenu({ type: 'app', app: entity })
  }
  const toggle = item => {
    const blueprint = world.blueprints.get(item.blueprint.id)
    const version = blueprint.version + 1
    const disabled = !blueprint.disabled
    world.blueprints.modify({ id: blueprint.id, version, disabled })
    world.network.send('blueprintModified', { id: blueprint.id, version, disabled })
    setRefresh(n => n + 1)
  }
  return (
    <div
      className='asettings'
      css={css`
        flex: 1;
        padding: 1.25rem 1.25rem 0;
        .asettings-head {
          position: sticky;
          top: 0;
          display: flex;
          align-items: center;
          margin: 0 0 0.3125rem;
        }
        .asettings-headitem {
          font-size: 1rem;
          font-weight: 500;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          &.name {
            flex: 1;
          }
          &.code {
            width: 3rem;
            text-align: right;
          }
          &.count,
          &.geometries,
          &.triangles {
            width: 4rem;
            text-align: right;
          }
          &.textureSize,
          &.fileSize {
            width: 5rem;
            text-align: right;
          }
          &.actions {
            width: 5.45rem;
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
          padding-bottom: 1.25rem;
          max-height: 18.75rem;
        }
        .asettings-row {
          display: flex;
          align-items: center;
          margin: 0 0 0.3125rem;
        }
        .asettings-rowitem {
          font-size: 1rem;
          color: rgba(255, 255, 255, 0.8);
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          &.name {
            flex: 1;
          }
          &.code {
            width: 3rem;
            text-align: right;
          }
          &.count,
          &.geometries,
          &.triangles {
            width: 4rem;
            text-align: right;
          }
          &.textureSize,
          &.fileSize {
            width: 5rem;
            text-align: right;
          }
          &.actions {
            width: 5.45rem;
            display: flex;
            justify-content: flex-end;
          }
        }
        .asettings-action {
          margin-left: 0.625rem;
          color: rgba(255, 255, 255, 0.4);
          &.active {
            color: #4088ff;
          }
          &.red {
            color: #fb4848;
          }
          &:hover {
            cursor: pointer;
          }
          &:hover:not(.active):not(.red) {
            color: white;
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
              <span>{formatNumber(item.triangles)}</span>
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
              <div className={cls('asettings-action', { red: item.blueprint.disabled })} onClick={() => toggle(item)}>
                {item.blueprint.disabled ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </div>
              <div className={cls('asettings-action', { active: target === item })} onClick={() => toggleTarget(item)}>
                <CrosshairIcon size={16} />
              </div>
              <div className={'asettings-action'} onClick={() => inspect(item)}>
                <SettingsIcon size={16} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) {
    return '0'
  }
  const million = 1000000
  const thousand = 1000
  let result
  if (num >= million) {
    result = (num / million).toFixed(1) + 'M'
  } else if (num >= thousand) {
    result = (num / thousand).toFixed(1) + 'K'
  } else {
    result = Math.round(num).toString()
  }
  return result
    .replace(/\.0+([KM])?$/, '$1') // Replace .0K with K or .0M with M
    .replace(/(\.\d+[1-9])0+([KM])?$/, '$1$2') // Trim trailing zeros (1.50M → 1.5M)
}
