import { css } from '@firebolt-dev/css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LoaderIcon } from 'lucide-react'
import moment from 'moment'

import { CodeEditor } from './CodeEditor'
import { AvatarPane } from './AvatarPane'
import { useElemSize } from './useElemSize'
import { MouseLeftIcon } from './MouseLeftIcon'
import { MouseRightIcon } from './MouseRightIcon'
import { MouseWheelIcon } from './MouseWheelIcon'
import { buttons, propToLabel } from '../../core/extras/buttons'
import { cls, isTouch } from '../utils'
import { uuid } from '../../core/utils'
import { ControlPriorities } from '../../core/extras/ControlPriorities'
import { AppsPane } from './AppsPane'
import { MenuMain } from './MenuMain'
import { MenuApp } from './MenuApp'
import {
  ChatIcon,
  ChevronDoubleUpIcon,
  CircleUpIcon,
  HandIcon,
  KeyboardIcon,
  MenuIcon,
  MicIcon,
  MicOffIcon,
  SettingsIcon,
  VRIcon,
} from './Icons'
import { storage } from '../../core/storage'

export function CoreUI({ world }) {
  const [ref, width, height] = useElemSize()
  return (
    <div
      ref={ref}
      css={css`
        position: absolute;
        inset: 0;
        overflow: hidden;
      `}
    >
      {width > 0 && <Content world={world} width={width} height={height} />}
    </div>
  )
}

