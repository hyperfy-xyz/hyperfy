import Knex from 'knex'
import moment from 'moment'
import fs from 'fs-extra'
import path from 'path'
import { uuid } from '../core/utils'
import { importApp } from '../core/extras/appTools'

let db

export async function getDB(worldDir) {
  const filename = path.join(worldDir, '/db.sqlite')
  if (!db) {
    db = Knex({
      client: 'better-sqlite3',
      connection: {
        filename,
      },
      useNullAsDefault: true,
    })
    await migrate(db, worldDir)
  }
  return db
}

async function migrate(db, worldDir) {
  // ensure we have our config table
  const exists = await db.schema.hasTable('config')
  if (!exists) {
    await db.schema.createTable('config', table => {
      table.string('key').primary()
      table.string('value')
    })
    await db('config').insert({ key: 'version', value: '0' })
  }
  // get current version
  const versionRow = await db('config').where('key', 'version').first()
  let version = parseInt(versionRow.value)
  // run missing migrations
  for (let i = version; i < migrations.length; i++) {
    console.log(`running migration #${i + 1}...`)
    await migrations[i](db, worldDir)

    // DEBUG: disable persist
    await db('config')
      .where('key', 'version')
      .update('value', (i + 1).toString())

    version = i + 1
  }
}

/**
 * NOTE: always append new migrations and never modify pre-existing ones!
 */
