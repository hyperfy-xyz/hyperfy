import fs from 'fs'
import path from 'path'
import Anthropic, { toFile } from '@anthropic-ai/sdk'
import { OpenAI } from 'openai'

import { System } from './System'
import { hashFile } from '../utils-server'

const prefix = `
app.remove(app.get('Block'))
`

const docs = fs.readFileSync(path.join(__dirname, 'public/ai-docs.md'), 'utf8')

/**
 * AI System
 *
 * - Runs on the server
 * - Handles comms with AI apis etc
 *
 */
export class ServerAI extends System {
  constructor(world) {
    super(world)
    this.assets = null
    this.provider = process.env.AI_PROVIDER || null
    this.model = process.env.AI_MODEL || null
    this.effort = process.env.AI_EFFORT || 'minimal'
    this.apiKey = process.env.AI_API_KEY || null
    if (this.provider && this.model && this.apiKey) {
      if (this.provider === 'openai') {
        this.client = new OpenAIClient(this.apiKey, this.model, this.effort)
      }
      if (this.provider === 'anthropic') {
        this.client = new AnthropicClient(this.apiKey, this.model)
      }
      if (this.provider === 'xai') {
        this.client = new XAIClient(this.apiKey, this.model)
      }
    }
    this.enabled = !!this.client
  }

  serialize() {
    return {
      enabled: this.enabled,
      provider: this.provider,
      model: this.model,
      effort: this.effort,
    }
  }

  async init({ assets }) {
    this.assets = assets
  }

  async onAction(action) {
    if (!this.enabled) {
      return
    }
    if (action.name === 'create') {
      this.create(action)
    } else if (action.name === 'edit') {
      this.edit(action)
    } else if (action.name === 'fix') {
      this.fix(action)
    }
  }

  async create({ blueprintId, appId, prompt }) {
    console.log('[ai] creating...')
    // classify prompt to a short descriptive name for the app
    this.classify({ blueprintId, prompt })
    // send prompt to ai to generate code
    const startAt = performance.now()
    const output = await this.client.create(prompt)
    const code = prefix + output
    const elapsed = (performance.now() - startAt) / 1000
    console.log(code)
    console.log(`[ai] created in ${elapsed}s`)
    // convert new code to asset
    const file = new File([code], 'script.js', { type: 'text/plain' })
    const fileContent = await file.arrayBuffer()
    const hash = await hashFile(Buffer.from(fileContent))
    const filename = `${hash}.js`
    const url = `asset://${filename}`
    // upload new script asset
    await this.assets.upload(file)
    // modify blueprint locally
    const blueprint = this.world.blueprints.get(blueprintId)
    const version = blueprint.version + 1
    const change = { id: blueprint.id, version, script: url }
    this.world.blueprints.modify(change)
    // send blueprint update to all clients
    this.world.network.send('blueprintModified', change)
    this.world.network.dirtyBlueprints.add(change.id)
  }

  async edit({ blueprintId, appId, prompt }) {
    console.log('[ai] editing...')
    // get existing blueprint
    let blueprint = this.world.blueprints.get(blueprintId)
    if (!blueprint) return console.error('[ai] edit blueprint but blueprint not found')
    // get code to edit
    let script = this.world.loader.get('script', blueprint.script)
    if (!script) script = await this.world.loader.load('script', blueprint.script)
    // send prompt to ai to generate code
    const startAt = performance.now()
    const code = script.code.replace(prefix, '')
    const output = await this.client.edit(code, prompt)
    const newCode = prefix + output
    const elapsed = (performance.now() - startAt) / 1000
    console.log(`[ai] edited in ${elapsed}s`)
    // convert new code to asset
    const file = new File([newCode], 'script.js', { type: 'text/plain' })
    const fileContent = await file.arrayBuffer()
    const hash = await hashFile(Buffer.from(fileContent))
    const filename = `${hash}.js`
    const url = `asset://${filename}`
    // upload new script asset
    await this.assets.upload(file)
    // modify blueprint locally
    blueprint = this.world.blueprints.get(blueprintId)
    const version = blueprint.version + 1
    const change = { id: blueprint.id, version, script: url }
    this.world.blueprints.modify(change)
    // send blueprint update to all clients
    this.world.network.send('blueprintModified', change)
    this.world.network.dirtyBlueprints.add(change.id)
  }

