// import { css } from '../utils/css' // Removed css utility
import { MessageSquareIcon, RefreshCwIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// import { CodeEditor } from './CodeEditor'
import { buttons, propToLabel } from '../../core/extras/buttons'
import { ControlPriorities } from '../../core/extras/ControlPriorities'
import { cls, isTouch } from '../utils'
import { AvatarPane } from './AvatarPane'
import { MouseLeftIcon } from './MouseLeftIcon'
import { MouseRightIcon } from './MouseRightIcon'
import { MouseWheelIcon } from './MouseWheelIcon'
// import { AppsPane } from './AppsPane'
// import { MenuMain } from './MenuMain'
// import { MenuApp } from './MenuApp'
import { ChevronDoubleUpIcon, HandIcon } from './Icons'
import { Sidebar } from './Sidebar'

export function CoreUI({ world }: { world: any }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [ready, setReady] = useState(false)
  const [player, setPlayer] = useState(() => world.entities.player)
  const [ui, setUI] = useState(world.ui.state)
  const [menu, setMenu] = useState(null)
  const [code, setCode] = useState(false)
  const [settings, setSettings] = useState(false)
  const [avatar, setAvatar] = useState<any>(null)
  const [disconnected, setDisconnected] = useState(false)
  const [apps, setApps] = useState(false)
  const [kicked, setKicked] = useState<string | null>(null)
  useEffect(() => {
    world.on('ready', setReady)
    world.on('player', setPlayer)
    world.on('ui', setUI)
    world.on('menu', setMenu)
    world.on('code', setCode)
    world.on('apps', setApps)
    world.on('avatar', setAvatar)
    world.on('kick', setKicked)
    world.on('disconnect', setDisconnected)
    return () => {
      world.off('ready', setReady)
      world.off('player', setPlayer)
      world.off('ui', setUI)
      world.off('menu', setMenu)
      world.off('code', setCode)
      world.off('apps', setApps)
      world.off('avatar', setAvatar)
      world.off('kick', setKicked)
      world.off('disconnect', setDisconnected)
    }
  }, [])

  useEffect(() => {
    const elem = ref.current
    if (!elem) return
    const onEvent = (e: any) => {
      (e as any).isCoreUI = true
    }
    elem.addEventListener('wheel', onEvent)
    elem.addEventListener('click', onEvent)
    elem.addEventListener('pointerdown', onEvent)
    elem.addEventListener('pointermove', onEvent)
    elem.addEventListener('pointerup', onEvent)
    elem.addEventListener('touchstart', onEvent)
    // elem.addEventListener('touchmove', onEvent)
    // elem.addEventListener('touchend', onEvent)
  }, [])
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * world.prefs.ui}px`
    function onChange(changes: any) {
      if (changes.ui) {
        document.documentElement.style.fontSize = `${16 * world.prefs.ui}px`
      }
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])
  return (
    <div
      ref={ref}
      className='coreui'
      style={{
        position: 'absolute',
        inset: '0',
        overflow: 'hidden'
      }}
    >
      {disconnected && <Disconnected />}
      {!ui.reticleSuppressors && <Reticle world={world} />}
      {<Toast world={world} />}
      {ready && <ActionsBlock world={world} />}
      {ready && <Sidebar world={world} ui={ui} />}
      {ready && <Chat world={world} />}
      {/* {ready && <Side world={world} player={player} menu={menu} />} */}
      {/* {ready && menu?.type === 'app' && code && (
        <CodeEditor key={`code-${menu.app.data.id}`} world={world} app={menu.app} blur={menu.blur} />
      )} */}
      {avatar && <AvatarPane key={avatar.hash} world={world} info={avatar} />}
      {/* {apps && <AppsPane world={world} close={() => world.ui.toggleApps()} />} */}
      {!ready && <LoadingOverlay world={world} />}
      {kicked && <KickedOverlay code={kicked} />}
      {ready && isTouch && <TouchBtns world={world} />}
      <div id='core-ui-portal' />
    </div>
  )
}

// function Side({ world, menu }) {
//   const inputRef = useRef()
//   const [msg, setMsg] = useState('')
//   const [chat, setChat] = useState(false)
//   const [livekit, setLiveKit] = useState(() => world.livekit.status)
//   const [actions, setActions] = useState(() => world.prefs.actions)
//   useEffect(() => {
//     const onPrefsChange = changes => {
//       if (changes.actions) setActions(changes.actions.value)
//     }
//     const onLiveKitStatus = status => {
//       setLiveKit({ ...status })
//     }
//     world.livekit.on('status', onLiveKitStatus)
//     world.prefs.on('change', onPrefsChange)
//     return () => {
//       world.prefs.off('change', onPrefsChange)
//       world.livekit.off('status', onLiveKitStatus)
//     }
//   }, [])
//   useEffect(() => {
//     const control = world.controls.bind({ priority: ControlPriorities.CORE_UI })
//     control.slash.onPress = () => {
//       if (!chat) setChat(true)
//     }
//     control.enter.onPress = () => {
//       if (!chat) setChat(true)
//     }
//     control.mouseLeft.onPress = () => {
//       if (control.pointer.locked && chat) {
//         setChat(false)
//       }
//     }
//     return () => control.release()
//   }, [chat])
//   useEffect(() => {
//     if (chat) {
//       inputRef.current.focus()
//     } else {
//       inputRef.current.blur()
//     }
//   }, [chat])
//   const send = async e => {
//     if (world.controls.pointer.locked) {
//       setTimeout(() => setChat(false), 10)
//     }
//     if (!msg) {
//       e.preventDefault()
//       return setChat(false)
//     }
//     setMsg('')
//     // check for commands
//     if (msg.startsWith('/')) {
//       world.chat.command(msg)
//       return
//     }
//     // otherwise post it
//     const player = world.entities.player
//     const data = {
//       id: uuid(),
//       from: player.data.name,
//       fromId: player.data.id,
//       body: msg,
//       createdAt: moment().toISOString(),
//     }
//     world.chat.add(data, true)
//     if (isTouch) {
//       e.target.blur()
//       // setTimeout(() => setChat(false), 10)
//     }
//   }
//   return (
//     <div
//       className='side'
//       css={css`
//         position: absolute;
//         top: calc(4rem + env(safe-area-inset-top));
//         left: calc(4rem + env(safe-area-inset-left));
//         bottom: calc(4rem + env(safe-area-inset-bottom));
//         right: calc(4rem + env(safe-area-inset-right));
//         display: flex;
//         align-items: stretch;
//         font-size: 1rem;
//         .side-content {
//           max-width: 21rem;
//           width: 100%;
//           display: flex;
//           flex-direction: column;
//           align-items: stretch;
//         }
//         .side-btns {
//           display: flex;
//           align-items: center;
//           margin-left: -0.5rem;
//         }
//         .side-btn {
//           pointer-events: auto;
//           /* margin-bottom: 1rem; */
//           width: 2.5rem;
//           height: 2.5rem;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           cursor: pointer;
//           svg {
//             filter: drop-shadow(0 0.0625rem 0.125rem rgba(0, 0, 0, 0.2));
//           }
//         }
//         .side-mid {
//           flex: 1;
//           display: flex;
//           flex-direction: column;
//           justify-content: center;
//         }
//         .side-chatbox {
//           margin-top: 0.5rem;
//           background: rgba(0, 0, 0, 0.3);
//           padding: 0.625rem;
//           display: flex;
//           align-items: center;
//           opacity: 0;
//           &.active {
//             opacity: 1;
//             pointer-events: auto;
//           }
//           &-input {
//             flex: 1;
//             /* paint-order: stroke fill; */
//             /* -webkit-text-stroke: 0.25rem rgba(0, 0, 0, 0.2); */
//             &::placeholder {
//               color: rgba(255, 255, 255, 0.5);
//             }
//           }
//         }
//         @media all and (max-width: 700px), (max-height: 700px) {
//           top: calc(1.5rem + env(safe-area-inset-top));
//           left: calc(1.5rem + env(safe-area-inset-left));
//           bottom: calc(1.5rem + env(safe-area-inset-bottom));
//           right: calc(1.5rem + env(safe-area-inset-right));
//         }
//       `}
//     >
//       <div className='side-content'>
//         <div className='side-btns'>
//           <div className='side-btn' onClick={() => world.ui.toggleMain()}>
//             <MenuIcon size='1.5rem' />
//           </div>
//           {isTouch && (
//             <div
//               className='side-btn'
//               onClick={() => {
//                 console.log('setChat', !chat)
//                 setChat(!chat)
//               }}
//             >
//               <ChatIcon size='1.5rem' />
//             </div>
//           )}
//           {livekit.connected && (
//             <div
//               className='side-btn'
//               onClick={() => {
//                 world.livekit.setMicrophoneEnabled()
//               }}
//             >
//               {livekit.mic ? <MicIcon size='1.5rem' /> : <MicOffIcon size='1.5rem' />}
//             </div>
//           )}
//           {world.xr.supportsVR && (
//             <div
//               className='side-btn'
//               onClick={() => {
//                 world.xr.enter()
//               }}
//             >
//               <VRIcon size='1.5rem' />
//             </div>
//           )}
//         </div>
//         {menu?.type === 'main' && <MenuMain world={world} />}
//         {menu?.type === 'app' && <MenuApp key={menu.app.data.id} world={world} app={menu.app} blur={menu.blur} />}
//         <div className='side-mid'>{!menu && !isTouch && actions && <Actions world={world} />}</div>
//         {isTouch && !chat && <MiniMessages world={world} />}
//         {(isTouch ? chat : true) && <Messages world={world} active={chat || menu} />}
//         <label className={cls('side-chatbox', { active: chat })}>
//           <input
//             ref={inputRef}
//             className='side-chatbox-input'
//             type='text'
//             placeholder='Say something...'
//             value={msg}
//             onChange={e => setMsg(e.target.value)}
//             onKeyDown={e => {
//               if (e.code === 'Escape') {
//                 setChat(false)
//               }
//               // meta quest 3 isn't spec complaint and instead has e.code = '' and e.key = 'Enter'
//               // spec says e.code should be a key code and e.key should be the text output of the key eg 'b', 'B', and '\n'
//               if (e.code === 'Enter' || e.key === 'Enter') {
//                 send(e)
//               }
//             }}
//             onBlur={e => {
//               if (!isTouch) {
//                 setChat(false)
//               }
//             }}
//           />
//         </label>
//       </div>
//     </div>
//   )
// }

function Chat({ world }: { world: any }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [msg, setMsg] = useState('')
  const [active, setActive] = useState(false)
  useEffect(() => {
    const onToggle = () => {
      setActive(!active)
    }
    world.on('sidebar-chat-toggle', onToggle)
    return () => {
      world.off('sidebar-chat-toggle', onToggle)
    }
  }, [])
  useEffect(() => {
    const control = world.controls.bind({ priority: ControlPriorities.CORE_UI })
    control.slash.onPress = () => {
      if (!active) setActive(true)
    }
    control.enter.onPress = () => {
      if (!active) setActive(true)
    }
    control.mouseLeft.onPress = () => {
      if (control.pointer.locked && active) {
        setActive(false)
      }
    }
    return () => control.release()
  }, [active])
  useEffect(() => {
    if (active && inputRef.current) {
      inputRef.current.focus()
    } else if (inputRef.current) {
      inputRef.current.blur()
    }
  }, [active])
  const send = async (e: any) => {
    if (world.controls.pointer.locked) {
      setTimeout(() => setActive(false), 10)
    }
    if (!msg) {
      e.preventDefault()
      return setActive(false)
    }
    setMsg('')
    // check for commands
    if (msg.startsWith('/')) {
      world.chat.command(msg)
      return
    }
    // otherwise post it
    world.chat.send(msg)
    if (isTouch) {
      // setActive(false)
      e.target.blur()
      setTimeout(() => setActive(false), 10)
    }
  }
  return (
    <div
      className={cls('mainchat', { active })}
      style={{
        position: 'absolute',
        left: 'calc(2rem + env(safe-area-inset-left))',
        bottom: 'calc(2rem + env(safe-area-inset-bottom))',
        width: '20rem',
        fontSize: '1rem',
        pointerEvents: active ? 'auto' : 'none',
      }}
    >
      <style>{`
        @media all and (max-width: 1200px) {
          .mainchat {
            left: calc(1rem + env(safe-area-inset-left)) !important;
            bottom: calc(1rem + env(safe-area-inset-bottom)) !important;
          }
        }
        .mainchat-msgs {
          padding: 0 0 0.5rem 0.4rem;
        }
        .mainchat-btn {
          pointer-events: auto;
          width: 2.875rem;
          height: 2.875rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(11, 10, 21, 0.85);
          border: 0.0625rem solid #2a2b39;
          border-radius: 1rem;
          opacity: ${active ? '0' : '1'};
          cursor: pointer;
        }
        .mainchat-entry {
          height: 2.875rem;
          padding: 0 0.8rem;
          background: rgba(11, 10, 21, 0.85);
          border: 0.0625rem solid #2a2b39;
          border-radius: 1rem;
          backdrop-filter: blur(5px);
          display: ${active ? 'flex' : 'none'};
          align-items: center;
        }
        .mainchat-entry input {
          font-size: 0.9375rem;
          line-height: 1;
        }
      `}</style>
      <div className='mainchat-msgs'>
        {isTouch && !active && <MiniMessages world={world} />}
        {(!isTouch || active) && <Messages world={world} active={active} />}
      </div>
      <div
        className='mainchat-btn'
        onClick={() => {
          setActive(true)
        }}
      >
        <MessageSquareIcon size='1.125rem' />
      </div>
      <label className='mainchat-entry'>
        <input
          ref={inputRef}
          className='side-chatbox-input'
          type='text'
          placeholder='Say something...'
          value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => {
            if (e.code === 'Escape') {
              setActive(false)
            }
            // meta quest 3 isn't spec complaint and instead has e.code = '' and e.key = 'Enter'
            // spec says e.code should be a key code and e.key should be the text output of the key eg 'b', 'B', and '\n'
            if (e.code === 'Enter' || e.key === 'Enter') {
              send(e)
            }
          }}
          onBlur={e => {
            if (!isTouch) {
              setActive(false)
            }
          }}
        />
      </label>
    </div>
  )
}

