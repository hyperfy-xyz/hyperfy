import { Anthropic } from '@anthropic-ai/sdk'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"


const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
if (!ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is not set')
}
console.log('ANTHROPIC_API_KEY:', ANTHROPIC_API_KEY)

export class McpClient {
  mcp
  anthropic
  transport
  tools

  constructor() {
    console.log('Initializing MCPClient...')
    // Initialize Anthropic client and MCP client
    this.anthropic = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    })
    console.log('Anthropic client initialized')
    this.mcp = new Client({ name: 'mcp-client-cli', version: '1.0.0' })
    console.log('MCP client initialized')
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
    } catch (e) {
      console.error('Failed to connect to MCP server: ', e)
      throw e
    }
  }

  async processQuery(query) {
    /**
     * Process a query using Claude and available tools
     *
     * @param query - The user's input query
     * @returns Processed response as a string
     */
    console.log(`Processing query: "${query}"`)
    const messages = [
      {
        role: 'user',
        content: query,
      },
    ]

    // Initial Claude API call
    console.log('Sending request to Claude API...')
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages,
      tools: this.tools,
    })
    console.log('Received response from Claude:', JSON.stringify(response.id))

    // Process response and handle tool calls
    const finalText = []
    const toolResults = []

    console.log(`Processing ${response.content.length} content blocks from Claude`)
    for (const content of response.content) {
      console.log(`Processing content of type: ${content.type}`)
      if (content.type === 'text') {
        console.log('Adding text response to output')
        finalText.push(content.text)
      } else if (content.type === 'tool_use') {
        // Execute tool call
        const toolName = content.name
        const toolArgs = content.input
        console.log(`Executing tool call: ${toolName} with args:`, JSON.stringify(toolArgs))

        const result = await this.mcp.callTool({
          name: toolName,
          arguments: toolArgs,
        })
        console.log(`Tool execution result:`, JSON.stringify(result))
        toolResults.push(result)
        finalText.push(`[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`)

        // Continue conversation with tool results
        console.log('Adding tool result to messages for follow-up')
        messages.push({
          role: 'user',
            content: result.content,
        })

        // Get next response from Claude
        console.log('Sending follow-up request to Claude with tool results...')
        const response = await this.anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages,
        })
        console.log('Received follow-up response from Claude:', JSON.stringify(response.id))

        if (response.content.length > 0 && response.content[0]) {
          const firstContent = response.content[0];
          finalText.push(firstContent.type === 'text' ? firstContent.text : JSON.stringify(firstContent))
        } else {
          console.log('Warning: Empty or unexpected response content structure')
          finalText.push('[Empty or unexpected response]')
        }
      }
    }

    console.log('Query processing complete')
    return finalText.join('\n')
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