  async fix({ blueprintId, appId, error }) {
    console.log('[ai] fixing...')
    // get existing blueprint
    let blueprint = this.world.blueprints.get(blueprintId)
    if (!blueprint) return console.error('[ai] fix blueprint but blueprint not found')
    // get code to fix
    let script = this.world.loader.get('script', blueprint.script)
    if (!script) script = await this.world.loader.load('script', blueprint.script)
    // send prompt to ai to generate code
    const startAt = performance.now()
    const code = script.code.replace(prefix, '')
    const output = await this.client.fix(code, error)
    const newCode = prefix + output
    const elapsed = (performance.now() - startAt) / 1000
    console.log(`[ai] fixed in ${elapsed}s`)
    // convert new code to asset
    const file = new File([newCode], 'script.js', { type: 'text/plain' })
    const fileContent = await file.arrayBuffer() // or file.text() for string
    const hash = await hashFile(Buffer.from(fileContent))
    const filename = `${hash}.js`
    const url = `asset://${filename}`
    // upload new script asset
    await this.assets.upload(file)
    // modify blueprint locally
    blueprint = this.world.blueprints.get(blueprintId)
    const version = blueprint.version + 1
    const change = { id: blueprint.id, version, script: url }
    this.world.blueprints.modify(change)
    // send blueprint update to all clients
    this.world.network.send('blueprintModified', change)
    this.world.network.dirtyBlueprints.add(change.id)
  }

  async classify({ blueprintId, prompt }) {
    // get a name for the object
    const name = await this.client.classify(prompt)
    // update name
    const blueprint = this.world.blueprints.get(blueprintId)
    const version = blueprint.version + 1
    const change = { id: blueprint.id, version, name }
    this.world.blueprints.modify(change)
    // send blueprint update to all clients
    this.world.network.send('blueprintModified', change)
    this.world.network.dirtyBlueprints.add(change.id)
  }
}

class OpenAIClient {
  constructor(apiKey, model, effort) {
    const config = { apiKey }
    
    // Check for custom base URL override
    const baseURL = process.env.OPENAI_BASE_URL
    if (baseURL) {
      config.baseURL = baseURL
    }
    
    this.client = new OpenAI(config)
    this.model = model
    this.effort = effort
  }


  async create(prompt) {
    const resp = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 8192,
      messages: [
        {
          role: 'system',
          content: `
            ${docs}
            ===============
            You are an artist and code generator. Always respond with raw code only, never use markdown code blocks or any other formatting.`,
        },
        {
          role: 'user',
          content: `Respond with the javascript needed to generate the following:\n\n"${prompt}"`,
        },
      ],
    })
    return resp.choices[0].message.content
  }

  async edit(code, prompt) {
    const resp = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 8192,
      messages: [
        {
          role: 'system',
          content: `
            ${docs}
            ===============
            You are an artist and code generator. Always respond with raw code only, never use markdown code blocks or any other formatting.
            Here is the existing script that you will be working with:
            ===============
            ${code}`,
        },
        {
          role: 'user',
          content: `Please edit the code above to satisfy the following request:\n\n"${prompt}"`,
        },
      ],
    })
    return resp.choices[0].message.content
  }

  async fix(code, error) {
    const resp = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 8192,
      messages: [
        {
          role: 'system',
          content: `
            ${docs}
            ===============
            You are an artist and code generator. Always respond with raw code only, never use markdown code blocks or any other formatting.
            Here is the existing script that you will be working with:
            ===============
            ${code}`,
        },
        {
          role: 'user',
          content: `This code has an error please fix it:\n\n"${JSON.stringify(error, null, 2)}"`,
        },
      ],
    })
    return resp.choices[0].message.content
  }

  async classify(prompt) {
    const resp = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 8192,
      messages: [
        {
          role: 'system',
          content: `You are a classifier. We will give you a prompt that a user has entered to generate a 3D object and your job is respond with a short name for the object. For example if someone prompts "a cool gamer desk with neon lights" you would respond with something like "Gamer Desk" because it is a short descriptive name that captures the essence of the object.`,
        },
        {
          role: 'user',
          content: `Please classify the following prompt:\n\n"${prompt}"`,
        },
      ],
    })
    return resp.choices[0].message.content
  }
}

class AnthropicClient {
  constructor(apiKey, model) {
    this.client = new Anthropic({ apiKey })
    this.model = model
    this.maxTokens = 8192
  }

  async create(prompt) {
    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: `
        ${docs}
        ===============
        You are an artist and code generator. Always respond with raw code only, never use markdown code blocks or any other formatting.`,
      messages: [
        {
          role: 'user',
          content: `Respond with the javascript needed to generate the following:\n\n"${prompt}"`,
        },
      ],
    })
    return resp.content[0].text
  }

  async edit(code, prompt) {
    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: `
        ${docs}
        ===============
        You are an artist and code generator. Always respond with raw code only, never use markdown code blocks or any other formatting.
        Here is the existing script that you will be working with:
        ===============
        ${code}`,
      messages: [
        {
          role: 'user',
          content: `Please edit the code above to satisfy the following request:\n\n"${prompt}"`,
        },
      ],
    })
    return resp.content[0].text
  }

  async fix(code, error) {
    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: `
        ${docs}
        ===============
        You are an artist and code generator. Always respond with raw code only, never use markdown code blocks or any other formatting.
        Here is the existing script that you will be working with:
        ===============
        ${code}`,
      messages: [
        {
          role: 'user',
          content: `This code has an error please fix it:\n\n"${JSON.stringify(error, null, 2)}"`,
        },
      ],
    })
    return resp.content[0].text
  }

  async classify(prompt) {
    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: `You are a classifier. We will give you a prompt that a user has entered to generate a 3D object and your job is respond with a short name for the object. For example if someone prompts "a cool gamer desk with neon lights" you would respond with something like "Gamer Desk" because it is a short descriptive name that captures the essence of the object.`,
      messages: [
        {
          role: 'user',
          content: `Please classify the following prompt:\n\n"${prompt}"`,
        },
      ],
    })
    return resp.content[0].text
  }
}

