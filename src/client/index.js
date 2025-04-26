import 'ses'
import '../core/lockdown'
import { createRoot } from 'react-dom/client'

import { Client } from './world-client'

function App() {
  return <Client wsUrl={env.PUBLIC_WS_URL} />
}

const root = createRoot(document.getElementById('root'))
root.render(<App />)
