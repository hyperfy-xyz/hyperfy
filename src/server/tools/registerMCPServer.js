import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import Database from 'better-sqlite3'
import fs from 'fs-extra'
import path from 'path'
import crypto from 'crypto'

import { fastifyMCPSSE } from './mcp-sse-plugin'
import { z } from 'zod'
import { hashFile } from '../../core/utils-server'
import { uuid } from '../../core/utils'


const rootDir = path.join(__dirname, '../')
const worldDir = path.join(rootDir, process.env.WORLD)
const assetsDir = path.join(worldDir, '/assets')
const docsDir = path.join(rootDir, '../docs')

// =====================================
// MCP Server Implementation Below
// =====================================
// Helper function to get the SQLite DB path (uses the same world dir as the main server)
const getDbPathForMCP = () => {
  // If environment variable is provided, use that
  if (process.env.SQLITE_DB_PATH) {
    console.log(`Using DB path from env: ${process.env.SQLITE_DB_PATH}`)
    return process.env.SQLITE_DB_PATH
  }

  console.log(getDbPathForMCP)
  // Otherwise use the same DB path as the main server
  const dbPath = path.join(worldDir, '/db.sqlite')
  console.log(`Resolved DB path: ${dbPath}`)
  return dbPath
}

/**
 * Saves a file to the assets directory and returns its hash and URL
 * @param {Buffer|String} content - The file content to save
 * @param {String} extension - The file extension (e.g., 'js', 'glb')
 * @returns {Promise<{hash: String, url: String, filePath: String}>}
 */
async function saveAssetFile(content, extension) {
  // Create a buffer from the content if it's a string
  const buffer = typeof content === 'string' ? Buffer.from(content) : content
  
  // Hash the buffer
  const hash = await hashFile(buffer)
  
  // Use hash as filename with the proper extension
  const filename = `${hash}.${extension}`
  
  // Canonical URL to this file
  const url = `asset://${filename}`
  
  // Save file to assets directory
  const filePath = path.join(assetsDir, filename)
  const exists = await fs.exists(filePath)
  if (!exists) {
    await fs.writeFile(filePath, buffer)
  }
  
  return { hash, url, filePath }
}

/**
 * Updates a blueprint with a new script file
 * @param {Object} world - The world instance
 * @param {Object} blueprint - The blueprint to update
 * @param {String} scriptContent - The script file content
 * @returns {Promise<Object>} The updated blueprint data
 */
async function updateBlueprintScript(world, blueprint, scriptContent) {
  try {
    // Create a buffer from the script content
    const buffer = Buffer.from(scriptContent)

    // Hash the buffer
    const hash = await hashFile(buffer)

    // Use hash as script filename
    const filename = `${hash}.js`

    // Canonical URL to this file
    const url = `asset://${filename}`

    // Save file to assets directory
    const filePath = path.join(assetsDir, filename)
    const exists = await fs.exists(filePath)
    if (!exists) {
      await fs.writeFile(filePath, buffer)
    }

    // Update blueprint version and script
    const version = blueprint.version + 1

    // Update blueprint locally (also rebuilds apps)
    world.blueprints.modify({
      id: blueprint.id,
      version,
      script: url,
    })

    // Mark the blueprint as dirty for saving
    world.network.dirtyBlueprints.add(blueprint.id)

    // Broadcast blueprint change to connected clients
    world.network.send('blueprintModified', {
      id: blueprint.id,
      version,
      script: url,
    })

    return {
      id: blueprint.id,
      version,
      script: url
    }
  } catch (err) {
    console.error('Error in updateBlueprintScript:', err)
    throw err
  }
}

// Common response formatter for consistency
function formatResponse(data, error = null) {
  if (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error.message || error,
          details: error.stack
        }, null, 2)
      }],
      isError: true
    };
  }
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        data
      }, null, 2)
    }]
  };
}

/**
 * Searches for documentation files in the docs directory that match a query
 * @param {string} query - The search query
 * @returns {Promise<Array<{file: string, content: string, matchCount: number}>>} Matching documentation files
 */