function MiniMessages({ world }: { world: any }) {
  const [msg, setMsg] = useState<any>(null)
  useEffect(() => {
    let init: boolean
    return world.chat.subscribe((msgs: any[]) => {
      if (!init) {
        init = true
        return // skip first
      }
      const msg = msgs[msgs.length - 1]
      if (msg.fromId === world.network.id) return
      setMsg(msg)
    })
  }, [])
  if (!msg) return null
  return (
    <div className='minimessages'>
      <Message msg={msg} />
    </div>
  )
}

const MESSAGES_REFRESH_RATE = 30 // every x seconds

function Messages({ world, active }: { world: any; active: boolean }) {
  const initRef = useRef<boolean>(false)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const spacerRef = useRef<HTMLDivElement | null>(null)
  // const [now, setNow] = useState(() => moment())
  const [msgs, setMsgs] = useState<any[]>([])
  useEffect(() => {
    return world.chat.subscribe(setMsgs)
  }, [])
  // useEffect(() => {
  //   const interval = setInterval(() => setNow(moment()), MESSAGES_REFRESH_RATE * 1000)
  //   return () => clearInterval(interval)
  // }, [])
  useEffect(() => {
    setTimeout(() => {
      const didInit = initRef.current
      initRef.current = true
      contentRef.current?.scroll({
        top: 9999999,
        behavior: (didInit ? 'instant' : 'smooth') as ScrollBehavior,
      })
    }, 10)
  }, [msgs])
  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const observer = new MutationObserver(() => {
      if (spacerRef.current && contentRef.current) {
        spacerRef.current.style.height = contentRef.current.offsetHeight + 'px'
      }
      contentRef.current?.scroll({
        top: 9999999,
        behavior: 'instant' as ScrollBehavior,
      })
    })
    observer.observe(content, { childList: true })
    return () => {
      observer.disconnect()
    }
  }, [])
  return (
    <div
      ref={contentRef}
      className={cls('messages noscrollbar', { active })}
      style={{
        flex: 1,
        maxHeight: '16rem',
        transition: 'all 0.15s ease-out',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        overflowY: 'auto',
        WebkitMaskImage: 'linear-gradient(to top, black calc(100% - 10rem), black 10rem, transparent)',
        maskImage: 'linear-gradient(to top, black calc(100% - 10rem), black 10rem, transparent)',
        pointerEvents: active ? 'auto' : 'none',
      }}
    >
      <style>{`
        .messages-spacer {
          flex-shrink: 0;
        }
      `}</style>
      <div className='messages-spacer' ref={spacerRef} />
      {msgs.map(msg => (
        <Message key={msg.id} msg={msg} />
      ))}
    </div>
  )
}

