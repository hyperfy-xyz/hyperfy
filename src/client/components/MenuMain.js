import { useEffect, useMemo, useState } from 'react'
import {
  Menu,
  MenuItemBack,
  MenuItemBtn,
  MenuItemFile,
  MenuItemNumber,
  MenuItemRange,
  MenuItemSwitch,
  MenuItemText,
  MenuItemTextarea,
  MenuItemToggle,
} from './Menu'
import { usePermissions } from './usePermissions'
import { useFullscreen } from './useFullscreen'

export function MenuMain({ world }) {
  const [pages, setPages] = useState(() => ['index'])
  const pop = () => {
    const next = pages.slice()
    next.pop()
    setPages(next)
  }
  const push = page => {
    const next = pages.slice()
    next.push(page)
    setPages(next)
  }
  const page = pages[pages.length - 1]
  let Page
  if (page === 'index') Page = MenuMainIndex
  if (page === 'ui') Page = MenuMainUI
  if (page === 'graphics') Page = MenuMainGraphics
  if (page === 'audio') Page = MenuMainAudio
  if (page === 'world') Page = MenuMainWorld
  return <Page world={world} pop={pop} push={push} />
}

function MenuMainIndex({ world, pop, push }) {
  const { isAdmin, isBuilder } = usePermissions(world)
  const player = world.entities.player
  const [name, setName] = useState(() => player.data.name)
  const changeName = name => {
    if (!name) return setName(player.data.name)
    player.modify({ name })
    world.network.send('entityModified', { id: player.data.id, name })
  }
  return (
    <Menu title='Menu'>
      <MenuItemText label='Name' hint='Change your display name' value={name} onChange={changeName} />
      <MenuItemBtn label='UI' hint='Change your interface settings' onClick={() => push('ui')} nav />
      <MenuItemBtn label='Graphics' hint='Change your device graphics settings' onClick={() => push('graphics')} nav />
      <MenuItemBtn label='Audio' hint='Change your audio volume' onClick={() => push('audio')} nav />
      {isBuilder && <MenuItemBtn label='World' hint='Modify world settings' onClick={() => push('world')} nav />}
      {isBuilder && (
        <MenuItemBtn label='Apps' hint='View all apps in the world' onClick={() => world.ui.toggleApps()} />
      )}
    </Menu>
  )
}