async function searchDocs(query) {
  try {
    if (!query) return []
    
    // Normalize the query to lowercase for case-insensitive matching
    const normalizedQuery = query.toLowerCase()
    
    // Get all markdown files in the docs directory
    const files = await fs.readdir(docsDir)
    const mdFiles = files.filter(file => file.endsWith('.md'))
    
    // Check subdirectories
    const subdirs = (await fs.readdir(docsDir, { withFileTypes: true }))
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
    
    // Gather all markdown files from subdirectories
    for (const subdir of subdirs) {
      try {
        const subdirFiles = await fs.readdir(path.join(docsDir, subdir))
        const subdirMdFiles = subdirFiles
          .filter(file => file.endsWith('.md'))
          .map(file => path.join(subdir, file))
        mdFiles.push(...subdirMdFiles)
      } catch (err) {
        console.error(`Error reading subdir ${subdir}:`, err)
      }
    }
    
    // Read each file and check for matches
    const results = []
    
    for (const file of mdFiles) {
      try {
        const filePath = path.join(docsDir, file)
        const content = await fs.readFile(filePath, 'utf8')
        
        // Count how many times the query appears in the content
        const matchCount = (content.toLowerCase().match(new RegExp(normalizedQuery, 'g')) || []).length
        
        // If there are matches, add to results
        if (matchCount > 0) {
          results.push({
            file,
            content,
            matchCount
          })
        }
      } catch (err) {
        console.error(`Error reading file ${file}:`, err)
      }
    }
    
    // Sort by relevance (match count)
    return results.sort((a, b) => b.matchCount - a.matchCount)
  } catch (err) {
    console.error('Error in searchDocs:', err)
    throw err
  }
}

/**
 * Creates a new entity in the world based on a blueprint
 * @param {Object} world - The world instance
 * @param {String} blueprintId - The ID of the blueprint to use
 * @param {Array<number>} position - Position [x, y, z]
 * @param {Array<number>} quaternion - Rotation as quaternion [x, y, z, w]
 * @param {String} creatorId - ID of the player creating the entity (optional)
 * @returns {Promise<Object>} The created entity
 */
async function createEntity(world, blueprintId, position, quaternion, creatorId = null) {
  try {
    // Check if blueprint exists
    const blueprint = world.blueprints.get(blueprintId)
    if (!blueprint) {
      throw new Error(`Blueprint with ID ${blueprintId} not found`)
    }

    // Create entity data
    const entityData = {
      id: uuid(),
      type: 'app',
      blueprint: blueprintId,
      position: position || [0, 0, 0],
      quaternion: quaternion || [0, 0, 0, 1],
      mover: null,
      uploader: null,
      pinned: false,
      state: {},
    }

    // If creator ID is provided, add it to the entity data
    if (creatorId) {
      entityData.creatorId = creatorId
    }

    // Add the entity to the world
    const entity = world.entities.add(entityData, true)

    return entity
  } catch (err) {
    console.error('Error in createEntity:', err)
    throw err
  }
}

