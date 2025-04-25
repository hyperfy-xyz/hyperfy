import { System } from './System'
import { z } from 'zod'

export class MCP extends System {
  constructor(world) {
    super(world)
    this.mcp = null
    this.appTools = new Map()
  }

  async init({ mcp }) {
    // console.log('[MCP] Init:', fastify)

    try {
      // Dynamically import mcp to avoid issues on client-side

      // Create a new MCP server
      this.mcp = mcp

      this.mcp.tool(
        'greet',
        {
          name: z.string().describe('Name of the person to greet'),
        },
        ({ name }) => {
          return {
            content: [{ type: 'text', text: `Hello ${name}!` }],
          }
        }
      )

      console.log('[MCP] Server initialized successfully')
    } catch (err) {
      console.error('[MCP] Failed to create server:', err)
    }

    // Inject the registerMCPTool method into the app runtime
    this.world.inject({
      app: {
        registerMCPTool: (entity, toolName, schema, handler) => {
          return this.registerAppMCPTool(toolName, schema, handler, entity.data.id)
        },
        debug: entity => {
          // Print MCP server and registered tool schemas
          console.log('[MCP] Debug - Server:', this.mcp)
          if (this.mcp?._registeredTools) {
            console.log('[MCP] Debug - Registered Tools:')
            for (const [name, tool] of Object.entries(this.mcp._registeredTools)) {
              console.log(`  Tool "${name}":`, /**tool.inputSchema**/)
            }
          }
        },
      },
    })
  }

  registerAppMCPTool(toolName, schema, handler, entityId) {
    // Only register on server side
    if (!this.mcp) {
      console.warn(`[MCP] Attempted to register tool '${toolName}' before MCP server is initialized`)
      return false
    }

    try {
      console.log(`[MCP] Registering tool '${toolName}' with schema:`, schema)

      // Convert the schema to Zod schema
    //   const zodSchema = translateSchema(schema)

      // Create a wrapper handler that formats the response to MCP standard
      const wrappedHandler = async params => {
        try {
          // Call the original handler
          const result = await handler(params)

          // Format the result according to MCP standard
          if (result === undefined || result === null) {
            return {
              content: [{ type: 'text', text: '' }],
            }
          } else if (typeof result === 'object' && result.content) {
            // If the handler already returns in MCP format, use it as is
            return result
          } else {
            // Otherwise, convert to MCP format
            return {
              content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }],
            }
          }
        } catch (err) {
          console.error(`[MCP] Tool '${toolName}' execution failed:`, err)
          return {
            content: [{ type: 'text', text: err.message || 'Error in tool execution' }],
            isError: true,
          }
        }
      }

      // Register the tool with the MCP server
      this.mcp.tool(toolName, schema, wrappedHandler)
    //   appServer.tool(
    //     'greet',
    //     {
    //       name: z.string().describe('Name of the person to greet'),
    //     },
    //     ({ name }) => {
    //       return {
    //         content: [{ type: 'text', text: `Hello ${name}!` }],
    //       }
    //     }
    //   )
      // Keep track of registered tools
      this.appTools.set(toolName, { schema, handler, entityId })

    //   this.mcp.servers.sendToolListChanged()
      

      console.log(`[MCP] Successfully registered tool '${toolName}'`)
      return true
    } catch (err) {
      console.error(`[MCP] Failed to register tool '${toolName}':`, err)
      return false
    }
  }

  unregisterAppMCPTools(entityId) {
    if (!this.mcp) {
      return false
    }

    try {
      // Get all tool names registered by this app
      const toolsToRemove = []
      for (const [toolName, details] of this.appTools.entries()) {
        if (details.entityId === entityId) {
          toolsToRemove.push(toolName)
        }
      }

      // Remove each tool
      for (const toolName of toolsToRemove) {
        console.log(`[MCP] Unregistering tool '${toolName}' for entity ${entityId}`)
        
        // Remove from MCP server
        if (this.mcp.removeTool) {
          this.mcp.removeTool(toolName)
        } else if (this.mcp._registeredTools) {
          delete this.mcp._registeredTools[toolName]
        }
        
        // Remove from our tracking
        this.appTools.delete(toolName)
      }

      // Notify clients that tool list has changed
      if (toolsToRemove.length > 0) {
        if (this.mcp.sendToolListChanged) {
          this.mcp.sendToolListChanged()
        }
        console.log(`[MCP] Successfully unregistered ${toolsToRemove.length} tools for entity ${entityId}`)
      }
      
      return true
    } catch (err) {
      console.error(`[MCP] Failed to unregister tools for entity ${entityId}:`, err)
      return false
    }
  }

  // Method to get the MCP server instance, useful for integration with fastify later
  getmcp() {
    return this.mcp
  }
}