class Comput3Client {
  constructor() {
    this.apiKey = 'c3_api_ZtSTqeJjSca97M57mKEEksI93278'
    this.model = 'kimi-k2'
    // this.model = 'qwen3-coder:480b'
  }

  async exec(data) {
    const resp = await fetch('https://api.comput3.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    const json = await resp.json()
    console.log(JSON.stringify(json, null, 2))
    return json.choices[0].message.content
  }

  async create(prompt) {
    return await this.exec({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `
            ${docs}
            ===============
            You are an artist and code generator. Always respond with raw code only, never use markdown code blocks or any other formatting.`,
        },
        {
          role: 'user',
          content: `Respond with the javascript needed to generate the following:\n\n"${prompt}"`,
        },
      ],
    })
  }

  async edit(code, prompt) {
    return await this.exec({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `
            ${docs}
            ===============
            You are an artist and code generator. Always respond with raw code only, never use markdown code blocks or any other formatting.
            Here is the existing script that you will be working with:
            ===============
            ${code}`,
        },
        {
          role: 'user',
          content: `Please edit the code above to satisfy the following request:\n\n"${prompt}"`,
        },
      ],
    })
  }

  async fix(code, error) {
    return await this.exec({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `
            ${docs}
            ===============
            You are an artist and code generator. Always respond with raw code only, never use markdown code blocks or any other formatting.
            Here is the existing script that you will be working with:
            ===============
            ${code}`,
        },
        {
          role: 'user',
          content: `This code has an error please fix it:\n\n"${JSON.stringify(error, null, 2)}"`,
        },
      ],
    })
  }

  async classify(prompt) {
    return await this.exec({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are a classifier. We will give you a prompt that a user has entered to generate a 3D object and your job is respond with a short name for the object. For example if someone prompts "a cool gamer desk with neon lights" you would respond with something like "Gamer Desk" because it is a short descriptive name that captures the essence of the object.`,
        },
        {
          role: 'user',
          content: `Please classify the following prompt:\n\n"${prompt}"`,
        },
      ],
    })
  }
}

class XAIClient {
  constructor(apiKey, model) {
    this.apiKey = apiKey
    this.model = model
    this.url = 'https://api.x.ai/v1/chat/completions'
  }

  async create(prompt) {
    const resp = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages: [
          {
            role: 'system',
            content: `
              ${docs}
              ===============
              You are an artist and code generator. Always respond with raw code only, never use markdown code blocks or any other formatting.`,
          },
          {
            role: 'user',
            content: `Respond with the javascript needed to generate the following:\n\n"${prompt}"`,
          },
        ],
      }),
    })
    const data = await resp.json()
    return data.choices[0].message.content
  }

  async edit(code, prompt) {
    const resp = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages: [
          {
            role: 'system',
            content: `
              ${docs}
              ===============
              You are an artist and code generator. Always respond with raw code only, never use markdown code blocks or any other formatting.
              Here is the existing script that you will be working with:
              ===============
              ${code}`,
          },
          {
            role: 'user',
            content: `Please edit the code above to satisfy the following request:\n\n"${prompt}"`,
          },
        ],
      }),
    })
    const data = await resp.json()
    return data.choices[0].message.content
  }

  async fix(code, error) {
    const resp = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages: [
          {
            role: 'system',
            content: `
              ${docs}
              ===============
              You are an artist and code generator. Always respond with raw code only, never use markdown code blocks or any other formatting.
              Here is the existing script that you will be working with:
              ===============
              ${code}`,
          },
          {
            role: 'user',
            content: `This code has an error please fix it:\n\n"${JSON.stringify(error, null, 2)}"`,
          },
        ],
      }),
    })
    const data = await resp.json()
    return data.choices[0].message.content
  }

  async classify(prompt) {
    const resp = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages: [
          {
            role: 'system',
            content: `You are a classifier. We will give you a prompt that a user has entered to generate a 3D object and your job is respond with a short name for the object. For example if someone prompts "a cool gamer desk with neon lights" you would respond with something like "Gamer Desk" because it is a short descriptive name that captures the essence of the object.`,
          },
          {
            role: 'user',
            content: `Please classify the following prompt:\n\n"${prompt}"`,
          },
        ],
      }),
    })
    const data = await resp.json()
    return data.choices[0].message.content
  }
}