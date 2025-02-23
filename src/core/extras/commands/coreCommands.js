import { addRole, hasRole, serializeRoles, uuid } from '../../utils'
import moment from 'moment'

export async function becomeAdmin(world, server, socket, adminCode) {
    if (adminCode !== process.env.ADMIN_CODE || !process.env.ADMIN_CODE) return 0

    const player = socket.player
    const id = player.data.id;
    const userId = player.data.userId
    const user = player.data

    if (hasRole(user.roles, 'admin')) {
        return socket.send('chatAdded', {
            id: uuid(),
            from: null,
            fromId: null,
            body: 'You are already an admin',
            createdAt: moment().toISOString()
        })
    }

    addRole(user.roles, 'admin')
    const roles = user.roles;
    player.modify({ roles })
    server.send('entityModified', { id, roles })

    socket.send('chatAdded', {
        id: uuid(),
        from: null,
        fromId: null,
        body: 'Admin granted!',
        createdAd: moment().toISOString()
    })

    await server.db('users')
        .where('id', userId)
        .update( { roles: serializeRoles(roles) })
}

export async function updateUsersName(world, server, socket, name) {
    if (!name) return

    const player = socket.player
    const id = player.data.id
    const userId = player.data.userId

    player.data.name = name
    player.modify({ name })
    server.send('entityModified', {id, name })

    socket.send('chatAdded', {
        id: uuid(),
        from: null,
        fromId: null,
        body: `Name set to ${name}!`,
        createdAt: moment().toISOString()
    })

    await server.db('users')
        .where('id', userId)
        .update({ name })
}

export async function setWorldSpawn(world, server, socket, action, arg2) {

    const player = socket.player;

    if (action === 'set') {
        server.spawn = { position: player.data.position.slice(), quaternion: player.data.quaternion.slice() }
    } else if (action === 'clear') {
        server.spawn = { position: [0, 0, 0], quaternion: [0, 0, 0, 1] }
    } else {
        return
    }

    const data = JSON.stringify(server.spawn)

    await server.db('config')
        .insert({
            key: 'spawn',
            value: data
        })
        .onConflict('key')
        .merge({
            value: data
        })
}
