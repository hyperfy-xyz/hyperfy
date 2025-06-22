import React from 'react'
import 'ses'
import '../core/lockdown'
import { createRoot } from 'react-dom/client'

import { Client } from './world-client'

function App() {
  return <Client wsUrl={(window as any).env?.PUBLIC_WS_URL} onSetup={() => {}} />
}

const rootElement = document.getElementById('root')
if (rootElement) {
  const root = createRoot(rootElement)
  root.render(<App />)
}
