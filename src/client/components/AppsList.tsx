import {
  BoxIcon,
  BrickWallIcon,
  CrosshairIcon,
  FileCode2Icon,
  HardDriveIcon,
  HashIcon,
  OctagonXIcon,
  TriangleIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

// import { orderBy } from 'lodash-es' // Not available, using manual sort
import { formatBytes } from '../../core/extras/formatBytes'
import { cls } from './cls'

const defaultStats = {
  geometries: 0,
  triangles: 0,
  textureBytes: 0,
  fileBytes: 0,
}

interface AppsListProps {
  world: any
  query: string
  perf: boolean
  refresh: number
  setRefresh: (value: number | ((prev: number) => number)) => void
}

export function AppsList({ world, query, perf, refresh, setRefresh }: AppsListProps) {
  const [sort, setSort] = useState('count')
  const [asc, setAsc] = useState(false)
  const [target, setTarget] = useState<any>(null)
  let items = useMemo(() => {
    const itemMap = new Map() // id -> { blueprint, count }
    let items: any[] = []
    for (const [_, entity] of world.entities.items) {
      if (!entity.isApp) continue
      const blueprint = world.blueprints.get(entity.data.blueprint)
      if (!blueprint) continue // still loading?
      if (!blueprint.model) continue // corrupt app?
      let item = itemMap.get(blueprint.id)
      if (!item) {
        let count = 0
        const type = blueprint.model.endsWith('.vrm') ? 'avatar' : 'model'
        const model = world.loader.get(type, blueprint.model)
        const stats = model?.getStats() || defaultStats
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
      newItems = newItems.filter((item: any) => item.keywords.includes(query))
    }
    newItems = newItems.sort((a, b) => {
      const aVal = a[sort]
      const bVal = b[sort]
      let comparison = 0
      if (aVal < bVal) comparison = -1
      else if (aVal > bVal) comparison = 1
      return asc ? comparison : -comparison
    })
    return newItems
  }, [items, sort, asc, query])
  const reorder = (key: string) => {
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
  const getClosest = (item: any) => {
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
  const toggleTarget = (item: any) => {
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
  const inspect = (item: any) => {
    const entity = getClosest(item)
    world.ui.setApp(entity)
    // world.ui.setMenu({ type: 'app', app: entity })
  }
  const toggle = (item: any) => {
    const blueprint = world.blueprints.get(item.blueprint.id)
    const version = blueprint.version + 1
    const disabled = !blueprint.disabled
    world.blueprints.modify({ id: blueprint.id, version, disabled })
    world.network.send('blueprintModified', { id: blueprint.id, version, disabled })
    setRefresh(n => n + 1)
  }
  return (
    <div
      className={cls('appslist', { hideperf: !perf })}
      style={{ flex: 1 }}
    >
      <style>{`
        .appslist {
          flex: 1;
        }
        .appslist-head {
          position: sticky;
          top: 0;
          display: flex;
          align-items: center;
          padding: 0.6rem 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          margin: 0 0 0.3125rem;
        }
        .appslist-headitem {
          font-size: 1rem;
          font-weight: 500;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .appslist-headitem.name {
          flex: 1;
        }
        .appslist-headitem.code {
          width: 3rem;
          text-align: right;
        }
        .appslist-headitem.count,
        .appslist-headitem.geometries,
        .appslist-headitem.triangles {
          width: 4rem;
          text-align: right;
        }
        .appslist-headitem.textureSize,
        .appslist-headitem.fileSize {
          width: 5rem;
          text-align: right;
        }
        .appslist-headitem.actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          width: 5.45rem;
        }
        .appslist-headitem:hover:not(.active) {
          cursor: pointer;
        }
        .appslist-headitem.active {
          color: #4088ff;
        }
        .appslist-rows {
          /* overflow-y: auto;
          padding-bottom: 1.25rem;
          max-height: 18.75rem; */
        }
        .appslist-row {
          display: flex;
          align-items: center;
          padding: 0.6rem 1rem;
        }
        .appslist-row:hover {
          cursor: pointer;
          background: rgba(255, 255, 255, 0.03);
        }
        .appslist-rowitem {
          font-size: 1rem;
          color: rgba(255, 255, 255, 0.8);
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .appslist-rowitem.name {
          flex: 1;
        }
        .appslist-rowitem.code {
          width: 3rem;
          text-align: right;
        }
        .appslist-rowitem.count,
        .appslist-rowitem.geometries,
        .appslist-rowitem.triangles {
          width: 4rem;
          text-align: right;
        }
        .appslist-rowitem.textureSize,
        .appslist-rowitem.fileSize {
          width: 5rem;
          text-align: right;
        }
        .appslist-rowitem.actions {
          width: 5.45rem;
          display: flex;
          justify-content: flex-end;
        }
        .appslist-action {
          margin-left: 0.625rem;
          color: #5d6077;
        }
        .appslist-action.active {
          color: white;
        }
        .appslist-action:hover {
          cursor: pointer;
        }
        .appslist.hideperf .appslist-head {
          display: none;
        }
        .appslist.hideperf .appslist-rowitem.count,
        .appslist.hideperf .appslist-rowitem.code,
        .appslist.hideperf .appslist-rowitem.geometries,
        .appslist.hideperf .appslist-rowitem.triangles,
        .appslist.hideperf .appslist-rowitem.textureSize,
        .appslist.hideperf .appslist-rowitem.fileSize {
          display: none;
        }
      `}</style>
      <div className='appslist-head'>
        <div
          className={cls('appslist-headitem name', { active: sort === 'name' })}
          onClick={() => reorder('name')}
          title='Name'
        >
          <span></span>
        </div>
        <div
          className={cls('appslist-headitem count', { active: sort === 'count' })}
          onClick={() => reorder('count')}
          title='Instances'
        >
          <HashIcon size={18} />
        </div>
        <div
          className={cls('appslist-headitem geometries', { active: sort === 'geometries' })}
          onClick={() => reorder('geometries')}
          title='Geometries'
        >
          <BoxIcon size={18} />
        </div>
        <div
          className={cls('appslist-headitem triangles', { active: sort === 'triangles' })}
          onClick={() => reorder('triangles')}
          title='Triangles'
        >
          <TriangleIcon size={18} />
        </div>
        <div
          className={cls('appslist-headitem textureSize', { active: sort === 'textureBytes' })}
          onClick={() => reorder('textureBytes')}
          title='Texture Memory Size'
        >
          <BrickWallIcon size={18} />
        </div>
        <div
          className={cls('appslist-headitem code', { active: sort === 'code' })}
          onClick={() => reorder('code')}
          title='Code'
        >
          <FileCode2Icon size={18} />
        </div>
        <div
          className={cls('appslist-headitem fileSize', { active: sort === 'fileBytes' })}
          onClick={() => reorder('fileBytes')}
          title='File Size'
        >
          <HardDriveIcon size={16} />
        </div>
        <div className='appslist-headitem actions' />
      </div>
      <div className='appslist-rows'>
        {items.map((item: any) => (
          <div key={item.blueprint.id} className='appslist-row'>
            <div className='appslist-rowitem name' onClick={() => inspect(item)}>
              <span>{item.name}</span>
            </div>
            <div className='appslist-rowitem count'>
              <span>{item.count}</span>
            </div>
            <div className='appslist-rowitem geometries'>
              <span>{item.geometries}</span>
            </div>
            <div className='appslist-rowitem triangles'>
              <span>{formatNumber(item.triangles)}</span>
            </div>
            <div className='appslist-rowitem textureSize'>
              <span>{item.textureSize}</span>
            </div>
            <div className='appslist-rowitem code'>
              <span>{item.code ? 'Yes' : 'No'}</span>
            </div>
            <div className='appslist-rowitem fileSize'>
              <span>{item.fileSize}</span>
            </div>
            <div className={'appslist-rowitem actions'}>
              <div className={cls('appslist-action', { active: item.blueprint.disabled })} onClick={() => toggle(item)}>
                <OctagonXIcon size={16} />
              </div>
              <div className={cls('appslist-action', { active: target === item })} onClick={() => toggleTarget(item)}>
                <CrosshairIcon size={16} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatNumber(num: number | null | undefined): string {
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
