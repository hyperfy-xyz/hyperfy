import { css } from '@firebolt-dev/css'
import { useEffect, useRef, useState } from 'react'
import {
  CheckCircleIcon,
  ExternalLinkIcon,
  LinkIcon,
  PlusIcon,
  RefreshCwIcon,
  SettingsIcon,
  TrashIcon,
  UploadIcon,
  WifiIcon,
  WifiOffIcon,
  XCircleIcon,
  XIcon,
  SearchIcon,
} from 'lucide-react'
import {
  FieldBtn,
  FieldText,
  FieldToggle,
} from './Fields'
import { cls } from './cls'

export function DevToolsPane({ world, hidden }) {
  return (
    <Pane width='40rem' hidden={hidden}>
      <div
        className='devtools'
        css={css`
          background: rgba(11, 10, 21, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1.375rem;
          display: flex;
          flex-direction: column;
          min-height: 17rem;
          
          .devtools-head {
            height: 3.125rem;
            padding: 0 0.6rem 0 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            align-items: center;
          }
          
          .devtools-title {
            flex: 1;
            font-weight: 500;
            font-size: 1rem;
            line-height: 1;
          }
          
          .devtools-status {
            display: flex;
            align-items: center;
            margin-right: 0.5rem;
          }
          
          .devtools-toggle {
            width: 2rem;
            height: 2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 0 0 1rem;
            color: #5d6077;
            &:hover {
              cursor: pointer;
            }
            &.active {
              color: white;
            }
          }
          
          .devtools-content {
            flex: 1;
            overflow-y: auto;
          }
          
          .apps-list {
            .app-item {
              display: flex;
              align-items: center;
              padding: 0.75rem 1rem;
              border-bottom: 1px solid rgba(255, 255, 255, 0.05);
              
              &:last-child {
                border-bottom: none;
              }
              
              &-info {
                flex: 1;
                
                &-name {
                  font-weight: 500;
                  margin-bottom: 0.25rem;
                }
                
                &-details {
                  font-size: 0.8rem;
                  color: rgba(255, 255, 255, 0.6);
                }
              }
              
              &-actions {
                display: flex;
                gap: 0.5rem;
              }
              
              &-btn {
                width: 2rem;
                height: 2rem;
                display: flex;
                align-items: center;
                justify-content: center;
                color: rgba(255, 255, 255, 0.8);
                &:hover {
                  cursor: pointer;
                  color: white;
                }
                &.danger {
                  color: #ff4b4b;
                  &:hover {
                    color: #ff6b6b;
                  }
                }
              }
            }
          }
          
          .empty-state {
            text-align: center;
            padding: 2rem 1rem;
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.9rem;
          }
        `}
      >
        <div className='devtools-head'>
          <div className='devtools-title'>Dev Tools</div>
          <DevToolsStatus world={world} />
        </div>
        <div className='devtools-content noscrollbar'>
          <DevToolsContent world={world} />
        </div>
      </div>
    </Pane>
  )
}

function DevToolsStatus({ world }) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [isConnecting, setIsConnecting] = useState(false)
  
  useEffect(() => {
    checkConnection()
    
    // Listen for connection status changes
    const updateStatus = () => {
      setConnectionStatus(world.appServerClient.connected ? 'connected' : 'disconnected')
    }
    
    world.appServerClient.on?.('connectionChanged', updateStatus)
    return () => world.appServerClient.off?.('connectionChanged', updateStatus)
  }, [])

  const checkConnection = async () => {
    try {
      setIsConnecting(true)
      const devServerUrl = world.appServerClient.url || 'http://localhost:8080'
      
      const response = await fetch(`${devServerUrl}/health`)
      if (response.ok) {
        setConnectionStatus('connected')
      } else {
        setConnectionStatus('error')
      }
    } catch (error) {
      setConnectionStatus('disconnected')
    } finally {
      setIsConnecting(false)
    }
  }

  const getStatusIcon = () => {
    if (isConnecting) return <RefreshCwIcon size={16} className={cls('devtools-toggle', 'spin')} />
    
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircleIcon size={16} style={{ color: '#10b981' }} />
      case 'disconnected':
        return <WifiOffIcon size={16} style={{ color: '#6b7280' }} />
      case 'error':
        return <XCircleIcon size={16} style={{ color: '#ef4444' }} />
      default:
        return <WifiIcon size={16} />
    }
  }

  return (
    <div className='devtools-status'>
      {getStatusIcon()}
    </div>
  )
}

