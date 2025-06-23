// import 'ses'
// import '../core/lockdown'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { Client } from './world-client'

// Declare global env type
declare global {
  interface Window {
    env?: Record<string, string>
  }
}

console.log('[App] Starting Hyperfy client...')

function App() {
  // Try global env first (from env.js), then import.meta.env (Vite), then fallback to relative WebSocket
  const wsUrl = 
    window.env?.PUBLIC_WS_URL || 
    import.meta.env?.PUBLIC_WS_URL || 
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
  
  console.log('[App] WebSocket URL:', wsUrl)
  
  return <Client wsUrl={wsUrl} onSetup={() => {
    console.log('[App] Client onSetup called')
  }} />
}

const rootElement = document.getElementById('root')
if (rootElement) {
  console.log('[App] Mounting React app...')
  const root = ReactDOM.createRoot(rootElement)
  root.render(<App />)
} else {
  console.error('[App] Root element not found!')
}