function Message({ msg }: { msg: any }) {
  // const timeAgo = useMemo(() => {
  //   const createdAt = moment(msg.createdAt)
  //   const age = now.diff(createdAt, 'seconds')
  //   // up to 10s ago show now
  //   if (age < 10) return 'now'
  //   // under a minute show seconds
  //   if (age < 60) return `${age}s ago`
  //   // under an hour show minutes
  //   if (age < 3600) return Math.floor(age / 60) + 'm ago'
  //   // under a day show hours
  //   if (age < 86400) return Math.floor(age / 3600) + 'h ago'
  //   // otherwise show days
  //   return Math.floor(age / 86400) + 'd ago'
  // }, [now])
  return (
    <div
      className='message'
      style={{
        padding: '0.25rem 0',
        lineHeight: 1.4,
        fontSize: '1rem',
        paintOrder: 'stroke fill',
        WebkitTextStroke: '0.25rem rgba(0, 0, 0, 0.2)',
      }}
    >
      <style>{`
        .message-from {
          margin-right: 0.25rem;
        }
      `}</style>
      {msg.from && <span className='message-from'>[{msg.from}]</span>}
      <span className='message-body'>{msg.body}</span>
      {/* <span>{timeAgo}</span> */}
    </div>
  )
}

function Disconnected() {
  // useEffect(() => {
  //   document.body.style.filter = 'grayscale(100%)'
  //   return () => {
  //     document.body.style.filter = null
  //   }
  // }, [])
  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backdropFilter: 'grayscale(100%)',
          pointerEvents: 'none',
          zIndex: 9999,
          animation: 'fadeIn 3s forwards',
        }}
      />
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
      <div
        className="disconnected-btn"
        style={{
          pointerEvents: 'auto',
          position: 'absolute',
          top: '50%',
          left: '50%',
          background: 'rgba(11, 10, 21, 0.85)',
          border: '0.0625rem solid #2a2b39',
          backdropFilter: 'blur(5px)',
          borderRadius: '1rem',
          height: '2.75rem',
          padding: '0 1rem',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => window.location.reload()}
      >
        <style>{`
          .disconnected-btn > span {
            margin-left: 0.4rem;
          }
        `}</style>
        <RefreshCwIcon size={18} />
        <span>Reconnect</span>
      </div>
    </>
  )
}