const migrations = [
  // add users table
  async db => {
    await db.schema.createTable('users', table => {
      table.string('id').primary()
      table.string('name').notNullable()
      table.string('roles').notNullable()
      table.timestamp('createdAt').notNullable()
    })
  },
  // add blueprints & entities tables
  async db => {
    await db.schema.createTable('blueprints', table => {
      table.string('id').primary()
      table.text('data').notNullable()
      table.timestamp('createdAt').notNullable()
      table.timestamp('updatedAt').notNullable()
    })
    await db.schema.createTable('entities', table => {
      table.string('id').primary()
      table.text('data').notNullable()
      table.timestamp('createdAt').notNullable()
      table.timestamp('updatedAt').notNullable()
    })
  },
  // add blueprint.version field
  async db => {
    const now = moment().toISOString()
    const blueprints = await db('blueprints')
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data)
      if (data.version === undefined) {
        data.version = 0
        await db('blueprints')
          .where('id', blueprint.id)
          .update({
            data: JSON.stringify(data),
            updatedAt: now,
          })
      }
    }
  },
  // add user.vrm field
  async db => {
    await db.schema.alterTable('users', table => {
      table.string('vrm').nullable()
    })
  },
  // add blueprint.config field
  async db => {
    const blueprints = await db('blueprints')
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data)
      if (data.config === undefined) {
        data.config = {}
        await db('blueprints')
          .where('id', blueprint.id)
          .update({
            data: JSON.stringify(data),
          })
      }
    }
  },
  // rename user.vrm -> user.avatar
  async db => {
    await db.schema.alterTable('users', table => {
      table.renameColumn('vrm', 'avatar')
    })
  },
  // add blueprint.preload field
  async db => {
    const blueprints = await db('blueprints')
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data)
      if (data.preload === undefined) {
        data.preload = false
        await db('blueprints')
          .where('id', blueprint.id)
          .update({
            data: JSON.stringify(data),
          })
      }
    }
  },
  // blueprint.config -> blueprint.props
  async db => {
    const blueprints = await db('blueprints')
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data)
      data.props = data.config
      delete data.config
      await db('blueprints')
        .where('id', blueprint.id)
        .update({
          data: JSON.stringify(data),
        })
    }
  },
  // add blueprint.public and blueprint.locked fields
  async db => {
    const blueprints = await db('blueprints')
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data)
      let changed
      if (data.public === undefined) {
        data.public = false
        changed = true
      }
      if (data.locked === undefined) {
        data.locked = false
        changed = true
      }
      if (changed) {
        await db('blueprints')
          .where('id', blueprint.id)
          .update({
            data: JSON.stringify(data),
          })
      }
    }
  },
  // add blueprint.unique field
  async db => {
    const blueprints = await db('blueprints')
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data)
      let changed
      if (data.unique === undefined) {
        data.unique = false
        changed = true
      }
      if (changed) {
        await db('blueprints')
          .where('id', blueprint.id)
          .update({
            data: JSON.stringify(data),
          })
      }
    }
  },
  // rename config key to settings
  async db => {
    let config = await db('config').where('key', 'config').first()
    if (config) {
      const settings = config.value
      await db('config').insert({ key: 'settings', value: settings })
      await db('config').where('key', 'config').delete()
    }
  },
  // add blueprint.disabled field
  async db => {
    const blueprints = await db('blueprints')
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data)
      if (data.disabled === undefined) {
        data.disabled = false
        await db('blueprints')
          .where('id', blueprint.id)
          .update({
            data: JSON.stringify(data),
          })
      }
    }
  },
  // add entity.scale field
  async db => {
    const entities = await db('entities')
    for (const entity of entities) {
      const data = JSON.parse(entity.data)
      if (!data.scale) {
        data.scale = [1, 1, 1]
        await db('entities')
          .where('id', entity.id)
          .update({
            data: JSON.stringify(data),
          })
      }
    }
  },
  // add blueprint.scene field
  async db => {
    const blueprints = await db('blueprints')
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data)
      let changed
      if (data.scene === undefined) {
        data.scene = false
        changed = true
      }
      if (changed) {
        await db('blueprints')
          .where('id', blueprint.id)
          .update({
            data: JSON.stringify(data),
          })
      }
    }
  },
  // migrate or generate scene app
  async (db, worldDir) => {
    const now = moment().toISOString()
    const record = await db('config').where('key', 'settings').first()
    const settings = JSON.parse(record?.value || '{}')
    // if using a settings model, we'll convert this to the scene app
    if (settings.model) {
      // create blueprint and entity
      const blueprintId = '$scene' // singleton
      const blueprint = {
        id: blueprintId,
        data: JSON.stringify({
          id: blueprintId,
          version: 0,
          name: 'Scene',
          image: null,
          author: null,
          url: null,
          desc: null,
          model: settings.model.url,
          script: null,
          props: null,
          preload: true,
          public: false,
          locked: false,
          frozen: false,
          unique: false,
          scene: true,
          disabled: false,
        }),
        createdAt: now,
        updatedAt: now,
      }
      await db('blueprints').insert(blueprint)
      const entityId = uuid()
      const entity = {
        id: entityId,
        data: JSON.stringify({
          id: entityId,
          type: 'app',
          blueprint: blueprint.id,
          position: [0, 0, 0],
          quaternion: [0, 0, 0, 1],
          scale: [1, 1, 1],
          mover: null,
          uploader: null,
          pinned: false,
          state: {},
        }),
        createdAt: now,
        updatedAt: now,
      }
      await db('entities').insert(entity)
      // clear the settings.model
      delete settings.model
      await db('config')
        .where('key', 'settings')
        .update({ value: JSON.stringify(settings) })
    }
    // otherwise create the scene app from src/world/scene.hyp
    else {
      const rootDir = path.join(__dirname, '../')
      const scenePath = path.join(rootDir, 'src/world/scene.hyp')
      const buffer = await fs.readFile(scenePath)
      const file = new File([buffer], 'scene.hyp', {
        type: 'application/octet-stream',
      })
      const app = await importApp(file)
      // write the assets to the worlds assets folder
      for (const asset of app.assets) {
        const filename = asset.url.split('asset://').pop()
        const buffer = Buffer.from(await asset.file.arrayBuffer())
        const dest = path.join(worldDir, '/assets', filename)
        await fs.writeFile(dest, buffer)
      }
      // create blueprint and entity
      app.blueprint.id = '$scene' // singleton
      app.blueprint.preload = true
      const blueprint = {
        id: app.blueprint.id,
        data: JSON.stringify(app.blueprint),
        createdAt: now,
        updatedAt: now,
      }
      await db('blueprints').insert(blueprint)
      const entityId = uuid()
      const entity = {
        id: entityId,
        data: JSON.stringify({
          id: entityId,
          type: 'app',
          blueprint: blueprint.id,
          position: [0, 0, 0],
          quaternion: [0, 0, 0, 1],
          scale: [1, 1, 1],
          mover: null,
          uploader: null,
          pinned: false,
          state: {},
        }),
        createdAt: now,
        updatedAt: now,
      }
      await db('entities').insert(entity)
    }
  },
]