function AIButton({ world }) {
  const [showPrompt, setShowPrompt] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [response, setResponse] = useState('')
  const [streamOpen, setStreamOpen] = useState(false)
  const [showResponse, setShowResponse] = useState(false)
  const [authError, setAuthError] = useState(null)
  const inputRef = useRef(null)
  const eventSourceRef = useRef(null)
  const responseAreaRef = useRef(null)

  // Common styles
  const styleConfig = {
    colors: {
      background: 'rgba(20, 20, 20, 0.85)',
      border: 'rgba(255, 255, 255, 0.15)',
      borderActive: 'rgba(255, 255, 255, 0.3)',
      inputBg: 'rgba(0, 0, 0, 0.15)',
      statusBg: 'rgba(0, 0, 0, 0.25)',
      toolUseBg: 'rgba(60, 60, 80, 0.4)',
      errorBg: 'rgba(180, 30, 30, 0.4)',
    },
    radius: {
      button: '50%',
      panel: '1.5rem',
      input: '1rem',
    },
    shadows: {
      button: '0 2px 8px rgba(0, 0, 0, 0.2)',
      panel: '0 4px 20px rgba(0, 0, 0, 0.25)',
    },
  }

  useEffect(() => {
    if (showPrompt && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showPrompt])

  // Auto-resize textarea as content changes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      const scrollHeight = inputRef.current.scrollHeight
      inputRef.current.style.height = `${Math.min(scrollHeight, 150)}px`
    }
  }, [input, showPrompt])

  // Scroll response area to bottom when content changes
  useEffect(() => {
    if (responseAreaRef.current) {
      responseAreaRef.current.scrollTop = responseAreaRef.current.scrollHeight
    }
  }, [response, status])

  // Clean up event source on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const handleStreamResponse = async (query) => {
    // Get auth token from localStorage
    const authToken = storage.get('authToken')
    
    if (!authToken) {
      setAuthError('Not authenticated. Please refresh the page or log in again.')
      setStatus('Authentication error')
      setIsLoading(false)
      return
    }
    
    // Clear previous response and set loading state
    setResponse('')
    setStatus('Connecting...')
    setIsLoading(true)
    setShowResponse(true)
    setShowPrompt(false)
    setAuthError(null)
    
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    // Create a new SSE connection with auth token
    const encodedQuery = encodeURIComponent(query)
    const eventSource = new EventSource(`/mcp/stream?query=${encodedQuery}&authToken=${authToken}`)
    eventSourceRef.current = eventSource
    setStreamOpen(true)

    // Handle connection open
    eventSource.onopen = () => {
      console.log('SSE connection opened')
    }

    // Handle connection errors
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error)
      setStatus('Connection error. Please try again.')
      setIsLoading(false)
      eventSource.close()
      setStreamOpen(false)
      
      // Check if this might be an auth error (no specific error info from SSE)
      if (!response) {
        setAuthError('Connection failed. You may not have permission to use this feature.')
      }
    }

    // Handle various event types
    eventSource.addEventListener('start', (event) => {
      const data = JSON.parse(event.data)
      console.log('Started processing query:', data)
    })

    eventSource.addEventListener('status', (event) => {
      const data = JSON.parse(event.data)
      setStatus(data.status)
    })

    eventSource.addEventListener('text', (event) => {
      const data = JSON.parse(event.data)
      setResponse(prev => prev + data.text)
    })

    eventSource.addEventListener('tool_start', (event) => {
      const data = JSON.parse(event.data)
      setStatus(`Using tool: ${data.tool}...`)
      setResponse(prev => 
        prev + 
        (prev ? '\n\n' : '') + 
        `📌 Using tool: ${data.tool}\n` +
        `${JSON.stringify(data.args, null, 2)}`
      )
    })

    eventSource.addEventListener('tool_result', (event) => {
      const data = JSON.parse(event.data)
      console.log('Tool result:', data)
      // We don't add raw tool results to the response as it can be verbose
      // Just update status that tool completed
      setStatus(`Tool ${data.tool} completed`)
    })

    eventSource.addEventListener('tool_error', (event) => {
      const data = JSON.parse(event.data)
      setStatus(`Error using tool: ${data.tool}`)
      setResponse(prev => 
        prev + 
        `\n❌ Error using tool ${data.tool}: ${data.error}\n`
      )
    })

    eventSource.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data)
      setStatus('Done')
      setIsLoading(false)
      eventSource.close()
      setStreamOpen(false)
    })

    eventSource.addEventListener('error', (event) => {
      try {
        const data = JSON.parse(event.data)
        setStatus(`Error: ${data.error}`)
      } catch (err) {
        setStatus('An error occurred')
      }
      setIsLoading(false)
      eventSource.close()
      setStreamOpen(false)
    })
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!input.trim()) return

    try {
      await handleStreamResponse(input)
      // Clear input after submission
      setInput('')
    } catch (error) {
      console.error('Error sending prompt to API:', error)
      setStatus(`Error: ${error.message}`)
      setIsLoading(false)
    }
  }

  const closeResponse = () => {
    setShowResponse(false)
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    setStreamOpen(false)
    setIsLoading(false)
    setResponse('')
    setStatus('')
    setAuthError(null)
  }

  return (
    <>
      <div
        className='ai-button'
        css={css`
          position: fixed;
          bottom: calc(2rem + env(safe-area-inset-bottom));
          right: calc(50% - 1.25rem);
          width: 2.5rem;
          height: 2.5rem;
          border-radius: ${styleConfig.radius.button};
          background: ${styleConfig.colors.background};
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid ${styleConfig.colors.border};
          box-shadow: ${styleConfig.shadows.button};
          cursor: pointer;
          z-index: 100;
          pointer-events: auto;
          transition: transform 0.2s ease;

          &:hover {
            transform: scale(1.05);
            border-color: ${styleConfig.colors.borderActive};
          }

          &:active {
            transform: scale(0.95);
          }
        `}
        onClick={() => setShowPrompt(!showPrompt)}
      >
        <img src='/prompt.png' alt='AI Prompt' width='32' height='32' />
      </div>

      {showPrompt && (
        <div
          css={css`
            position: fixed;
            bottom: calc(5rem + env(safe-area-inset-bottom));
            right: calc(50% - 10rem);
            width: 20rem;
            z-index: 200;
            pointer-events: auto;
          `}
        >
          <div
            css={css`
              background: ${styleConfig.colors.background};
              border-radius: ${styleConfig.radius.panel};
              padding: 0.75rem;
              box-shadow: ${styleConfig.shadows.panel};
              backdrop-filter: blur(10px);
              position: relative;
              border: 1px solid ${styleConfig.colors.border};

              &:after {
                content: '';
                position: absolute;
                bottom: -10px;
                left: 50%;
                margin-left: -10px;
                border-width: 10px 10px 0;
                border-style: solid;
                border-color: ${styleConfig.colors.background} transparent transparent;
              }
            `}
          >
            <form onSubmit={handleSubmit}>
              <div
                css={css`
                  position: relative;
                  display: flex;
                  align-items: flex-start;
                `}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  css={css`
                    width: 100%;
                    background: ${styleConfig.colors.inputBg};
                    border: 1px solid ${styleConfig.colors.border};
                    border-radius: ${styleConfig.radius.input};
                    padding: 0.75rem;
                    color: white;
                    font-size: 1rem;
                    outline: none;
                    min-height: 3rem;
                    max-height: 150px;
                    resize: none;
                    overflow-y: auto;
                    font-family: inherit;
                    line-height: 1.4;
                    padding-right: 2.5rem;
                    transition: border-color 0.2s ease;

                    &:focus {
                      border-color: ${styleConfig.colors.borderActive};
                    }
                  `}
                  placeholder='Prompt something...'
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                />
                <button
                  type='submit'
                  disabled={isLoading}
                  css={css`
                    position: absolute;
                    right: 0.25rem;
                    bottom: 0.25rem;
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: ${isLoading ? 0.5 : 1};
                    padding: 0.4rem;
                  `}
                >
                  {isLoading ? (
                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                      <path
                        d='M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z'
                        fill='white'
                        opacity='0.3'
                      />
                      <path d='M12 4V8' stroke='white' strokeWidth='3' strokeLinecap='round'>
                        <animateTransform
                          attributeName='transform'
                          attributeType='XML'
                          type='rotate'
                          from='0 12 12'
                          to='360 12 12'
                          dur='1s'
                          repeatCount='indefinite'
                        />
                      </path>
                    </svg>
                  ) : (
                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                      <path d='M2.01 21L23 12 2.01 3 2 10l15 2-15 2z' fill='white' />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResponse && (
        <div
          css={css`
            position: fixed;
            bottom: calc(7rem + env(safe-area-inset-bottom));
            right: calc(50% - 20rem);
            width: 40rem;
            max-height: 60vh;
            z-index: 150;
            pointer-events: auto;
            background: ${styleConfig.colors.background};
            border-radius: ${styleConfig.radius.panel};
            padding: 1rem;
            box-shadow: ${styleConfig.shadows.panel};
            backdrop-filter: blur(10px);
            border: 1px solid ${styleConfig.colors.border};
            display: flex;
            flex-direction: column;
            @media (max-width: 768px) {
              width: 90vw;
              right: 5vw;
              left: 5vw;
            }
          `}
        >
          <div
            css={css`
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 0.5rem;
            `}
          >
            <div
              css={css`
                font-size: 0.9rem;
                padding: 0.25rem 0.5rem;
                background: ${styleConfig.colors.statusBg};
                border-radius: 0.25rem;
                display: flex;
                align-items: center;
              `}
            >
              {isLoading && (
                <svg 
                  width='14' 
                  height='14' 
                  viewBox='0 0 24 24' 
                  fill='none' 
                  xmlns='http://www.w3.org/2000/svg'
                  css={css`
                    margin-right: 0.25rem;
                    @keyframes spin {
                      from { transform: rotate(0deg); }
                      to { transform: rotate(360deg); }
                    }
                    animation: spin 1s linear infinite;
                  `}
                >
                  <path 
                    d='M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z' 
                    fill='white' 
                    opacity='0.3'
                  />
                  <path d='M12 4V8' stroke='white' strokeWidth='3' strokeLinecap='round' />
                </svg>
              )}
              {status}
            </div>
            <button
              onClick={closeResponse}
              css={css`
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 1.2rem;
                padding: 0.25rem;
                opacity: 0.7;
                transition: opacity 0.2s;
                &:hover {
                  opacity: 1;
                }
              `}
            >
              ×
            </button>
          </div>
          
          {authError && (
            <div
              css={css`
                margin-bottom: 0.5rem;
                padding: 0.5rem;
                background: ${styleConfig.colors.errorBg};
                border-radius: ${styleConfig.radius.input};
                font-size: 0.9rem;
              `}
            >
              {authError}
            </div>
          )}
          
          <div
            ref={responseAreaRef}
            css={css`
              flex: 1;
              overflow-y: auto;
              max-height: calc(60vh - ${authError ? '6rem' : '3rem'});
              white-space: pre-wrap;
              font-family: monospace;
              line-height: 1.5;
              padding: 0.5rem;
              background: ${styleConfig.colors.inputBg};
              border-radius: ${styleConfig.radius.input};
              border: 1px solid ${styleConfig.colors.border};
            `}
          >
            {response}
          </div>
        </div>
      )}
    </>
  )
}

function Content({ world, width, height }) {
  const ref = useRef()
  const small = width < 600
  const [ready, setReady] = useState(false)
  const [player, setPlayer] = useState(() => world.entities.player)
  const [visible, setVisible] = useState(world.ui.visible)
  const [menu, setMenu] = useState(null)
  const [code, setCode] = useState(false)
  const [avatar, setAvatar] = useState(null)
  const [disconnected, setDisconnected] = useState(false)
  const [apps, setApps] = useState(false)
  const [kicked, setKicked] = useState(null)
  const [buildMode, setBuildMode] = useState(world.builder.enabled)

  useEffect(() => {
    world.on('ready', setReady)
    world.on('player', setPlayer)
    world.on('ui', setVisible)
    world.on('menu', setMenu)
    world.on('code', setCode)
    world.on('apps', setApps)
    world.on('avatar', setAvatar)
    world.on('kick', setKicked)
    world.on('disconnect', setDisconnected)
    world.on('build-mode', setBuildMode)
    return () => {
      world.off('ready', setReady)
      world.off('player', setPlayer)
      world.off('ui', setVisible)
      world.off('menu', setMenu)
      world.off('code', setCode)
      world.off('apps', setApps)
      world.off('avatar', setAvatar)
      world.off('kick', setKicked)
      world.off('disconnect', setDisconnected)
      world.off('build-mode', setBuildMode)
    }
  }, [])

  useEffect(() => {
    const elem = ref.current
    const onEvent = e => {
      e.isCoreUI = true
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
    function onChange(changes) {
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
      css={css`
        position: absolute;
        inset: 0;
        display: ${visible ? 'block' : 'none'};
      `}
    >
      {disconnected && <Disconnected />}
      <Reticle world={world} />
      {<Toast world={world} />}
      {ready && <Side world={world} player={player} menu={menu} />}
      {ready && menu?.type === 'app' && code && (
        <CodeEditor key={`code-${menu.app.data.id}`} world={world} app={menu.app} blur={menu.blur} />
      )}
      {avatar && <AvatarPane key={avatar.hash} world={world} info={avatar} />}
      {apps && <AppsPane world={world} close={() => world.ui.toggleApps()} />}
      {!ready && <LoadingOverlay />}
      {kicked && <KickedOverlay code={kicked} />}
      {ready && isTouch && <TouchBtns world={world} />}
      <div id='core-ui-portal' />
      {ready && buildMode && <AIButton world={world} />}
    </div>
  )
}

function Side({ world, menu }) {
  const inputRef = useRef()
  const [msg, setMsg] = useState('')
  const [chat, setChat] = useState(false)
  const [livekit, setLiveKit] = useState(() => world.livekit.status)
  const [actions, setActions] = useState(() => world.prefs.actions)
  useEffect(() => {
    const onPrefsChange = changes => {
      if (changes.actions) setActions(changes.actions.value)
    }
    const onLiveKitStatus = status => {
      setLiveKit({ ...status })
    }
    world.livekit.on('status', onLiveKitStatus)
    world.prefs.on('change', onPrefsChange)
    return () => {
      world.prefs.off('change', onPrefsChange)
      world.livekit.off('status', onLiveKitStatus)
    }
  }, [])
  useEffect(() => {
    const control = world.controls.bind({ priority: ControlPriorities.CORE_UI })
    control.slash.onPress = () => {
      if (!chat) setChat(true)
    }
    control.enter.onPress = () => {
      if (!chat) setChat(true)
    }
    control.mouseLeft.onPress = () => {
      if (control.pointer.locked && chat) {
        setChat(false)
      }
    }
    return () => control.release()
  }, [chat])
  useEffect(() => {
    if (chat) {
      inputRef.current.focus()
    } else {
      inputRef.current.blur()
    }
  }, [chat])
  const send = async e => {
    if (world.controls.pointer.locked) {
      setTimeout(() => setChat(false), 10)
    }
    if (!msg) {
      e.preventDefault()
      return setChat(false)
    }
    setMsg('')
    // check for commands
    if (msg.startsWith('/')) {
      world.chat.command(msg)
      return
    }
    // otherwise post it
    const player = world.entities.player
    const data = {
      id: uuid(),
      from: player.data.name,
      fromId: player.data.id,
      body: msg,
      createdAt: moment().toISOString(),
    }
    world.chat.add(data, true)
    if (isTouch) {
      e.target.blur()
      // setTimeout(() => setChat(false), 10)
    }
  }
  return (
    <div
      className='side'
      css={css`
        position: absolute;
        top: calc(4rem + env(safe-area-inset-top));
        left: calc(4rem + env(safe-area-inset-left));
        bottom: calc(4rem + env(safe-area-inset-bottom));
        right: calc(4rem + env(safe-area-inset-right));
        display: flex;
        align-items: stretch;
        font-size: 1rem;
        .side-content {
          max-width: 21rem;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: stretch;
        }
        .side-btns {
          display: flex;
          align-items: center;
          margin-left: -0.5rem;
        }
        .side-btn {
          pointer-events: auto;
          /* margin-bottom: 1rem; */
          width: 2.5rem;
          height: 2.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          svg {
            filter: drop-shadow(0 0.0625rem 0.125rem rgba(0, 0, 0, 0.2));
          }
        }
        .side-mid {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .side-chatbox {
          margin-top: 0.5rem;
          background: rgba(0, 0, 0, 0.3);
          padding: 0.625rem;
          display: flex;
          align-items: center;
          opacity: 0;
          &.active {
            opacity: 1;
            pointer-events: auto;
          }
          &-input {
            flex: 1;
            /* paint-order: stroke fill; */
            /* -webkit-text-stroke: 0.25rem rgba(0, 0, 0, 0.2); */
            &::placeholder {
              color: rgba(255, 255, 255, 0.5);
            }
          }
        }
        @media all and (max-width: 700px), (max-height: 700px) {
          top: calc(1.5rem + env(safe-area-inset-top));
          left: calc(1.5rem + env(safe-area-inset-left));
          bottom: calc(1.5rem + env(safe-area-inset-bottom));
          right: calc(1.5rem + env(safe-area-inset-right));
        }
      `}
    >
      <div className='side-content'>
        <div className='side-btns'>
          <div className='side-btn' onClick={() => world.ui.toggleMain()}>
            <MenuIcon size='1.5rem' />
          </div>
          {isTouch && (
            <div
              className='side-btn'
              onClick={() => {
                console.log('setChat', !chat)
                setChat(!chat)
              }}
            >
              <ChatIcon size='1.5rem' />
            </div>
          )}
          {livekit.connected && (
            <div
              className='side-btn'
              onClick={() => {
                world.livekit.setMicrophoneEnabled()
              }}
            >
              {livekit.mic ? <MicIcon size='1.5rem' /> : <MicOffIcon size='1.5rem' />}
            </div>
          )}
          {world.xr.supportsVR && (
            <div
              className='side-btn'
              onClick={() => {
                world.xr.enter()
              }}
            >
              <VRIcon size='1.5rem' />
            </div>
          )}
        </div>
        {menu?.type === 'main' && <MenuMain world={world} />}
        {menu?.type === 'app' && <MenuApp key={menu.app.data.id} world={world} app={menu.app} blur={menu.blur} />}
        {isTouch && !chat && <MiniMessages world={world} />}
        <div className='side-mid'>{!menu && !isTouch && actions && <Actions world={world} />}</div>
        {(isTouch ? chat : true) && <Messages world={world} active={chat || menu} />}
        <label className={cls('side-chatbox', { active: chat })}>
          <input
            ref={inputRef}
            className='side-chatbox-input'
            type='text'
            placeholder='Say something...'
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => {
              if (e.code === 'Escape') {
                setChat(false)
              }
              // meta quest 3 isn't spec complaint and instead has e.code = '' and e.key = 'Enter'
              // spec says e.code should be a key code and e.key should be the text output of the key eg 'b', 'B', and '\n'
              if (e.code === 'Enter' || e.key === 'Enter') {
                send(e)
              }
            }}
            onBlur={e => {
              if (!isTouch) {
                setChat(false)
              }
            }}
          />
        </label>
      </div>
    </div>
  )
}

function MiniMessages({ world }) {
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    let init
    return world.chat.subscribe(msgs => {
      if (!init) {
        init = true
        return // skip first
      }
      const msg = msgs[msgs.length - 1]
      if (msg.fromId === world.network.id) return
      setMsg(msg)
    })
  }, [])
  useEffect(() => {
    const timerId = setTimeout(() => {
      setMsg(null)
    }, 4000)
    return () => clearTimeout(timerId)
  }, [msg])
  if (!msg) return null
  return <Message msg={msg} />
}

const MESSAGES_REFRESH_RATE = 30 // every x seconds

function Messages({ world, active }) {
  const initRef = useRef()
  const contentRef = useRef()
  const spacerRef = useRef()
  // const [now, setNow] = useState(() => moment())
  const [msgs, setMsgs] = useState([])
  useEffect(() => {
    return world.chat.subscribe(setMsgs)
  }, [])
  // useEffect(() => {
  //   let timerId
  //   const updateNow = () => {
  //     setNow(moment())
  //     timerId = setTimeout(updateNow, MESSAGES_REFRESH_RATE * 1000)
  //   }
  //   timerId = setTimeout(updateNow, MESSAGES_REFRESH_RATE * 1000)
  //   return () => clearTimeout(timerId)
  // }, [])
  useEffect(() => {
    if (!msgs.length) return
    const didInit = !initRef.current
    if (didInit) {
      spacerRef.current.style.height = contentRef.current.offsetHeight + 'px'
    }
    setTimeout(() => {
      contentRef.current?.scroll({
        top: 9999999,
        behavior: didInit ? 'instant' : 'smooth',
      })
    }, 10)
    initRef.current = true
  }, [msgs])
  useEffect(() => {
    const content = contentRef.current
    // const spacer = spacerRef.current
    // spacer.style.height = content.offsetHeight + 'px'
    const observer = new ResizeObserver(() => {
      contentRef.current?.scroll({
        top: 9999999,
        behavior: 'instant',
      })
    })
    observer.observe(content)
    return () => {
      observer.disconnect()
    }
  }, [])
  return (
    <div
      ref={contentRef}
      className={cls('messages noscrollbar', { active })}
      css={css`
        /* padding: 0 0 0.5rem; */
        /* margin-bottom: 20px; */
        flex: 1;
        max-height: 16rem;
        transition: all 0.15s ease-out;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        overflow-y: auto;
        -webkit-mask-image: linear-gradient(to top, black calc(100% - 10rem), black 10rem, transparent);
        mask-image: linear-gradient(to top, black calc(100% - 10rem), black 10rem, transparent);
        &.active {
          pointer-events: auto;
        }
        .messages-spacer {
          flex-shrink: 0;
        }
      `}
    >
      <div className='messages-spacer' ref={spacerRef} />
      {msgs.map(msg => (
        <Message key={msg.id} msg={msg} /*now={now}*/ />
      ))}
    </div>
  )
}

function Message({ msg, now }) {
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
      css={css`
        padding: 0.25rem 0;
        line-height: 1.4;
        font-size: 1rem;
        paint-order: stroke fill;
        -webkit-text-stroke: 0.25rem rgba(0, 0, 0, 0.2);
        .message-from {
          margin-right: 0.25rem;
        }
        .message-body {
          // ...
        }
      `}
    >
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
    <div
      css={css`
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        backdrop-filter: grayscale(100%);
        pointer-events: none;
        z-index: 9999;
        animation: fadeIn 3s forwards;
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}
    />
  )
}

function LoadingOverlay() {
  return (
    <div
      css={css`
        position: absolute;
        inset: 0;
        background: black;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
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
      `}
    >
      <LoaderIcon size={30} />
    </div>
  )
}

const kickMessages = {
  duplicate_user: 'Player already active on another device or window.',
  player_limit: 'Player limit reached.',
  unknown: 'You were kicked.',
}
function KickedOverlay({ code }) {
  return (
    <div
      css={css`
        position: absolute;
        inset: 0;
        background: black;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
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
      `}
    >
      <div>{kickMessages[code] || kickMessages.unknown}</div>
    </div>
  )
}

function Actions({ world }) {
  const [actions, setActions] = useState(() => world.controls.actions)
  useEffect(() => {
    world.on('actions', setActions)
    return () => world.off('actions', setActions)
  }, [])

  return (
    <div
      className='actions'
      css={css`
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        .actions-item {
          display: flex;
          align-items: center;
          margin: 0 0 0.5rem;
          &-icon {
            // ...
          }
          &-label {
            margin-left: 0.625em;
            paint-order: stroke fill;
            -webkit-text-stroke: 0.25rem rgba(0, 0, 0, 0.2);
          }
        }
      `}
    >
      {actions.map(action => (
        <div className='actions-item' key={action.id}>
          <div className='actions-item-icon'>{getActionIcon(action)}</div>
          <div className='actions-item-label'>{action.label}</div>
        </div>
      ))}
    </div>
  )
}

function getActionIcon(action) {
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

function ActionPill({ label }) {
  return (
    <div
      className='actionpill'
      css={css`
        border: 0.0625rem solid white;
        border-radius: 0.25rem;
        background: rgba(0, 0, 0, 0.1);
        padding: 0.25rem 0.375rem;
        font-size: 0.875em;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        paint-order: stroke fill;
        -webkit-text-stroke: 0.25rem rgba(0, 0, 0, 0.2);
      `}
    >
      {label}
    </div>
  )
}

function ActionIcon({ icon: Icon }) {
  return (
    <div
      className='actionicon'
      css={css`
        line-height: 0;
        svg {
          filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.8));
        }
      `}
    >
      <Icon size='1.5rem' />
    </div>
  )
}

function Reticle({ world }) {
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
      css={css`
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        .reticle-item {
          width: 20px;
          height: 20px;
          border-radius: 10px;
          border: 2px solid ${buildMode ? '#ff4d4d' : 'white'};
          mix-blend-mode: ${buildMode ? 'normal' : 'difference'};
        }
      `}
    >
      <div className='reticle-item' />
    </div>
  )
}

function Toast({ world }) {
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    let ids = 0
    const onToast = text => {
      setMsg({ text, id: ++ids })
    }
    world.on('toast', onToast)
    return () => world.off('toast', onToast)
  }, [])
  if (!msg) return null
  return (
    <div
      className='toast'
      css={css`
        position: absolute;
        top: calc(50% - 70px);
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
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
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 14px;
          background: rgba(22, 22, 28, 0.4);
          backdrop-filter: blur(3px);
          border-radius: 25px;
          opacity: 0;
          transform: translateY(10px) scale(0.9);
          transition: all 0.1s ease-in-out;
          &.visible {
            opacity: 1;
            transform: translateY(0) scale(1);
            animation: toastIn 0.1s ease-in-out;
          }
        }
      `}
    >
      {msg && <ToastMsg key={msg.id} text={msg.text} />}
    </div>
  )
}

function ToastMsg({ text }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    setTimeout(() => setVisible(false), 1000)
  }, [])
  return <div className={cls('toast-msg', { visible })}>{text}</div>
}

function TouchBtns({ world }) {
  const [action, setAction] = useState(world.actions.current.node)
  useEffect(() => {
    function onChange(isAction) {
      setAction(isAction)
    }
    world.actions.on('change', onChange)
    return () => {
      world.actions.off('change', onChange)
    }
  }, [])
  return (
    <div
      className='touchbtns'
      css={css`
        position: absolute;
        top: calc(1.5rem + env(safe-area-inset-top));
        right: calc(1.5rem + env(safe-area-inset-right));
        bottom: calc(1.5rem + env(safe-area-inset-bottom));
        left: calc(1.5rem + env(safe-area-inset-left));
        .touchbtns-btn {
          pointer-events: auto;
          position: absolute;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 10rem;
          display: flex;
          align-items: center;
          justify-content: center;
          &.jump {
            width: 4rem;
            height: 4rem;
            bottom: 1rem;
            right: 1rem;
          }
          &.action {
            width: 2.5rem;
            height: 2.5rem;
            bottom: 6rem;
            right: 4rem;
          }
        }
      `}
    >
      {action && (
        <div
          className='touchbtns-btn action'
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId)
            world.controls.setTouchBtn('touchB', true)
          }}
          onPointerLeave={e => {
            world.controls.setTouchBtn('touchB', false)
            e.currentTarget.releasePointerCapture(e.pointerId)
          }}
        >
          <HandIcon size='1.5rem' />
        </div>
      )}
      <div
        className='touchbtns-btn jump'
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId)
          world.controls.setTouchBtn('touchA', true)
        }}
        onPointerLeave={e => {
          world.controls.setTouchBtn('touchA', false)
          e.currentTarget.releasePointerCapture(e.pointerId)
        }}
      >
        <ChevronDoubleUpIcon size='1.5rem' />
      </div>
    </div>
  )
}