function LoadingOverlay({ world }: { world: any }) {
  const [progress, setProgress] = useState(0)
  const { title, desc, image } = world.settings
  useEffect(() => {
    console.log('[LoadingOverlay] Mounted, listening for progress events')
    const handleProgress = (value: number) => {
      console.log('[LoadingOverlay] Progress update:', value)
      setProgress(value)
    }
    world.on('progress', handleProgress)
    return () => {
      console.log('[LoadingOverlay] Unmounted')
      world.off('progress', handleProgress)
    }
  }, [])
  useEffect(() => {
    console.log('[LoadingOverlay] Progress changed to:', progress)
  }, [progress])
  return (
    <div
      style={{
        position: 'absolute',
        inset: '0',
        background: 'black',
        display: 'flex',
        pointerEvents: 'auto',
      }}
    >
      <style>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
          }
        }
        .loading-image {
          position: absolute;
          inset: 0;
          background-position: center;
          background-size: cover;
          background-repeat: no-repeat;
          background-image: ${image ? `url(${world.resolveURL(image.url)})` : 'none'};
          animation: pulse 5s ease-in-out infinite;
        }
        .loading-shade {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(15px);
        }
        .loading-info {
          position: absolute;
          bottom: 50px;
          left: 50px;
          right: 50px;
          max-width: 28rem;
        }
        .loading-title {
          font-size: 2.4rem;
          line-height: 1.2;
          font-weight: 600;
          margin: 0 0 0.5rem;
        }
        .loading-desc {
          color: rgba(255, 255, 255, 0.9);
          font-size: 1rem;
          margin: 0 0 20px;
        }
        .loading-track {
          height: 5px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.1);
          position: relative;
        }
        .loading-bar {
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: ${progress}%;
          background: white;
          border-radius: 3px;
          transition: width 0.2s ease-out;
        }
      `}</style>
      <div className='loading-image' />
      <div className='loading-shade' />
      <div className='loading-info'>
        {title && <div className='loading-title'>{title}</div>}
        {desc && <div className='loading-desc'>{desc}</div>}
        <div className='loading-track'>
          <div className='loading-bar' />
        </div>
      </div>
    </div>
  )
}

const kickMessages: Record<string, string> = {
  duplicate_user: 'Player already active on another device or window.',
  player_limit: 'Player limit reached.',
  unknown: 'You were kicked.',
}
function KickedOverlay({ code }: { code: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'black',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}
    >
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .kicked-overlay svg {
          animation: spin 1s linear infinite;
        }
      `}</style>
      <div className="kicked-overlay">{kickMessages[code] || kickMessages.unknown}</div>
    </div>
  )
}

