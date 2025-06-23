import {
  BoxIcon,
  BrickWallIcon,
  CrosshairIcon,
  EyeIcon,
  EyeOffIcon,
  FileCode2Icon,
  HardDriveIcon,
  HashIcon,
  RotateCwIcon,
  SearchIcon,
  SettingsIcon,
  TriangleIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

// import { orderBy } from 'lodash-es' // Not available, using manual sort
import { formatBytes } from '../../core/extras/formatBytes'
import { cls } from './cls'
import { usePane } from './usePane'

interface AppsPaneProps {
  world: any
  close: () => void
}

export function AppsPane({ world, close }: AppsPaneProps) {
  const paneRef = useRef<HTMLDivElement | null>(null)
  const headRef = useRef<HTMLDivElement | null>(null)
  usePane('apps', paneRef, headRef)
  const [query, setQuery] = useState('')
  const [refresh, setRefresh] = useState(0)
  return (
    <div
      ref={paneRef}
      className='apane'
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        width: '38rem',
        backgroundColor: 'rgba(15, 16, 24, 0.8)',
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        fontSize: '1rem',
      }}
    >
      <style>{`
        .apane-head {
          height: 3.125rem;
          background: black;
          display: flex;
          align-items: center;
          padding: 0 0.8125rem 0 1.25rem;
        }
        .apane-head-title {
          font-size: 1.2rem;
          font-weight: 500;
          flex: 1;
        }
        .apane-head-search {
          width: 9.375rem;
          display: flex;
          align-items: center;
        }
        .apane-head-search svg {
          margin-right: 0.3125rem;
        }
        .apane-head-search input {
          flex: 1;
          font-size: 1rem;
        }
        .apane-head-btn {
          width: 1.875rem;
          height: 2.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.5);
        }
        .apane-head-btn:hover {
          cursor: pointer;
          color: white;
        }
      `}</style>
      <div className='apane-head' ref={headRef}>
        <div className='apane-head-title'>Apps</div>
        <div className='apane-head-search'>
          <SearchIcon size={16} />
          <input type='text' placeholder='Search' value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className='apane-head-btn' onClick={() => setRefresh((n: number) => n + 1)}>
          <RotateCwIcon size={16} />
        </div>
        <div className='apane-head-btn' onClick={close}>
          <XIcon size={20} />
        </div>
      </div>
      <AppsPaneContent world={world} query={query} refresh={refresh} setRefresh={setRefresh} />
    </div>
  )
}

interface AppsPaneContentProps {
  world: any
  query: string
  refresh: number
  setRefresh: (value: number | ((prev: number) => number)) => void
}

function AppsPaneContent({ world, query, refresh, setRefresh }: AppsPaneContentProps) {
  const [sort, setSort] = useState('count')
  const [asc, setAsc] = useState(false)
  const [target, setTarget] = useState<any>(null)
  let items = useMemo(() => {
    const itemMap = new Map() // id -> { blueprint, count }
    let items: any[] = []
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
    setRefresh((n: number) => n + 1)
  }
  return (
    <div
      className='asettings'
      style={{ flex: 1, padding: '1.25rem 1.25rem 0' }}
    >
      <style>{`
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
        }
        .asettings-headitem.name {
          flex: 1;
        }
        .asettings-headitem.code {
          width: 3rem;
          text-align: right;
        }
        .asettings-headitem.count,
        .asettings-headitem.geometries,
        .asettings-headitem.triangles {
          width: 4rem;
          text-align: right;
        }
        .asettings-headitem.textureSize,
        .asettings-headitem.fileSize {
          width: 5rem;
          text-align: right;
        }
        .asettings-headitem.actions {
          width: 5.45rem;
          text-align: right;
        }
        .asettings-headitem:hover:not(.active) {
          cursor: pointer;
        }
        .asettings-headitem.active {
          color: #4088ff;
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
        }
        .asettings-rowitem.name {
          flex: 1;
        }
        .asettings-rowitem.code {
          width: 3rem;
          text-align: right;
        }
        .asettings-rowitem.count,
        .asettings-rowitem.geometries,
        .asettings-rowitem.triangles {
          width: 4rem;
          text-align: right;
        }
        .asettings-rowitem.textureSize,
        .asettings-rowitem.fileSize {
          width: 5rem;
          text-align: right;
        }
        .asettings-rowitem.actions {
          width: 5.45rem;
          display: flex;
          justify-content: flex-end;
        }
        .asettings-action {
          margin-left: 0.625rem;
          color: rgba(255, 255, 255, 0.4);
        }
        .asettings-action.active {
          color: #4088ff;
        }
        .asettings-action.red {
          color: #fb4848;
        }
        .asettings-action:hover {
          cursor: pointer;
        }
        .asettings-action:hover:not(.active):not(.red) {
          color: white;
        }
      `}</style>
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
        {items.map((item: any) => (
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
