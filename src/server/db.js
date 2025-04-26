import Knex from 'knex'
import moment from 'moment'

let db

export async function getDB(path) {
  if (!db) {
    db = Knex({
      client: 'better-sqlite3',
      connection: {
        filename: path,
      },
      useNullAsDefault: true,
    })
    await migrate(db)
  }
  return db
}

async function migrate(db) {
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
    await migrations[i](db)
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
]