// Import Pane component
function Pane({ width = '20rem', hidden, children }) {
  return (
    <div
      className={`sidebarpane ${hidden ? 'hidden' : ''}`}
      css={css`
        width: ${width};
        max-width: 100%;
        display: flex;
        flex-direction: column;
        .sidebarpane-content {
          pointer-events: auto;
          max-height: 100%;
          display: flex;
          flex-direction: column;
        }
        &.hidden {
          opacity: 0;
          pointer-events: none;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .spin {
          animation: spin 1s linear infinite;
        }
      `}
    >
      <div className='sidebarpane-content'>{children}</div>
    </div>
  )
}

function Group({ label }) {
  return (
    <>
      <div
        css={css`
          height: 0.0625rem;
          background: rgba(255, 255, 255, 0.05);
          margin: 0.6rem 0;
        `}
      />
      {label && (
        <div
          css={css`
            font-weight: 500;
            line-height: 1;
            padding: 0.75rem 0 0.75rem 1rem;
            margin-top: -0.6rem;
          `}
        >
          {label}
        </div>
      )}
    </>
  )
}

function DevToolsContent({ world }) {
  const [serverUrl, setServerUrl] = useState('http://localhost:8080')
  const [customPort, setCustomPort] = useState('8080')
  const [linkedApps, setLinkedApps] = useState([])
  const [allApps, setAllApps] = useState([])
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isLoadingApps, setIsLoadingApps] = useState(false)
  const [lastError, setLastError] = useState(null)
  const [lastSuccess, setLastSuccess] = useState(null)
  const [activeTab, setActiveTab] = useState('linked')
  const [actionLoading, setActionLoading] = useState({})

  useEffect(() => {
    // Initialize server URL from AppServerClient if available
    if (world.appServerClient.url) {
      setServerUrl(world.appServerClient.url)
      setCustomPort(world.appServerClient.url.split(':').pop())
    }
    
    // Check initial connection status
    checkConnection()
    
    // Listen for app linked/unlinked events
    const onAppLinked = ({ appName, linkInfo }) => {
      loadApps()
      showSuccess(`${appName} linked successfully`)
    }
    const onAppUnlinked = ({ appName }) => {
      loadApps()
      showSuccess(`${appName} unlinked successfully`)
    }
    
    world.on('app_linked', onAppLinked)
    world.on('app_unlinked', onAppUnlinked)
    
    return () => {
      world.off('app_linked', onAppLinked)
      world.off('app_unlinked', onAppUnlinked)
    }
  }, [])

  // Utility functions for showing feedback
  const showSuccess = (message) => {
    setLastSuccess(message)
    setLastError(null)
    setTimeout(() => setLastSuccess(null), 3000)
  }

  const showError = (message) => {
    setLastError(message)
    setLastSuccess(null)
  }

  const setActionLoadingState = (action, isLoading) => {
    setActionLoading(prev => ({ ...prev, [action]: isLoading }))
  }

  const checkConnection = async () => {
    try {
      setIsConnecting(true)
      setLastError(null)
      setLastSuccess(null)
      
      const response = await fetch(`${serverUrl}/health`)
      if (response.ok) {
        setConnectionStatus('connected')
        showSuccess('Connected to development server')
        await loadApps()
      } else {
        setConnectionStatus('error')
        showError('Server responded with error')
      }
    } catch (error) {
      setConnectionStatus('disconnected')
      showError(`Connection failed: ${error.message}`)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = () => {
    setConnectionStatus('disconnected')
    setLinkedApps([])
    setAllApps([])
    showSuccess('Disconnected from development server')
  }

  const loadApps = async () => {
    try {
      setIsLoadingApps(true)
      
      // Load all apps
      const allAppsResponse = await fetch(`${serverUrl}/api/apps`)
      if (allAppsResponse.ok) {
        const { apps } = await allAppsResponse.json()
        setAllApps(apps || [])
      }

      // Load linked apps for current world
      const worldUrl = world.network?.apiUrl.split("/api")[0]
      const linkedAppsResponse = await fetch(`${serverUrl}/api/linked-apps?worldUrl=${encodeURIComponent(worldUrl)}`)
      if (linkedAppsResponse.ok) {
        const { apps } = await linkedAppsResponse.json()
        setLinkedApps(apps || [])
      }
    } catch (error) {
      console.warn('Failed to load apps:', error)
      showError('Failed to load apps list')
    } finally {
      setIsLoadingApps(false)
    }
  }

  const connectWithCustomPort = async () => {
    const newUrl = `http://localhost:${customPort}`
    setServerUrl(newUrl)
    
    // Update AppServerClient connection
    world.appServerClient.setServerUrl(newUrl)
    
    await checkConnection()
  }

  const unlinkApp = async (appName) => {
    try {
      setActionLoadingState(`unlink-${appName}`, true)
      
      const response = await fetch(`${serverUrl}/api/apps/${appName}/unlink`, {
        method: 'POST'
      })
      
      if (response.ok) {
        showSuccess(`${appName} unlinked successfully`)
        await loadApps()
      } else {
        throw new Error('Failed to unlink app')
      }
    } catch (error) {
      console.error(`❌ Failed to unlink ${appName}:`, error)
      showError(`Failed to unlink ${appName}: ${error.message}`)
    } finally {
      setActionLoadingState(`unlink-${appName}`, false)
    }
  }

  const pushApp = async (appName) => {
    try {
      setActionLoadingState(`push-${appName}`, true)
      
      const response = await fetch(`${serverUrl}/api/apps/${appName}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: [0, 0, 0]
        })
      })
      
      if (response.ok) {
        showSuccess(`${appName} deployed successfully`)
      } else {
        throw new Error('Failed to deploy app')
      }
    } catch (error) {
      console.error(`❌ Failed to deploy ${appName}:`, error)
      showError(`Failed to deploy ${appName}: ${error.message}`)
    } finally {
      setActionLoadingState(`push-${appName}`, false)
    }
  }

  return (
    <div
      className='devtools-inner'
      css={css`
        padding: 0.5rem 0;
      `}
    >
      <Group label='Connection' />
      
      <FieldText
        label='Server Port'
        hint={connectionStatus === 'connected' ? 'Disconnect to change port' : 'Port number for the local development server'}
        value={customPort}
        onChange={connectionStatus === 'connected' ? () => {} : setCustomPort}
      />
      
      {connectionStatus !== 'connected' && (
        <FieldBtn
          label={isConnecting ? 'Connecting...' : 'Connect'}
          hint='Connect to the development server'
          onClick={connectWithCustomPort}
          disabled={isConnecting}
        />
      )}
      
      {connectionStatus === 'connected' && (
        <FieldBtn
          label='Disconnect'
          hint='Disconnect from the development server'
          onClick={disconnect}
          disabled={isConnecting}
        />
      )}
      
      <FieldBtn
        label={isConnecting ? 'Checking...' : 'Refresh Status'}
        hint='Check the current connection status'
        onClick={checkConnection}
        disabled={isConnecting}
      />

      {/* Connection Status Display */}
      <div
        css={css`
          margin: 0.5rem 1rem;
          padding: 0.75rem 1rem;
          border-radius: 0.375rem;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          ${connectionStatus === 'connected' && `
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #a7f3d0;
          `}
          ${connectionStatus === 'disconnected' && `
            background: rgba(156, 163, 175, 0.1);
            border: 1px solid rgba(156, 163, 175, 0.3);
            color: #d1d5db;
          `}
          ${connectionStatus === 'error' && `
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
          `}
        `}
      >
        {connectionStatus === 'connected' && <CheckCircleIcon size={16} />}
        {connectionStatus === 'disconnected' && <WifiOffIcon size={16} />}
        {connectionStatus === 'error' && <XCircleIcon size={16} />}
        {connectionStatus === 'connected' && `Connected to ${serverUrl}`}
        {connectionStatus === 'disconnected' && 'Not connected to development server'}
        {connectionStatus === 'error' && 'Connection error'}
      </div>

      {/* Success Message */}
      {lastSuccess && (
        <div
          css={css`
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 0.375rem;
            padding: 0.75rem 1rem;
            color: #a7f3d0;
            font-size: 0.9rem;
            margin: 0.5rem 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          `}
        >
          <CheckCircleIcon size={16} />
          {lastSuccess}
        </div>
      )}

      {/* Error Message */}
      {lastError && (
        <div
          css={css`
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 0.375rem;
            padding: 0.75rem 1rem;
            color: #fca5a5;
            font-size: 0.9rem;
            margin: 0.5rem 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          `}
        >
          <XCircleIcon size={16} />
          {lastError}
        </div>
      )}

      <Group label='Apps' />

      {/* Tab Navigation */}
      <div
        css={css`
          display: flex;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          margin: 0 1rem;
        `}
      >
        <div
          className={`tab ${activeTab === 'linked' ? 'active' : ''}`}
          onClick={() => setActiveTab('linked')}
          css={css`
            padding: 0.75rem 1rem;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.9rem;
            font-weight: 500;
            transition: all 0.2s ease;
            
            &:hover {
              color: rgba(255, 255, 255, 0.8);
            }
            
            &.active {
              color: white;
              border-bottom-color: #10b981;
            }
          `}
        >
          Linked ({linkedApps.length})
        </div>
        <div
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
          css={css`
            padding: 0.75rem 1rem;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.9rem;
            font-weight: 500;
            transition: all 0.2s ease;
            
            &:hover {
              color: rgba(255, 255, 255, 0.8);
            }
            
            &.active {
              color: white;
              border-bottom-color: #10b981;
            }
          `}
        >
          All ({allApps.length})
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'linked' && (
        <>
          {linkedApps.length === 0 ? (
            <div className="empty-state">
              No apps linked yet.<br />
              Use the link button in app inspectors to connect apps.
            </div>
          ) : (
            <div className="apps-list">
              {linkedApps.map((app) => (
                <div key={app.name} className="app-item">
                  <div className="app-item-info">
                    <div className="app-item-info-name">{app.name}</div>
                    <div className="app-item-info-details">
                      {app.assets.length} assets • {app.script ? 'Has script' : 'No script'}
                    </div>
                  </div>
                  <div className="app-item-actions">
                    <div 
                      className={`app-item-btn ${actionLoading[`push-${app.name}`] ? 'loading' : ''}`}
                      onClick={() => !actionLoading[`push-${app.name}`] && pushApp(app.name)}
                      title="Deploy local changes to world"
                      style={{ opacity: actionLoading[`push-${app.name}`] ? 0.5 : 1 }}
                    >
                      {actionLoading[`push-${app.name}`] ? (
                        <RefreshCwIcon size={14} className="spin" />
                      ) : (
                        <UploadIcon size={14} />
                      )}
                    </div>
                    <div 
                      className={`app-item-btn danger ${actionLoading[`unlink-${app.name}`] ? 'loading' : ''}`}
                      onClick={() => {
                        if (!actionLoading[`unlink-${app.name}`] && confirm(`Unlink ${app.name}? This will remove the connection but keep the local files.`)) {
                          unlinkApp(app.name)
                        }
                      }}
                      title="Unlink app from development server"
                      style={{ opacity: actionLoading[`unlink-${app.name}`] ? 0.5 : 1 }}
                    >
                      {actionLoading[`unlink-${app.name}`] ? (
                        <RefreshCwIcon size={14} className="spin" />
                      ) : (
                        <TrashIcon size={14} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'all' && (
        <>
          {allApps.length === 0 ? (
            <div className="empty-state">
              No apps available on development server.<br />
              Create new apps or download them from the world.
            </div>
          ) : (
            <div className="apps-list">
              {allApps.map((app) => (
                <div key={app.name} className="app-item">
                  <div className="app-item-info">
                    <div className="app-item-info-name">{app.name}</div>
                    <div className="app-item-info-details">
                      {app.assets.length} assets • {app.script ? 'Has script' : 'No script'}
                    </div>
                  </div>
                  <div className="app-item-actions">
                    <div 
                      className={`app-item-btn ${actionLoading[`push-${app.name}`] ? 'loading' : ''}`}
                      onClick={() => !actionLoading[`push-${app.name}`] && pushApp(app.name)}
                      title="Deploy app to world"
                      style={{ opacity: actionLoading[`push-${app.name}`] ? 0.5 : 1 }}
                    >
                      {actionLoading[`push-${app.name}`] ? (
                        <RefreshCwIcon size={14} className="spin" />
                      ) : (
                        <UploadIcon size={14} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Group label='Quick Actions' />
      
      <FieldBtn
        label={isLoadingApps ? 'Refreshing...' : 'Refresh Apps'}
        hint='Manually refresh the list of apps'
        onClick={loadApps}
        disabled={connectionStatus !== 'connected' || isLoadingApps}
      />
    </div>
  )
} 
