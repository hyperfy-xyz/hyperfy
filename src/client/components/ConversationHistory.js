import { useEffect, useRef, useState } from 'react'
import { css } from '@firebolt-dev/css'
import { XIcon, MessageSquareIcon, RefreshCwIcon, ChevronLeftIcon } from 'lucide-react'
import { storage } from '../../core/storage'
import { cls } from '../utils'

export function ConversationHistory({ world, blur, onClose }) {
  const containerRef = useRef()
  const resizeRef = useRef()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [toolLogsExpanded, setToolLogsExpanded] = useState({})

  // Style configuration
  const styleConfig = {
    colors: {
      background: 'rgba(15, 16, 24, 0.8)',
      border: 'rgba(255, 255, 255, 0.05)',
      borderActive: 'rgba(255, 255, 255, 0.3)',
      inputBg: 'rgba(0, 0, 0, 0.15)',
      statusBg: 'rgba(0, 0, 0, 0.25)',
      toolUseBg: 'rgba(60, 60, 80, 0.4)',
      toolUseExpandedBg: 'rgba(70, 70, 90, 0.6)',
      errorBg: 'rgba(180, 30, 30, 0.4)',
      queryBg: 'rgba(30, 30, 50, 0.4)',
      responseBg: 'rgba(20, 20, 30, 0.4)',
      hoverBg: 'rgba(50, 50, 80, 0.4)',
    },
    radius: {
      panel: '0.5rem',
      item: '0.5rem',
    },
    shadows: {
      panel: '0 4px 20px rgba(0, 0, 0, 0.25)',
    },
  }

  // Set up the resizing functionality
  useEffect(() => {
    const elem = resizeRef.current
    const container = containerRef.current
    container.style.width = `${storage.get('conversation-history-width', 520)}px`
    let active
    function onPointerDown(e) {
      active = true
      elem.addEventListener('pointermove', onPointerMove)
      elem.addEventListener('pointerup', onPointerUp)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    function onPointerMove(e) {
      const newWidth = container.offsetWidth - e.movementX
      container.style.width = `${newWidth}px`
      storage.set('conversation-history-width', newWidth)
    }
    function onPointerUp(e) {
      e.currentTarget.releasePointerCapture(e.pointerId)
      elem.removeEventListener('pointermove', onPointerMove)
      elem.removeEventListener('pointerup', onPointerUp)
    }
    elem.addEventListener('pointerdown', onPointerDown)
    return () => {
      elem.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  // Load conversation history from local storage
  useEffect(() => {
    loadConversationHistory()
  }, [])

  const loadConversationHistory = () => {
    setLoading(true)
    setError(null)
    
    try {
      // Get history from local storage
      const history = storage.get('ai-conversation-history', [])
      setConversations(history)
      setLoading(false)
    } catch (err) {
      console.error('Failed to load conversation history:', err)
      setError('Failed to load conversation history')
      setLoading(false)
    }
  }

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear your conversation history?')) {
      storage.set('ai-conversation-history', [])
      setConversations([])
      setSelectedConversation(null)
    }
  }

  // Format the timestamp to a readable format
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    
    // If it's today, just show the time
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // If it's yesterday, show "Yesterday"
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Otherwise show the full date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
           ` at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  // Truncate text for preview
  const truncateText = (text, maxLength = 60) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  const toggleToolExpanded = (toolId) => {
    setToolLogsExpanded(prev => ({
      ...prev,
      [toolId]: !prev[toolId]
    }));
  }

  const renderToolDetails = (tool) => {
    if (!toolLogsExpanded[tool.id]) return null;
    
    return (
      <div className="tool-details">
        <div className="tool-args">
          <div className="tool-section-title">Arguments:</div>
          <pre>{JSON.stringify(tool.args, null, 2)}</pre>
        </div>
        
        {tool.result && (
          <div className="tool-result">
            <div className="tool-section-title">Result:</div>
            <pre>{JSON.stringify(tool.result, null, 2)}</pre>
          </div>
        )}
        
        {tool.error && (
          <div className="tool-error">
            <div className="tool-section-title">Error:</div>
            <pre>{tool.error}</pre>
          </div>
        )}
      </div>
    );
  }

  const renderToolLog = (tool) => {
    if (!tool) {
      console.warn('Attempted to render null/undefined tool');
      return null;
    }
    
    return (
      <div className="tool-log" key={tool.id}>
        <div 
          className="tool-header" 
          onClick={() => toggleToolExpanded(tool.id)}
        >
          <div className="tool-name">
            {tool.type === 'error' ? '❌ ' : '📌 '}
            Tool: {tool.tool}
          </div>
          <div className={`tool-expand-icon ${toolLogsExpanded[tool.id] ? 'expanded' : ''}`}>
            ▼
          </div>
        </div>
        {renderToolDetails(tool)}
      </div>
    );
  }

  const renderResponseContent = () => {
    if (!selectedConversation) return null;
    
    // Add debug logging to see what's in the conversation
    console.log('Selected conversation:', selectedConversation);
    console.log('Tool logs:', selectedConversation.toolLogs);
    console.log('Response segments:', selectedConversation.responseSegments);
    
    // If responseSegments exists and is an array, use that to render the content
    if (selectedConversation.responseSegments && Array.isArray(selectedConversation.responseSegments) && selectedConversation.responseSegments.length > 0) {
      return selectedConversation.responseSegments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={index}>{segment.content}</span>;
        } else if (segment.type === 'tool' && selectedConversation.toolLogs) {
          const tool = selectedConversation.toolLogs.find(t => t.id === segment.id);
          if (tool) {
            return <div key={index}>{renderToolLog(tool)}</div>;
          } else {
            console.warn(`Tool with id ${segment.id} not found in toolLogs`);
            return null;
          }
        }
        return null;
      });
    }
    
    // Fallback to just showing the response text
    return selectedConversation.response;
  }

  return (
    <div
      ref={containerRef}
      className='conversation-history'
      css={css`
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: 520px;
        background-color: ${styleConfig.colors.background};
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        opacity: ${blur ? 0.3 : 1};
        transform: ${blur ? 'translateX(90%)' : 'translateX(0%)'};
        transition:
          opacity 0.15s ease-out,
          transform 0.15s ease-out;
        
        .history-head {
          height: 50px;
          border-bottom: 1px solid ${styleConfig.colors.border};
          display: flex;
          align-items: center;
          padding: 0 10px 0 20px;
          
          &-title {
            font-weight: 500;
            font-size: 20px;
            flex: 1;
          }
          
          &-btn {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #7d7d7d;
            &:hover {
              cursor: pointer;
              color: white;
            }
          }
        }
        
        .history-content {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          
          &::-webkit-scrollbar {
            width: 8px;
          }
          
          &::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
          }
          
          &::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
          }
          
          &::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
          }
        }
        
        .history-resizer {
          position: absolute;
          top: 0;
          bottom: 0;
          left: -5px;
          width: 10px;
          cursor: ew-resize;
        }
        
        .history-list-item {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid ${styleConfig.colors.border};
          cursor: pointer;
          
          &:hover {
            background: ${styleConfig.colors.hoverBg};
          }
          
          &-title {
            font-weight: 500;
            margin-bottom: 0.25rem;
          }
          
          &-timestamp {
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.5);
          }
        }
        
        .history-detail {
          display: flex;
          flex-direction: column;
          padding: 1rem;
          flex: 1;
          
          &-header {
            margin-bottom: 1rem;
            display: flex;
            flex-direction: column;
          }
          
          &-timestamp {
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.5);
            margin-top: 0.25rem;
          }
          
          &-query {
            background: ${styleConfig.colors.queryBg};
            padding: 1rem;
            border-radius: ${styleConfig.radius.item};
            margin-bottom: 1rem;
            font-weight: 500;
          }
          
          &-response {
            background: ${styleConfig.colors.responseBg};
            padding: 1rem;
            border-radius: ${styleConfig.radius.item};
            font-family: monospace;
            white-space: pre-wrap;
            line-height: 1.5;
            flex: 1;
            overflow-y: auto;
            font-size: 0.9rem;
          }
        }
        
        .history-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: rgba(255, 255, 255, 0.5);
          padding: 2rem;
          
          svg {
            margin-bottom: 1rem;
            opacity: 0.5;
          }
        }
        
        .history-error {
          background: ${styleConfig.colors.errorBg};
          padding: 1rem;
          margin: 1rem;
          border-radius: ${styleConfig.radius.item};
        }
        
        .history-loading {
          padding: 1rem;
          text-align: center;
        }
        
        .back-button {
          display: flex;
          align-items: center;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          
          &:hover {
            color: white;
          }
          
          svg {
            margin-right: 0.25rem;
          }
        }
        
        .tool-logs {
          margin-top: 1rem;
        }
        
        .tool-log {
          margin: 0.5rem 0;
          border-radius: ${styleConfig.radius.item};
          overflow: hidden;
          background: rgba(40, 40, 60, 0.4);
        }
        
        .tool-header {
          background: ${styleConfig.colors.toolUseBg};
          padding: 0.5rem;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          
          &:hover {
            background: ${styleConfig.colors.toolUseExpandedBg};
          }
        }
        
        .tool-name {
          font-weight: bold;
        }
        
        .tool-expand-icon {
          transition: transform 0.2s;
          
          &.expanded {
            transform: rotate(180deg);
          }
        }
        
        .tool-details {
          padding: 0.5rem;
          background: rgba(50, 50, 70, 0.3);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .tool-section-title {
          font-weight: bold;
          margin-bottom: 0.25rem;
          color: rgba(255, 255, 255, 0.7);
        }
        
        .tool-args, .tool-result {
          margin-bottom: 0.5rem;
        }
        
        .tool-error {
          color: #ff6666;
        }
        
        pre {
          margin: 0;
          white-space: pre-wrap;
          font-size: 0.85rem;
          max-height: 200px;
          overflow-y: auto;
        }
      `}
    >
      <div className='history-head'>
        <div className='history-head-title'>
          {selectedConversation ? (
            <div className="back-button" onClick={() => setSelectedConversation(null)}>
              <ChevronLeftIcon size={16} /> Back to Conversations
            </div>
          ) : (
            'Conversation History'
          )}
        </div>
        {!selectedConversation && (
          <div className='history-head-btn' onClick={clearHistory} title="Clear History">
            <RefreshCwIcon size={20} />
          </div>
        )}
        <div className='history-head-btn' onClick={() => world.ui.toggleConversations()} title="Close">
          <XIcon size={24} />
        </div>
      </div>
      
      <div className='history-content'>
        {loading && (
          <div className='history-loading'>Loading conversations...</div>
        )}
        
        {error && (
          <div className='history-error'>{error}</div>
        )}
        
        {!loading && !error && conversations.length === 0 && (
          <div className='history-empty'>
            <MessageSquareIcon size={48} />
            <p>No conversation history yet</p>
          </div>
        )}
        
        {!loading && !error && !selectedConversation && conversations.map((convo, index) => (
          <div 
            key={index} 
            className='history-list-item'
            onClick={() => setSelectedConversation(convo)}
          >
            <div className='history-list-item-title'>{truncateText(convo.query)}</div>
            <div className='history-list-item-timestamp'>{formatTimestamp(convo.timestamp)}</div>
          </div>
        ))}
        
        {selectedConversation && (
          <div className='history-detail'>
            <div className='history-detail-header'>
              <div className='history-detail-timestamp'>
                {formatTimestamp(selectedConversation.timestamp)}
              </div>
            </div>
            
            <div className='history-detail-query'>
              {selectedConversation.query}
            </div>
            
            <div className='history-detail-response'>
              {renderResponseContent()}
            </div>
            
            {/* Display toolLogs separately if not integrated in response */}
            {selectedConversation.toolLogs && 
             Array.isArray(selectedConversation.toolLogs) && 
             selectedConversation.toolLogs.length > 0 && 
             (!selectedConversation.responseSegments || !Array.isArray(selectedConversation.responseSegments)) && (
              <div className="tool-logs">
                <h3>Tool Usage</h3>
                {selectedConversation.toolLogs.map((tool) => (
                  <div key={tool.id}>{renderToolLog(tool)}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className='history-resizer' ref={resizeRef} />
    </div>
  )
} 