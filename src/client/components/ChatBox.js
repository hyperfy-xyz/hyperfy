import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { css } from '@firebolt-dev/css'
import { MessageCircleMoreIcon, SendHorizonalIcon } from 'lucide-react'
import moment from 'moment'
import { uuid } from '../../core/utils'
import { cls } from '../utils'
import { ControlPriorities } from '../../core/extras/ControlPriorities'

const CHAT_TIME_REFRESH_RATE = 30 // every x seconds

export function ChatBox({ className, world, active, onClose, ...props }) {
  const initRef = useRef()
  const contentRef = useRef()
  const inputRef = useRef()
  const [body, setBody] = useState('')
  const [now, setNow] = useState(() => moment())
  const [msgs, setMsgs] = useState([])
  useEffect(() => {
    const control = world.controls.bind({ priority: ControlPriorities.GUI })
    control.enter.onPress = () => {
      inputRef.current.focus()
    }
    return () => control.release()
  }, [])
  useEffect(() => {
    return world.chat.subscribe(setMsgs)
  }, [])
  useEffect(() => {
    let timerId
    const updateNow = () => {
      setNow(moment())
      timerId = setTimeout(updateNow, CHAT_TIME_REFRESH_RATE * 1000)
    }
    timerId = setTimeout(updateNow, CHAT_TIME_REFRESH_RATE * 1000)
    return () => clearTimeout(timerId)
  }, [])
  useLayoutEffect(() => {
    if (!msgs.length) return
    contentRef.current.scroll({
      top: 9999999,
      behavior: initRef.current ? 'smooth' : 'instant',
    })
    initRef.current = true
  }, [msgs])
  const send = async () => {
    if (world.controls.pointer.locked) {
      setTimeout(() => inputRef.current.blur(), 10)
    }
    if (!body) return
    setBody('')
    // check for client commands
    if (body.startsWith('/')) {
      const [cmd, arg1, arg2] = body.slice(1).split(' ')
      if (cmd === 'stats') {
        world.stats.toggle()
        return
      }
    }
    // otherwise post it
    const player = world.entities.player
    const msg = {
      id: uuid(),
      from: player.data.user.name,
      fromId: player.data.id,
      body,
      createdAt: moment().toISOString(),
    }
    world.chat.add(msg, true)
  }
  return (
    <div
      className={cls(className, 'chat', { active })}
      css={css`
        pointer-events: auto;
        position: absolute;
        bottom: 20px;
        left: 20px;
        height: 250px;
        border-radius: 25px;
        background: rgba(22, 22, 28, 0.2);
        border: 1px solid rgba(255, 255, 255, 0);
        box-shadow: rgba(0, 0, 0, 0) 0px 10px 30px;
        border-radius: 10px;
        transition: all 0.15s ease-out;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        &.active,
        &:hover {
          background: rgba(22, 22, 28, 1);
          border: 1px solid rgba(255, 255, 255, 0.03);
          box-shadow: rgba(0, 0, 0, 0.5) 0px 10px 30px;
        }
        .chat-content {
          flex: 1;
          padding: 10px 0;
          overflow-y: auto;
        }
        .chat-entry {
          height: 50px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          padding: 0 6px 0 0;
          cursor: text;
          &-icon {
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 0;
            cursor: pointer;
          }
          &-input {
            margin: 0 0 0 -3px;
            flex: 1;
          }
          &-btn {
            line-height: 0;
            opacity: ${body ? '1' : '0.2'};
            cursor: pointer;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        }
      `}
      {...props}
    >
      <div className='chat-content noscrollbar' ref={contentRef}>
        {msgs.map(msg => (
          <Message key={msg.id} msg={msg} now={now} />
        ))}
      </div>
      <label className='chat-entry'>
        <div className='chat-entry-icon' onClick={onClose}>
          <MessageCircleMoreIcon size={20} />
        </div>
        <input
          ref={inputRef}
          className='chat-entry-input'
          type='text'
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => {
            if (e.code === 'Enter') {
              send()
            }
          }}
        />
        <div className='chat-entry-btn' onClick={send}>
          <SendHorizonalIcon size={20} />
        </div>
      </label>
    </div>
  )
}

function Message({ msg, now }) {
  const timeAgo = useMemo(() => {
    const createdAt = moment(msg.createdAt)
    const age = now.diff(createdAt, 'seconds')
    // up to 10s ago show now
    if (age < 10) return 'now'
    // under a minute show seconds
    if (age < 60) return `${age}s ago`
    // under an hour show minutes
    if (age < 3600) return Math.floor(age / 60) + 'm ago'
    // under a day show hours
    if (age < 86400) return Math.floor(age / 3600) + 'h ago'
    // otherwise show days
    return Math.floor(age / 86400) + 'd ago'
  }, [now])
  return (
    <div
      className='chatMsg'
      css={css`
        padding: 5px 20px;
        .chatMsg-head {
          display: flex;
          align-items: center;
          margin: 0 0 3px;
          &-name {
            font-weight: 500;
            flex: 1;
          }
          &-time {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.15);
          }
        }
        .chatMsg-body {
          color: rgba(255, 255, 255, 0.5);
        }
      `}
    >
      {msg.from && (
        <div className='chatMsg-head'>
          <div className='chatMsg-head-name'>{msg.from}</div>
          <div className='chatMsg-head-time'>{timeAgo}</div>
        </div>
      )}
      <div className='chatMsg-body'>{msg.body}</div>
    </div>
  )
}
