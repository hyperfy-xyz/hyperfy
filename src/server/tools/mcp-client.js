import { Anthropic } from '@anthropic-ai/sdk'
import { EventEmitter } from 'events'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"


const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
if (!ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is not set')
}
console.log('ANTHROPIC_API_KEY:', ANTHROPIC_API_KEY)

export class McpClient extends EventEmitter {
  mcp
  anthropic
  transport
  tools
  resources

  constructor() {
    super()
    console.log('Initializing MCPClient...')
    // Initialize Anthropic client and MCP client
    this.anthropic = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    })
    console.log('Anthropic client initialized')
    this.mcp = new Client({ name: 'mcp-client-cli', version: '1.0.0' })
    console.log('MCP client initialized')
    // Store available resources
    this.resources = []
  }

  async connectToServer(serverUrl) {
    /**
     * Connect to an MCP server via SSE
     *
     * @param serverUrl - URL of the SSE endpoint (e.g., http://localhost:3000/sse)
     */
    console.log(`Attempting to connect to MCP server at: ${serverUrl}`)
    try {
      // Initialize transport and connect to server
      console.log('Creating SSE transport...')
      this.transport = new SSEClientTransport(new URL(serverUrl))
      console.log('Transport created, connecting to server...')
      
      // Set up event handlers before connecting
      this.transport.onopen = () => {
        console.log('SSE connection opened successfully')
      }
      
      this.transport.onerror = (error) => {
        console.error('SSE connection error:', error)
      }
      
      // Connect to the server
      await this.mcp.connect(this.transport)
      
      // Add a small delay to ensure connection is fully established
      await new Promise(resolve => setTimeout(resolve, 1000))
      console.log('Connection established, fetching available tools...')

      // List available tools
      const toolsResult = await this.mcp.listTools()
      console.log('Tool list received:', JSON.stringify(toolsResult, null, 2))
      this.tools = toolsResult.tools.map(tool => {
        console.log(`Processing tool: ${tool.name}`)
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        }
      })
      console.log(
        'Connected to server with tools:',
        this.tools.map(({ name }) => name)
      )
      
      // List available resources
      await this.listResources()
    } catch (e) {
      console.error('Failed to connect to MCP server: ', e)
      throw e
    }
  }
  
  /**
   * List all available resources from the server
   * 
   * @returns {Promise<Array>} List of available resources
   */
  async listResources() {
    try {
      console.log('Fetching available resources...')
      const result = await this.mcp.listResources()
      this.resources = result.resources || []
      console.log(`Found ${this.resources.length} available resources:`, 
        this.resources.map(r => r.name).join(', '))
      return this.resources
    } catch (error) {
      console.error('Error listing resources:', error)
      return []
    }
  }
  
  /**
   * Read a resource from the server
   * 
   * @param {string} uri - URI of the resource to read
   * @returns {Promise<Object>} Resource content
   */
  async readResource(uri) {
    try {
      console.log(`Reading resource at URI: ${uri}`)
      const resource = await this.mcp.readResource({ uri })
      console.log(`Successfully read resource: ${uri}`)
      return resource
    } catch (error) {
      console.error(`Error reading resource ${uri}:`, error)
      throw error
    }
  }
  
  /**
   * Get scripting rules content
   * 
   * @returns {Promise<string>} Scripting rules markdown content
   */
  async getScriptingRules() {
    try {
      const resource = await this.readResource('hyperfy://scripting-rules')
      if (resource && resource.contents && resource.contents.length > 0) {
        return resource.contents[0].text
      }
      throw new Error('Invalid resource format')
    } catch (error) {
      console.error('Error getting scripting rules:', error)
      return '# Error\n\nFailed to load scripting rules: ' + error.message
    }
  }

  async processQueryStream(query, userId = null) {
    /**
     * Process a query using Claude and available tools with streaming updates
     *
     * @param query - The user's input query
     * @param userId - Optional user ID for context and permission checking
     * @returns Processed response as a string
     */
    console.log(`Processing query: "${query}" for user: ${userId || 'anonymous'}`)
    this.emit('start', { query, userId })
    
    // Try to get scripting rules and prepare system prompt
    let systemPrompt = "You are a helpful AI assistant for the Hyperfy platform.";
    try {
      const scriptingRules = await this.getScriptingRules();
      if (scriptingRules) {
        systemPrompt += " You have access to these documentation guidelines for Hyperfy scripting:\n\n" + 
          scriptingRules.substring(0, 10000); // Limit to first 10K chars if very long
      }
    } catch (err) {
      console.warn("Failed to load scripting rules for system prompt:", err);
    }
    
    const messages = [
      {
        role: 'user',
        content: query,
      },
    ]

    // Add user context if available
    if (userId) {
      this.emit('status', { status: `Processing request for user ${userId.substring(0, 8)}...`, userId })
    } else {
      this.emit('status', { status: 'Thinking...', userId })
    }
    
    // Initial Claude API call
    console.log('Sending request to Claude API...')
    
    const initialResponse = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8192,
      system: systemPrompt,
      messages,
      tools: this.tools,
    })
    console.log('Received response from Claude:', JSON.stringify(initialResponse.id))

    // Process response and handle tool calls
    const finalText = []
    const toolResults = []

    // Function to process a response recursively
    const processResponse = async (response) => {
      console.log(`Processing ${response.content.length} content blocks from Claude`)
      for (const content of response.content) {
        console.log(`Processing content of type: ${content.type}`)
        if (content.type === 'text') {
          console.log('Adding text response to output')
          finalText.push(content.text)
          this.emit('text', { text: content.text, userId })
        } else if (content.type === 'tool_use') {
          // Execute tool call
          const toolName = content.name
          const toolArgs = content.input
          console.log(`Executing tool call: ${toolName} with args:`, JSON.stringify(toolArgs))
          
          this.emit('tool_start', { 
            tool: toolName,
            args: toolArgs,
            userId
          })

          try {
            // Store userId in metadata for tool context
            const contextData = userId ? { userId } : undefined
            
            const result = await this.mcp.callTool({
              name: toolName,
              arguments: toolArgs,
              metadata: contextData,
            }, 
            undefined, {
              timeout: 90000
            })
            console.log(`Tool execution result:`, JSON.stringify(result))
            toolResults.push(result)
            
            this.emit('tool_result', { 
              tool: toolName,
              result: result,
              userId
            })

            // Continue conversation with tool results
            console.log('Adding tool result to messages for follow-up')
            const toolId = `tool_${Date.now()}`;
            
            // Add the assistant's tool use message
            messages.push({
              role: 'assistant',
              content: [{ 
                type: 'tool_use', 
                id: toolId, 
                name: toolName, 
                input: toolArgs 
              }]
            })
            
            // Add the tool result message in proper format
            messages.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: toolId,
                  content: result.content
                }
              ]
            })

            // Get next response from Claude
            this.emit('status', { status: 'Processing results...', userId })
            console.log('Sending follow-up request to Claude with tool results...')
            const followUpResponse = await this.anthropic.messages.create({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 8192,
              system: systemPrompt,
              messages,
              tools: this.tools,
            })
            console.log('Received follow-up response from Claude:', JSON.stringify(followUpResponse.id))
            
            // Process the follow-up response recursively
            await processResponse(followUpResponse)
          } catch (error) {
            console.error(`Error executing tool ${toolName}:`, error)
            this.emit('tool_error', { 
              tool: toolName,
              error: error.message,
              userId 
            })
            finalText.push(`[Error executing tool ${toolName}: ${error.message}]`)
          }
        }
      }
    }
    
    // Start processing with the initial response
    await processResponse(initialResponse)

    this.emit('complete', { response: finalText.join('\n'), userId })
    console.log('Query processing complete')
    return finalText.join('\n')
  }

  async processQuery(query) {
    return this.processQueryStream(query)
  }

  async cleanup() {
    /**
     * Clean up resources
     */
    console.log('Cleaning up resources...')
    await this.mcp.close()
    console.log('MCP client closed')
  }
}

// async function main() {
//   console.log('Starting MCP CLI application...')
//   console.log('Command line arguments:', process.argv)
  
//   if (process.argv.length < 3) {
//     console.log('Usage: node build/index.js <sse_server_url>')
//     return
//   }
  
//   const serverUrl = process.argv[2]
//   if (!serverUrl) {
//     console.error('Error: Server URL is undefined')
//     return
//   }
  
//   console.log(`Using server URL: ${serverUrl}`)
//   const mcpClient = new MCPClient()
//   try {
//     await mcpClient.connectToServer(serverUrl)
//     await mcpClient.chatLoop()
//   } catch (error) {
//     console.error('Error in main execution:', error)
//   } finally {
//     console.log('Performing cleanup...')
//     await mcpClient.cleanup()
//     console.log('Exiting application')
//     process.exit(0)
//   }
// }

// main()