function ActionsBlock({ world }: { world: any }) {
  const [showActions, setShowActions] = useState(() => world.prefs.actions)
  useEffect(() => {
    const onPrefsChange = (changes: any) => {
      if (changes.actions) setShowActions(changes.actions.value)
    }
    world.prefs.on('change', onPrefsChange)
    return () => {
      world.prefs.off('change', onPrefsChange)
    }
  }, [])
  if (isTouch) return null
  if (!showActions) return null
  return (
    <div
      className="actions-block"
      style={{
        position: 'absolute',
        top: 'calc(2rem + env(safe-area-inset-top))',
        left: 'calc(2rem + env(safe-area-inset-left))',
        bottom: 'calc(2rem + env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <style>{`
        @media all and (max-width: 1200px) {
          .actions-block {
            top: calc(1rem + env(safe-area-inset-top)) !important;
            left: calc(1rem + env(safe-area-inset-left)) !important;
            bottom: calc(1rem + env(safe-area-inset-bottom)) !important;
          }
        }
      `}</style>
      <Actions world={world} />
    </div>
  )
}

function Actions({ world }: { world: any }) {
  const [actions, setActions] = useState(() => world.controls.actions)
  useEffect(() => {
    world.on('actions', setActions)
    return () => world.off('actions', setActions)
  }, [])
  return (
    <div
      className='actions'
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <style>{`
        .actions-item {
          display: flex;
          align-items: center;
          margin: 0 0 0.5rem;
        }
        .actions-item-label {
          margin-left: 0.625em;
          paint-order: stroke fill;
          -webkit-text-stroke: 0.25rem rgba(0, 0, 0, 0.2);
        }
      `}</style>
      {actions.map((action: any) => (
        <div className='actions-item' key={action.id}>
          <div className='actions-item-icon'>{getActionIcon(action)}</div>
          <div className='actions-item-label'>{action.label}</div>
        </div>
      ))}
    </div>
  )
}

function getActionIcon(action: any) {
  if (action.type === 'custom') {
    return <ActionPill label={action.btn} />
  }
  if (action.type === 'controlLeft') {
    return <ActionPill label='Ctrl' />
  }
  if (action.type === 'mouseLeft') {
    return <ActionIcon icon={MouseLeftIcon} />
  }
  if (action.type === 'mouseRight') {
    return <ActionIcon icon={MouseRightIcon} />
  }
  if (action.type === 'mouseWheel') {
    return <ActionIcon icon={MouseWheelIcon} />
  }
  if (buttons.has(action.type)) {
    return <ActionPill label={propToLabel[action.type]} />
  }
  return <ActionPill label='?' />
}

function ActionPill({ label }: { label: string }) {
  return (
    <div
      className='actionpill'
      style={{
        border: '0.0625rem solid white',
        borderRadius: '0.25rem',
        background: 'rgba(0, 0, 0, 0.1)',
        padding: '0.25rem 0.375rem',
        fontSize: '0.875em',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
        paintOrder: 'stroke fill',
        WebkitTextStroke: '0.25rem rgba(0, 0, 0, 0.2)',
      }}
    >
      {label}
    </div>
  )
}

function ActionIcon({ icon }: { icon: any }) {
  const Icon = icon;
  return (
    <div
      className='actionicon'
      style={{
        lineHeight: 0,
      }}
    >
      <style>{`
        .actionicon svg {
          filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.8));
        }
      `}</style>
      <Icon size='1.5rem' />
    </div>
  )
}

function Reticle({ world }: { world: any }) {
  const [visible, setVisible] = useState(world.controls.pointer.locked)
  const [buildMode, setBuildMode] = useState(world.builder.enabled)
  useEffect(() => {
    world.on('pointer-lock', setVisible)
    world.on('build-mode', setBuildMode)
    return () => {
      world.off('pointer-lock', setVisible)
      world.off('build-mode', setBuildMode)
    }
  }, [])
  if (!visible) return null
  return (
    <div
      className='reticle'
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1rem',
      }}
    >
      <div className='reticle-item' style={{
        width: '1.25rem',
        height: '1.25rem',
        borderRadius: '0.625rem',
        border: `0.125rem solid ${buildMode ? '#ff4d4d' : 'white'}`,
        mixBlendMode: buildMode ? 'normal' : 'difference',
      }} />
    </div>
  )
}

function Toast({ world }: { world: any }) {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null)
  useEffect(() => {
    let ids = 0
    const onToast = (text: string) => {
      setMsg({ text, id: ++ids })
    }
    world.on('toast', onToast)
    return () => world.off('toast', onToast)
  }, [])
  if (!msg) return null
  return (
    <div
      className='toast'
      style={{
        position: 'absolute',
        top: 'calc(50% - 4.375rem)',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <style>{`
        @keyframes toastIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .toast-msg {
          height: 2.875rem;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 1rem;
          background: rgba(11, 10, 21, 0.85);
          border: 0.0625rem solid #2a2b39;
          backdrop-filter: blur(5px);
          border-radius: 1.4375rem;
          opacity: 0;
          transform: translateY(0.625rem) scale(0.9);
          transition: all 0.1s ease-in-out;
        }
        .toast-msg.visible {
          opacity: 1;
          transform: translateY(0) scale(1);
          animation: toastIn 0.1s ease-in-out;
        }
      `}</style>
      {msg && <ToastMsg key={msg.id} text={msg.text} />}
    </div>
  )
}

function ToastMsg({ text }: { text: string }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    setTimeout(() => setVisible(false), 1000)
  }, [])
  return <div className={cls('toast-msg', { visible })}>{text}</div>
}

function TouchBtns({ world }: { world: any }) {
  const [isAction, setIsAction] = useState(() => world.prefs.touchAction)
  useEffect(() => {
    function onChange(isAction: boolean) {
      setIsAction(isAction)
    }
    world.prefs.on('touchAction', onChange)
    return () => world.prefs.off('touchAction', onChange)
  }, [])
  return (
    <div
      className='touchbtns'
      style={{
        position: 'absolute',
        bottom: 'calc(1rem + env(safe-area-inset-bottom))',
        right: 'calc(1rem + env(safe-area-inset-right))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      <style>{`
        .touchbtns-btn {
          pointer-events: auto;
          width: 3.5rem;
          height: 3.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(11, 10, 21, 0.85);
          border: 0.0625rem solid #2a2b39;
          backdrop-filter: blur(5px);
          border-radius: 1rem;
          box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.2);
          cursor: pointer;
        }
        .touchbtns-btn:active {
          transform: scale(0.95);
        }
        .touchbtns-btn.action {
          background: #ff4d4d;
          border-color: #ff6666;
        }
      `}</style>
      {isAction && (
        <div
          className='touchbtns-btn action'
          onClick={() => {
            world.controls.action.onPress()
          }}
        >
          <HandIcon size={24} />
        </div>
      )}
      <div
        className='touchbtns-btn'
        onClick={() => {
          world.controls.jump.onPress()
        }}
      >
        <ChevronDoubleUpIcon size={24} />
      </div>
    </div>
  )
}