function MenuMainUI({ world, pop, push }) {
  const player = world.entities.player
  const [canFullscreen, isFullscreen, toggleFullscreen] = useFullscreen()
  const [ui, setUI] = useState(world.prefs.ui)
  const [actions, setActions] = useState(world.prefs.actions)
  const [stats, setStats] = useState(world.prefs.stats)
  const { isBuilder } = usePermissions(world)
  useEffect(() => {
    const onChange = changes => {
      if (changes.ui) setUI(changes.ui.value)
      if (changes.actions) setActions(changes.actions.value)
      if (changes.stats) setStats(changes.stats.value)
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])
  return (
    <Menu title='Menu'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemToggle
        label='Fullscreen'
        hint='Toggle fullscreen. Not supported in some browsers'
        value={isFullscreen}
        onChange={value => toggleFullscreen(value)}
      />
      <MenuItemRange
        label='UI Scale'
        hint='Change the scale of the user interface'
        min={0.5}
        max={1.5}
        step={0.1}
        value={ui}
        onChange={ui => world.prefs.setUI(ui)}
      />
      {isBuilder && (
        <MenuItemToggle
          label='Build Prompts'
          hint='Show or hide action prompts when in build mode'
          value={actions}
          onChange={actions => world.prefs.setActions(actions)}
        />
      )}
      <MenuItemToggle
        label='Stats'
        hint='Show or hide performance stats'
        value={world.prefs.stats}
        onChange={stats => world.prefs.setStats(stats)}
      />
    </Menu>
  )
}

const shadowOptions = [
  { label: 'None', value: 'none' },
  { label: 'Low', value: 'low' },
  { label: 'Med', value: 'med' },
  { label: 'High', value: 'high' },
]
function MenuMainGraphics({ world, pop, push }) {
  const [dpr, setDPR] = useState(world.prefs.dpr)
  const [shadows, setShadows] = useState(world.prefs.shadows)
  const [postprocessing, setPostprocessing] = useState(world.prefs.postprocessing)
  const [bloom, setBloom] = useState(world.prefs.bloom)
  const dprOptions = useMemo(() => {
    const width = world.graphics.width
    const height = world.graphics.height
    const dpr = window.devicePixelRatio
    const options = []
    const add = (label, dpr) => {
      options.push({
        // label: `${Math.round(width * dpr)} x ${Math.round(height * dpr)}`,
        label,
        value: dpr,
      })
    }
    add('0.5x', 0.5)
    add('1x', 1)
    if (dpr >= 2) add('2x', 2)
    if (dpr >= 3) add('3x', dpr)
    return options
  }, [])
  useEffect(() => {
    const onChange = changes => {
      if (changes.dpr) setDPR(changes.dpr.value)
      if (changes.shadows) setShadows(changes.shadows.value)
      if (changes.postprocessing) setPostprocessing(changes.postprocessing.value)
      if (changes.bloom) setBloom(changes.bloom.value)
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])
  return (
    <Menu title='Menu'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemSwitch
        label='Resolution'
        hint='Change your display resolution'
        options={dprOptions}
        value={dpr}
        onChange={dpr => world.prefs.setDPR(dpr)}
      />
      <MenuItemSwitch
        label='Shadows'
        hint='Change the quality of shadows in the world'
        options={shadowOptions}
        value={shadows}
        onChange={shadows => world.prefs.setShadows(shadows)}
      />
      <MenuItemToggle
        label='Postprocessing'
        hint='Enable or disable all postprocessing effects'
        trueLabel='On'
        falseLabel='Off'
        value={postprocessing}
        onChange={postprocessing => world.prefs.setPostprocessing(postprocessing)}
      />
      <MenuItemToggle
        label='Bloom'
        hint='Enable or disable the bloom effect'
        trueLabel='On'
        falseLabel='Off'
        value={bloom}
        onChange={bloom => world.prefs.setBloom(bloom)}
      />
    </Menu>
  )
}

function MenuMainAudio({ world, pop, push }) {
  const [music, setMusic] = useState(world.prefs.music)
  const [sfx, setSFX] = useState(world.prefs.sfx)
  const [voice, setVoice] = useState(world.prefs.voice)
  useEffect(() => {
    const onChange = changes => {
      if (changes.music) setMusic(changes.music.value)
      if (changes.sfx) setSFX(changes.sfx.value)
      if (changes.voice) setVoice(changes.voice.value)
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])
  return (
    <Menu title='Menu'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemRange
        label='Music'
        hint='Adjust general music volume'
        min={0}
        max={2}
        step={0.05}
        value={music}
        onChange={music => world.prefs.setMusic(music)}
      />
      <MenuItemRange
        label='SFX'
        hint='Adjust sound effects volume'
        min={0}
        max={2}
        step={0.05}
        value={sfx}
        onChange={sfx => world.prefs.setSFX(sfx)}
      />
      <MenuItemRange
        label='Voice'
        hint='Adjust global voice chat volume'
        min={0}
        max={2}
        step={0.05}
        value={voice}
        onChange={voice => world.prefs.setVoice(voice)}
      />
    </Menu>
  )
}

function MenuMainWorld({ world, pop, push }) {
  const player = world.entities.player
  const { isAdmin } = usePermissions(world)
  const [title, setTitle] = useState(world.settings.title)
  const [desc, setDesc] = useState(world.settings.desc)
  const [model, setModel] = useState(world.settings.model)
  const [avatar, setAvatar] = useState(world.settings.avatar)
  const [playerLimit, setPlayerLimit] = useState(world.settings.playerLimit)
  const [publicc, setPublic] = useState(world.settings.public)
  useEffect(() => {
    const onChange = changes => {
      if (changes.title) setTitle(changes.title.value)
      if (changes.desc) setDesc(changes.desc.value)
      if (changes.model) setModel(changes.model.value)
      if (changes.avatar) setAvatar(changes.avatar.value)
      if (changes.playerLimit) setPlayerLimit(changes.playerLimit.value)
      if (changes.public) setPublic(changes.public.value)
    }
    world.settings.on('change', onChange)
    return () => {
      world.settings.off('change', onChange)
    }
  }, [])
  return (
    <Menu title='Menu'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemText
        label='Title'
        hint='Change the title of this world. Shown in the browser tab and when sharing links'
        placeholder='World'
        value={title}
        onChange={value => world.settings.set('title', value, true)}
      />
      <MenuItemText
        label='Description'
        hint='Change the description of this world. Shown in previews when sharing links to this world'
        value={desc}
        onChange={value => world.settings.set('desc', value, true)}
      />
      <MenuItemFile
        label='Environment'
        hint='Change the global environment model'
        kind='model'
        value={model}
        onChange={value => world.settings.set('model', value, true)}
        world={world}
      />
      <MenuItemFile
        label='Avatar'
        hint='Change the default avatar everyone spawns into the world with'
        kind='avatar'
        value={avatar}
        onChange={value => world.settings.set('avatar', value, true)}
        world={world}
      />
      <MenuItemNumber
        label='Player Limit'
        hint='Set a maximum number of players that can be in the world at one time. Zero means unlimited.'
        value={playerLimit}
        onChange={value => world.settings.set('playerLimit', value, true)}
      />
      {isAdmin && (
        <MenuItemToggle
          label='Public'
          hint='Allow everyone to build (and destroy) things in the world. When disabled only admins can build.'
          value={publicc}
          onChange={value => world.settings.set('public', value, true)}
        />
      )}
      <MenuItemBtn
        label='Set Spawn'
        hint='Sets the location players spawn to the location you are currently standing'
        onClick={() => {
          world.network.send('spawnModified', 'set')
        }}
      />
      <MenuItemBtn
        label='Clear Spawn'
        hint='Resets the spawn point to origin'
        onClick={() => {
          world.network.send('spawnModified', 'clear')
        }}
      />
    </Menu>
  )
}