export function registerMCPServer(world, fastify) {
  const mcpServer = new McpServer({
    name: 'hyperfy-mcp-server',
    version: '0.0.1',
  })

  // Enhanced world-query tool with safety checks and better error handling
  // mcpServer.tool(
  //   'world-query',
  //   {
  //     sql: z.string().describe('SQL query to execute against the world database'),
  //     params: z.array(z.any()).optional().describe('SQL parameters to safely inject'),
  //     limit: z.number().optional().default(1000).describe('Maximum number of results to return')
  //   },
  //   async ({ sql, params = [], limit = 1000 }) => {
  //     let db = null;
  //     try {
  //       const dbPath = getDbPathForMCP()
  //       db = new Database(dbPath)

  //       // Add LIMIT clause if not present
  //       const sqlWithLimit = sql.toLowerCase().includes('limit') ? 
  //         sql : `${sql} LIMIT ${limit}`;

  //       const results = db.prepare(sqlWithLimit).all(...params);
  //       return formatResponse(results);
  //     } catch (err) {
  //       return formatResponse(null, err);
  //     } finally {
  //       if (db) db.close();
  //     }
  //   }
  // )

  // Register the get-entity-script tool
  mcpServer.tool(
    'get-entity-script',
    {
      entityId: z.string().describe('ID of the entity to get script from'),
    },
    async ({ entityId }) => {
      let db = null;
      try {
        const dbPath = getDbPathForMCP()
        db = new Database(dbPath)

        // Get entity and blueprint data in a single query
        const query = `
          SELECT 
            e.id as entityId,
            e.data as entityData,
            b.id as blueprintId,
            b.data as blueprintData
          FROM entities e
          LEFT JOIN blueprints b ON json_extract(e.data, '$.blueprint') = b.id
          WHERE e.id = ?
        `;

        const result = db.prepare(query).get(entityId);

        if (!result) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Entity with ID ${entityId} not found`,
              },
            ],
            isError: true,
          }
        }

        // Parse the JSON data
        const entityData = JSON.parse(result.entityData);
        const blueprintData = JSON.parse(result.blueprintData);

        // Get the script URL from the blueprint
        const scriptUrl = blueprintData.script;
        if (!scriptUrl) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: No script found for app ${result.blueprintId}`,
              },
            ],
            isError: true,
          }
        }

        // Extract filename from asset:// URL
        const filename = scriptUrl.replace('asset://', '')
        const scriptPath = path.join(assetsDir, filename)

        // Read the script file
        const scriptContent = await fs.readFile(scriptPath, 'utf8')

        return {
          content: [
            {
              type: 'text',
              text: scriptContent,
            },
          ],
          metadata: {
            entity: entityData,
            app: blueprintData
          }
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err.message}`,
            },
          ],
          isError: true,
        }
      } finally {
        if (db) {
          db.close()
        }
      }
    }
  )

  // Register the update-blueprint-script tool
  mcpServer.tool(
    'update-app-script',
    {
      blueprintId: z.string().describe('ID of the app to update'),
      scriptContent: z.string().describe('New script content to apply to the app'),
    },
    async ({ blueprintId, scriptContent }) => {
      try {
        // Find the blueprint by ID
        const blueprint = world.blueprints.get(blueprintId)

        if (!blueprint) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: App with ID ${blueprintId} not found`,
              },
            ],
            isError: true,
          }
        }

        // Use the updateBlueprintScript function to update the blueprint
        const result = await updateBlueprintScript(world, blueprint, scriptContent)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                data: {
                  appId: result.id,
                  version: result.version,
                  script: result.script
                }
              }, null, 2)
            },
          ],
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Enhanced blueprint search tool with more search options
  mcpServer.tool(
    'get-app-scripts',
    {
      searchQuery: z.object({
        name: z.string().optional().describe('Search by app name'),
        author: z.string().optional().describe('Search by app author'),
        desc: z.string().optional().describe('Search in app description'),
        id: z.string().optional().describe('Search by exact app ID'),
        customQuery: z.string().optional().describe('Custom SQL WHERE clause for blueprint data'),
        props: z.record(z.any()).optional().describe('Search by app props'),
        tags: z.array(z.string()).optional().describe('Search by app tags'),
        modifiedSince: z.string().optional().describe('Find apps modified since date'),
        scriptContains: z.string().optional().describe('Search in script content')
      }).describe('Search criteria for finding apps'),
      includeEntities: z.boolean().default(false).describe('Whether to include entities using these apps'),
      includeScripts: z.boolean().default(true).describe('Whether to include script content'),
      limit: z.number().optional().default(100).describe('Maximum number of results')
    },
    async ({ searchQuery, includeEntities = false, includeScripts = true, limit = 100 }) => {
      let db = null;
      try {
        const dbPath = getDbPathForMCP()
        db = new Database(dbPath)

        const conditions = [];
        const params = [];

        // Enhanced search conditions
        if (searchQuery.id) {
          conditions.push('b.id = ?');
          params.push(searchQuery.id);
        }
        if (searchQuery.name) {
          conditions.push("json_extract(b.data, '$.name') LIKE ?");
          params.push(`%${searchQuery.name}%`);
        }
        if (searchQuery.author) {
          conditions.push("json_extract(b.data, '$.author') LIKE ?");
          params.push(`%${searchQuery.author}%`);
        }
        if (searchQuery.desc) {
          conditions.push("json_extract(b.data, '$.desc') LIKE ?");
          params.push(`%${searchQuery.desc}%`);
        }
        if (searchQuery.props) {
          Object.entries(searchQuery.props).forEach(([key, value]) => {
            conditions.push(`json_extract(b.data, '$.props.${key}') = ?`);
            params.push(value);
          });
        }
        if (searchQuery.tags) {
          const tagConditions = searchQuery.tags.map(tag => {
            params.push(`%${tag}%`);
            return "json_extract(b.data, '$.tags') LIKE ?";
          });
          conditions.push(`(${tagConditions.join(' OR ')})`);
        }
        if (searchQuery.modifiedSince) {
          conditions.push('b.updatedAt > ?');
          params.push(searchQuery.modifiedSince);
        }
        if (searchQuery.customQuery) {
          conditions.push(searchQuery.customQuery);
        }

        const whereClause = conditions.length > 0 
          ? 'WHERE ' + conditions.join(' AND ')
          : '';

        let query = `
          SELECT 
            b.id as blueprintId,
            json(b.data) as blueprintData,
            b.updatedAt
          FROM blueprints b
          ${whereClause}
          LIMIT ${limit}
        `;

        if (includeEntities) {
          query = `
            WITH matching_blueprints AS (${query})
            SELECT 
              mb.blueprintId,
              mb.blueprintData,
              mb.updatedAt,
              COALESCE(
                json_group_array(
                  CASE WHEN e.id IS NOT NULL THEN
                    json_object(
                      'id', e.id,
                      'data', json(e.data)
                    )
                  ELSE NULL END
                ),
                '[]'
              ) as entities
            FROM matching_blueprints mb
            LEFT JOIN entities e ON json_extract(e.data, '$.blueprint') = mb.blueprintId
            GROUP BY mb.blueprintId
          `;
        }

        const results = db.prepare(query).all(...params);
        
        if (!results || results.length === 0) {
          return formatResponse({ 
            message: 'No apps found matching the search criteria',
            searchQuery 
          });
        }

        const processedResults = await Promise.all(results.map(async (result) => {
          try {
            const blueprintData = typeof result.blueprintData === 'string' 
              ? JSON.parse(result.blueprintData)
              : result.blueprintData;

            const response = {
              app: blueprintData,
              updatedAt: result.updatedAt,
              entities: includeEntities ? parseEntities(result.entities) : null
            };

            if (includeScripts) {
              const scriptUrl = blueprintData.script;
              if (scriptUrl) {
                const filename = scriptUrl.replace('asset://', '');
                const scriptPath = path.join(assetsDir, filename);
                
                if (await fs.exists(scriptPath)) {
                  const scriptContent = await fs.readFile(scriptPath, 'utf8');
                  
                  // Filter by script content if requested
                  if (searchQuery.scriptContains && !scriptContent.includes(searchQuery.scriptContains)) {
                    return null;
                  }
                  
                  response.script = scriptContent;
                } else {
                  response.error = `Script file not found: ${filename}`;
                }
              } else {
                response.error = 'No script URL in app';
              }
            }

            return response;
          } catch (err) {
            console.error('Error processing blueprint result:', err);
            return {
              app: result.blueprintId,
              error: `Failed to process app: ${err.message}`
            };
          }
        }));

        // Filter out null results (from script content filtering)
        const filteredResults = processedResults.filter(r => r !== null);
        
        return formatResponse(filteredResults);
      } catch (err) {
        return formatResponse(null, err);
      } finally {
        if (db) db.close();
      }
    }
  )

  // New tool: Get all entities using a specific script
  mcpServer.tool(
    'find-app-script-usage',
    {
      scriptHash: z.string().optional().describe('Find entities using this script hash'),
      scriptContent: z.string().optional().describe('Find entities with scripts containing this content'),
      blueprintProps: z.record(z.any()).optional().describe('Additional app properties to match')
    },
    async ({ scriptHash, scriptContent, blueprintProps }) => {
      let db = null;
      try {
        if (!scriptHash && !scriptContent) {
          throw new Error('Either scriptHash or scriptContent must be provided');
        }

        const dbPath = getDbPathForMCP()
        db = new Database(dbPath)

        const conditions = [];
        const params = [];

        if (scriptHash) {
          conditions.push("json_extract(b.data, '$.script') LIKE ?");
          params.push(`%${scriptHash}%`);
        }

        if (blueprintProps) {
          Object.entries(blueprintProps).forEach(([key, value]) => {
            conditions.push(`json_extract(b.data, '$.props.${key}') = ?`);
            params.push(value);
          });
        }

        const query = `
          SELECT 
            b.id as blueprintId,
            json(b.data) as blueprintData,
            json_group_array(
              json_object(
                'id', e.id,
                'data', json(e.data)
              )
            ) as entities
          FROM blueprints b
          LEFT JOIN entities e ON json_extract(e.data, '$.blueprint') = b.id
          ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
          GROUP BY b.id
        `;

        const results = db.prepare(query).all(...params);

        const processedResults = await Promise.all(results.map(async (result) => {
          try {
            const blueprintData = typeof result.blueprintData === 'string' 
              ? JSON.parse(result.blueprintData)
              : result.blueprintData;

            const scriptUrl = blueprintData.script;
            if (!scriptUrl) return null;

            const filename = scriptUrl.replace('asset://', '');
            const scriptPath = path.join(assetsDir, filename);

            if (!await fs.exists(scriptPath)) return null;

            const script = await fs.readFile(scriptPath, 'utf8');
            
            // Filter by script content if requested
            if (scriptContent && !script.includes(scriptContent)) {
              return null;
            }

            return {
              app: blueprintData,
              script,
              entities: parseEntities(result.entities)
            };
          } catch (err) {
            console.error('Error processing result:', err);
            return null;
          }
        }));

        const filteredResults = processedResults.filter(r => r !== null);
        return formatResponse(filteredResults);
      } catch (err) {
        return formatResponse(null, err);
      } finally {
        if (db) db.close();
      }
    }
  )

  // Register the search-docs tool
  mcpServer.tool(
    'search-docs',
    {
      query: z.string().describe('Search term to find in documentation files'),
      limit: z.number().optional().default(5).describe('Maximum number of results to return')
    },
    async ({ query, limit = 5 }) => {
      try {
        const results = await searchDocs(query)
        
        // Limit the number of results
        const limitedResults = results.slice(0, limit)
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                data: {
                  query,
                  resultsCount: results.length,
                  results: limitedResults.map(r => ({
                    file: r.file,
                    matchCount: r.matchCount,
                    content: r.content
                  }))
                }
              }, null, 2)
            },
          ],
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Register the create-entity tool
  mcpServer.tool(
    'create-entity',
    {
      blueprintId: z.string().describe('ID of the app to create an entity from'),
      position: z.array(z.number()).length(3).optional().describe('Position [x, y, z]'),
      quaternion: z.array(z.number()).length(4).optional().describe('Rotation as quaternion [x, y, z, w]'),
      creatorId: z.string().optional().describe('ID of the player creating the entity')
    },
    async ({ blueprintId, position, quaternion, creatorId }) => {
      try {
        // Use default position/rotation if not provided
        const pos = position || [0, 0, 0]
        const rot = quaternion || [0, 0, 0, 1]
        
        // Create the entity
        const entity = await createEntity(world, blueprintId, pos, rot, creatorId)
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                data: {
                  entity: entity.data
                }
              }, null, 2)
            },
          ],
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Register the MCP SSE plugin
  fastify.register(fastifyMCPSSE, {
    server: mcpServer.server,
  })
}

// Helper function to parse entities JSON array
function parseEntities(entitiesJson) {
  try {
    // If it's already an object/array, return it
    if (typeof entitiesJson === 'object') {
      return entitiesJson;
    }
    // Parse JSON string if needed
    return JSON.parse(entitiesJson || '[]');
  } catch (err) {
    console.error('Error parsing entities:', err);
    return [];
  }
}
