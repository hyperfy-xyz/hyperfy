/* global env */
import 'ses'
import '../core/lockdown'
import { createRoot } from 'react-dom/client'

import { sanitizeWsUrl } from '../core/utils'
import { Client } from './world-client'

function App() {
  const searchParams = new URLSearchParams(location.search)
  const allowOverride =
    location.hostname === 'localhost' || env.PUBLIC_ALLOW_WS_OVERRIDE === 'true'

  let wsUrl = env.PUBLIC_WS_URL
  let mode = searchParams.get('mode')

  if (mode !== 'offline') {
    if (allowOverride) {
      const connectUrl = searchParams.get('connect')
      if (connectUrl) {
        const clean = sanitizeWsUrl(connectUrl)
        if (clean) {
          wsUrl = clean
          mode = 'direct'
        }
      }
    }
    if (!mode) mode = wsUrl ? 'direct' : 'offline'
  }

  return <Client wsUrl={mode !== 'direct' ? undefined : wsUrl} />
}

const root = createRoot(document.getElementById('root'))
root.render(<App />)
