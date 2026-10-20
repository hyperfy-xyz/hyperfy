/**
 * Script WebSockets
 *
 * Lets app scripts open WebSocket connections, but only to origins the world
 * owner allows in PUBLIC_SCRIPT_WEBSOCKET_ORIGINS (comma separated, eg
 * `wss://api.example.com,wss://live.example.com`). Unset or empty means scripts
 * get no WebSocket at all, which is the default.
 *
 * Scripts receive a small wrapper rather than the native socket (same idea as
 * the app fetch wrapper), and every socket an app opened is closed when the app
 * is torn down.
 */

export function scriptWebSocketOrigins() {
  const raw = (globalThis.process?.env?.PUBLIC_SCRIPT_WEBSOCKET_ORIGINS || globalThis.env?.PUBLIC_SCRIPT_WEBSOCKET_ORIGINS || '').trim()
  if (!raw) return []
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => new URL(s).origin)
}

/**
 * Returns { WebSocket, closeAll } for one app, or { WebSocket: undefined, closeAll } when no origins are allowed.
 */
export function createScriptWebSockets(origins = scriptWebSocketOrigins()) {
  const sockets = new Set()
  const closeAll = () => {
    for (const ws of sockets) {
      try {
        ws.close()
      } catch (err) {}
    }
    sockets.clear()
  }
  if (!origins.length || typeof globalThis.WebSocket !== 'function') {
    return { WebSocket: undefined, closeAll }
  }
  const allowed = new Set(origins)
  function ScriptWebSocket(url, protocols) {
    let parsed
    try {
      parsed = new URL(url)
    } catch (err) {
      throw new Error(`invalid websocket url: ${url}`)
    }
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      throw new Error(`websocket url must start with ws:// or wss://`)
    }
    if (!allowed.has(parsed.origin)) {
      throw new Error(`websocket origin not allowed: ${parsed.origin}`)
    }
    const ws = new globalThis.WebSocket(parsed.href, protocols)
    ws.binaryType = 'arraybuffer'
    sockets.add(ws)
    const handlers = { open: null, message: null, close: null, error: null }
    ws.onopen = () => handlers.open?.({})
    ws.onmessage = e => handlers.message?.({ data: e.data })
    ws.onerror = () => handlers.error?.({})
    ws.onclose = e => {
      sockets.delete(ws)
      handlers.close?.({ code: e.code, reason: e.reason, wasClean: e.wasClean })
    }
    const wrapper = {
      send: data => ws.send(data),
      close: (code, reason) => ws.close(code, reason),
      get readyState() {
        return ws.readyState
      },
      get url() {
        return ws.url
      },
      get protocol() {
        return ws.protocol
      },
    }
    for (const name of Object.keys(handlers)) {
      Object.defineProperty(wrapper, `on${name}`, {
        get: () => handlers[name],
        set: fn => {
          handlers[name] = typeof fn === 'function' ? fn : null
        },
      })
    }
    return wrapper
  }
  ScriptWebSocket.CONNECTING = 0
  ScriptWebSocket.OPEN = 1
  ScriptWebSocket.CLOSING = 2
  ScriptWebSocket.CLOSED = 3
  return { WebSocket: ScriptWebSocket, closeAll }
}
