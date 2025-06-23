import { isNumber } from 'lodash-es';
import moment from 'moment';

import type { Blueprint, World } from '../../types/index.js';
import { writePacket } from '../packets.js';
import { Socket } from '../Socket.js';
import { createJWT, verifyJWT } from '../utils-server.js';
import { addRole, hasRole, removeRole, serializeRoles, uuid } from '../utils.js';
import { System } from './System.js';

const SAVE_INTERVAL = parseInt(process.env.SAVE_INTERVAL || '60'); // seconds
const PING_RATE = 1; // seconds
const defaultSpawn = '{ "position": [0, 0, 0], "quaternion": [0, 0, 0, 1] }';

const HEALTH_MAX = 100;

// Type definitions
export interface User {
  id: string;
  name: string;
  avatar: string | null;
  roles: string | string[];
  createdAt: string;
}

export interface ConnectionParams {
  authToken?: string;
  name?: string;
  avatar?: string;
}

export interface SpawnData {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

export interface SaveCounts {
  upsertedBlueprints: number;
  upsertedApps: number;
  deletedApps: number;
}

export interface ServerStats {
  currentCPU: number;
  currentMemory: number;
  maxMemory: number;
}

type QueueItem = [Socket, string, any];

/**
 * Server Network System
 *
 * - runs on the server
 * - provides abstract network methods matching ClientNetwork
 *
 */
export class ServerNetwork extends System {
  id: number;
  ids: number;
  sockets: Map<string, Socket>;
  socketIntervalId: NodeJS.Timeout;
  saveTimerId: NodeJS.Timeout | null;
  dirtyBlueprints: Set<string>;
  dirtyApps: Set<string>;
  isServer: boolean;
  queue: QueueItem[];
  db: any; // Knex database instance
  spawn: SpawnData;

  constructor(world: World) {
    super(world);
    this.id = 0;
    this.ids = -1;
    this.sockets = new Map();
    this.socketIntervalId = setInterval(() => this.checkSockets(), PING_RATE * 1000);
    this.saveTimerId = null;
    this.dirtyBlueprints = new Set();
    this.dirtyApps = new Set();
    this.isServer = true;
    this.queue = [];
    this.spawn = JSON.parse(defaultSpawn);
  }

  async init(options: any): Promise<void> {
    this.db = options.db;
  }

  async start(): Promise<void> {
    // get spawn
    const spawnRow = await this.db('config').where('key', 'spawn').first();
    this.spawn = JSON.parse(spawnRow?.value || defaultSpawn);
    
    // hydrate blueprints
    const blueprints = await this.db('blueprints');
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data);
      (this.world as any).blueprints.add(data, true);
    }
    
    // hydrate entities
    const entities = await this.db('entities');
    for (const entity of entities) {
      const data = JSON.parse(entity.data);
      data.state = {};
      (this.world as any).entities.add(data, true);
    }
    
    // hydrate settings
    const settingsRow = await this.db('config').where('key', 'settings').first();
    try {
      const settings = JSON.parse(settingsRow?.value || '{}');
      (this.world as any).settings.deserialize(settings);
    } catch (err) {
      console.error(err);
    }
    
    // watch settings changes
    (this.world as any).settings.on('change', this.saveSettings);
    
    // queue first save
    if (SAVE_INTERVAL) {
      this.saveTimerId = setTimeout(this.save, SAVE_INTERVAL * 1000);
    }
    
    // Environment model loading is handled by ServerEnvironment.start()
  }

  override preFixedUpdate(): void {
    this.flush();
  }

  send(name: string, data: any, ignoreSocketId?: string): void {
    // console.log('->>>', name, data)
    const packet = writePacket(name, data);
    this.sockets.forEach(socket => {
      if (socket.id === ignoreSocketId) return;
      socket.sendPacket(packet);
    });
  }

  sendTo(socketId: string, name: string, data: any): void {
    const socket = this.sockets.get(socketId);
    socket?.send(name, data);
  }

  checkSockets(): void {
    // see: https://www.npmjs.com/package/ws#how-to-detect-and-close-broken-connections
    const dead: Socket[] = [];
    this.sockets.forEach(socket => {
      if (!socket.alive) {
        dead.push(socket);
      } else {
        socket.ping();
      }
    });
    dead.forEach(socket => socket.disconnect());
  }

  enqueue(socket: Socket, method: string, data: any): void {
    this.queue.push([socket, method, data]);
  }

  flush(): void {
    while (this.queue.length) {
      try {
        const [socket, method, data] = this.queue.shift()!;
        const handler = (this as any)[method];
        if (handler) {
          handler.call(this, socket, data);
        }
      } catch (err) {
        console.error(err);
      }
    }
  }

  getTime(): number {
    return performance.now() / 1000; // seconds
  }

  save = async (): Promise<void> => {
    const counts: SaveCounts = {
      upsertedBlueprints: 0,
      upsertedApps: 0,
      deletedApps: 0,
    };
    const now = moment().toISOString();
    
    // blueprints
    for (const id of this.dirtyBlueprints) {
      const blueprint = (this.world as any).blueprints.get(id);
      if (!blueprint) continue;
      
      try {
        const record = {
          id: blueprint.id,
          data: JSON.stringify(blueprint),
        };
        await this.db('blueprints')
          .insert({ ...record, createdAt: now, updatedAt: now })
          .onConflict('id')
          .merge({ ...record, updatedAt: now });
        counts.upsertedBlueprints++;
        this.dirtyBlueprints.delete(id);
      } catch (err) {
        console.log(`error saving blueprint: ${blueprint.id}`);
        console.error(err);
      }
    }
    
    // app entities
    for (const id of this.dirtyApps) {
      const entity = (this.world as any).entities.get(id);
      if (entity) {
        // it needs creating/updating
        if (entity.data.uploader || entity.data.mover) {
          continue; // ignore while uploading or moving
        }
        try {
          const data = JSON.parse(JSON.stringify(entity.data)); // Deep clone alternative
          data.state = null;
          const record = {
            id: entity.data.id,
            data: JSON.stringify(entity.data),
          };
          await this.db('entities')
            .insert({ ...record, createdAt: now, updatedAt: now })
            .onConflict('id')
            .merge({ ...record, updatedAt: now });
          counts.upsertedApps++;
          this.dirtyApps.delete(id);
        } catch (err) {
          console.log(`error saving entity: ${entity.data.id}`);
          console.error(err);
        }
      } else {
        // it was removed
        await this.db('entities').where('id', id).delete();
        counts.deletedApps++;
        this.dirtyApps.delete(id);
      }
    }
    
    // log
    const didSave = counts.upsertedBlueprints > 0 || counts.upsertedApps > 0 || counts.deletedApps > 0;
    if (didSave) {
      console.log(
        `world saved (${counts.upsertedBlueprints} blueprints, ${counts.upsertedApps} apps, ${counts.deletedApps} apps removed)`
      );
    }
    
    // queue again
    this.saveTimerId = setTimeout(this.save, SAVE_INTERVAL * 1000);
  };

  saveSettings = async (): Promise<void> => {
    const data = (this.world as any).settings.serialize();
    const value = JSON.stringify(data);
    await this.db('config')
      .insert({
        key: 'settings',
        value,
      })
      .onConflict('key')
      .merge({
        value,
      });
  };

  isAdmin(player: any): boolean {
    return hasRole(player.data.roles, 'admin');
  }

  isBuilder(player: any): boolean {
    return (this.world as any).settings.public || this.isAdmin(player);
  }

  async onConnection(ws: any, params: ConnectionParams): Promise<void> {
    try {
      // check player limit
      const playerLimit = (this.world as any).settings.playerLimit;
      if (isNumber(playerLimit) && playerLimit > 0 && this.sockets.size >= playerLimit) {
        const packet = writePacket('kick', 'player_limit');
        ws.send(packet);
        ws.close();
        return;
      }

      // check connection params
      let authToken = params.authToken;
      let name = params.name;
      let avatar = params.avatar;

      // get or create user
      let user: User | undefined;
      if (authToken) {
        try {
          const { userId } = await verifyJWT(authToken);
          user = await this.db('users').where('id', userId).first();
        } catch (err) {
          console.error('failed to read authToken:', authToken);
        }
      }
      if (!user) {
        user = {
          id: uuid(),
          name: 'Anonymous',
          avatar: null,
          roles: '',
          createdAt: moment().toISOString(),
        };
        await this.db('users').insert(user);
        authToken = await createJWT({ userId: user.id });
      }
      
      // Convert roles string to array
      if (typeof user.roles === 'string') {
        user.roles = user.roles.split(',').filter(r => r);
      }

      // disconnect if user already in this world
      if (this.sockets.has(user.id)) {
        const packet = writePacket('kick', 'duplicate_user');
        ws.send(packet);
        ws.close();
        return;
      }

      // if there is no admin code, everyone is a temporary admin (eg for local dev)
      // all roles prefixed with `~` are temporary and not persisted to db
      if (!process.env.ADMIN_CODE) {
        (user.roles as string[]).push('~admin');
      }

      // livekit options
      const livekit = await (this.world as any).livekit?.getPlayerOpts(user.id);

      // create socket
      const socket = new Socket({ id: user.id, ws, network: this });

      // spawn player
      socket.player = (this.world as any).entities.add(
        {
          id: user.id,
          type: 'player',
          position: this.spawn.position.slice(),
          quaternion: this.spawn.quaternion.slice(),
          owner: socket.id, // deprecated, same as userId
          userId: user.id, // deprecated, same as userId
          name: name || user.name,
          health: HEALTH_MAX,
          avatar: user.avatar || (this.world as any).settings.avatar?.url || 'asset://avatar.vrm',
          sessionAvatar: avatar || null,
          roles: user.roles,
        },
        true
      );

      // send snapshot
      socket.send('snapshot', {
        id: socket.id,
        serverTime: performance.now(),
        assetsUrl: process.env.PUBLIC_ASSETS_URL,
        apiUrl: process.env.PUBLIC_API_URL,
        maxUploadSize: process.env.PUBLIC_MAX_UPLOAD_SIZE,
        collections: (this.world as any).collections.serialize(),
        settings: (this.world as any).settings.serialize(),
        chat: (this.world as any).chat.serialize(),
        blueprints: (this.world as any).blueprints.serialize(),
        entities: (this.world as any).entities.serialize(),
        livekit,
        authToken,
      });

      this.sockets.set(socket.id, socket);

      // enter events on the server are sent after the snapshot.
      // on the client these are sent during PlayerRemote.js entity instantiation!
      (this.world as any).events.emit('enter', { playerId: socket.player.data.id });
    } catch (err) {
      console.error(err);
    }
  }

  onChatAdded = async (socket: Socket, msg: any): Promise<void> => {
    (this.world as any).chat.add(msg, false);
    this.send('chatAdded', msg, socket.id);
  };

  onCommand = async (socket: Socket, args: string[]): Promise<void> => {
    // TODO: check for spoofed messages, permissions/roles etc
    // handle slash commands
    const player = socket.player;
    const playerId = player.data.id;
    const [cmd, arg1, arg2] = args;
    
    // become admin command
    if (cmd === 'admin') {
      const code = arg1;
      if (process.env.ADMIN_CODE && process.env.ADMIN_CODE === code) {
        const id = player.data.id;
        const userId = player.data.userId;
        const roles = player.data.roles;
        const granting = !hasRole(roles, 'admin');
        if (granting) {
          addRole(roles, 'admin');
        } else {
          removeRole(roles, 'admin');
        }
        player.modify({ roles });
        this.send('entityModified', { id, roles });
        socket.send('chatAdded', {
          id: uuid(),
          from: null,
          fromId: null,
          body: granting ? 'Admin granted!' : 'Admin revoked!',
          createdAt: moment().toISOString(),
        });
        await this.db('users')
          .where('id', userId)
          .update({ roles: serializeRoles(roles) });
      }
    }
    
    if (cmd === 'name') {
      const name = arg1;
      if (name) {
        const id = player.data.id;
        const userId = player.data.userId;
        player.data.name = name;
        player.modify({ name });
        this.send('entityModified', { id, name });
        socket.send('chatAdded', {
          id: uuid(),
          from: null,
          fromId: null,
          body: `Name set to ${name}!`,
          createdAt: moment().toISOString(),
        });
        await this.db('users').where('id', userId).update({ name });
      }
    }
    
    if (cmd === 'spawn') {
      const op = arg1;
      this.onSpawnModified(socket, op);
    }
    
    if (cmd === 'chat') {
      const op = arg1;
      if (op === 'clear' && this.isBuilder(socket.player)) {
        (this.world as any).chat.clear(true);
      }
    }
    
    if (cmd === 'server') {
      const op = arg1;
      if (op === 'stats') {
        const send = (body: string) => {
          socket.send('chatAdded', {
            id: uuid(),
            from: null,
            fromId: null,
            body,
            createdAt: moment().toISOString(),
          });
        };
        const stats: ServerStats = await (this.world as any).monitor?.getStats();
        send(`CPU: ${stats.currentCPU.toFixed(3)}%`);
        send(
          `Memory: ${stats.currentMemory} / ${stats.maxMemory} MB (${((stats.currentMemory / stats.maxMemory) * 100).toFixed(1)}%)`
        );
      }
    }
    
    // emit event for all except admin
    if (cmd !== 'admin') {
      (this.world as any).events.emit('command', { playerId, args });
    }
  };

  onBlueprintAdded = (socket: Socket, blueprint: Blueprint): void => {
    if (!this.isBuilder(socket.player)) {
      return console.error('player attempted to add blueprint without builder permission');
    }
    (this.world as any).blueprints.add(blueprint);
    this.send('blueprintAdded', blueprint, socket.id);
    this.dirtyBlueprints.add(blueprint.id);
  };

  onBlueprintModified = (socket: Socket, data: Partial<Blueprint> & { id: string; version: number }): void => {
    if (!this.isBuilder(socket.player)) {
      return console.error('player attempted to modify blueprint without builder permission');
    }
    const blueprint = (this.world as any).blueprints.get(data.id);
    // if new version is greater than current version, allow it
    if (data.version > blueprint.version) {
      (this.world as any).blueprints.modify(data);
      this.send('blueprintModified', data, socket.id);
      this.dirtyBlueprints.add(data.id);
    }
    // otherwise, send a revert back to client, because someone else modified before them
    else {
      socket.send('blueprintModified', blueprint);
    }
  };

  onEntityAdded = (socket: Socket, data: any): void => {
    if (!this.isBuilder(socket.player)) {
      return console.error('player attempted to add entity without builder permission');
    }
    const entity = (this.world as any).entities.add(data);
    this.send('entityAdded', data, socket.id);
    if (entity.isApp) this.dirtyApps.add(entity.data.id);
  };

  onEntityModified = async (socket: Socket, data: any): Promise<void> => {
    const entity = (this.world as any).entities.get(data.id);
    if (!entity) return console.error('onEntityModified: no entity found', data);
    entity.modify(data);
    this.send('entityModified', data, socket.id);
    if (entity.isApp) {
      // mark for saving
      this.dirtyApps.add(entity.data.id);
    }
    if (entity.isPlayer) {
      // persist player name and avatar changes
      const changes: any = {};
      let changed = false;
      if (data.hasOwnProperty('name')) {
        changes.name = data.name;
        changed = true;
      }
      if (data.hasOwnProperty('avatar')) {
        changes.avatar = data.avatar;
        changed = true;
      }
      if (changed) {
        await this.db('users').where('id', entity.data.userId).update(changes);
      }
    }
  };

  onEntityEvent = (socket: Socket, event: [string, number, string, any]): void => {
    const [id, version, name, data] = event;
    const entity = (this.world as any).entities.get(id);
    entity?.onEvent(version, name, data, socket.id);
  };

  onEntityRemoved = (socket: Socket, id: string): void => {
    if (!this.isBuilder(socket.player)) {
      return console.error('player attempted to remove entity without builder permission');
    }
    const entity = (this.world as any).entities.get(id);
    (this.world as any).entities.remove(id);
    this.send('entityRemoved', id, socket.id);
    if (entity?.isApp) this.dirtyApps.add(id);
  };

  onSettingsModified = (socket: Socket, data: { key: string; value: any }): void => {
    if (!this.isBuilder(socket.player)) {
      return console.error('player attempted to modify settings without builder permission');
    }
    (this.world as any).settings.set(data.key, data.value);
    this.send('settingsModified', data, socket.id);
  };

  onSpawnModified = async (socket: Socket, op: string): Promise<void> => {
    if (!this.isBuilder(socket.player)) {
      return console.error('player attempted to modify spawn without builder permission');
    }
    const player = socket.player;
    if (op === 'set') {
      this.spawn = { 
        position: player.data.position.slice() as [number, number, number], 
        quaternion: player.data.quaternion.slice() as [number, number, number, number] 
      };
    } else if (op === 'clear') {
      this.spawn = { position: [0, 0, 0], quaternion: [0, 0, 0, 1] };
    } else {
      return;
    }
    const data = JSON.stringify(this.spawn);
    await this.db('config')
      .insert({
        key: 'spawn',
        value: data,
      })
      .onConflict('key')
      .merge({
        value: data,
      });
    socket.send('chatAdded', {
      id: uuid(),
      from: null,
      fromId: null,
      body: op === 'set' ? 'Spawn updated' : 'Spawn cleared',
      createdAt: moment().toISOString(),
    });
  };

  onPlayerTeleport = (socket: Socket, data: { networkId: string; [key: string]: any }): void => {
    this.sendTo(data.networkId, 'playerTeleport', data);
  };

  onPlayerPush = (socket: Socket, data: { networkId: string; [key: string]: any }): void => {
    this.sendTo(data.networkId, 'playerPush', data);
  };

  onPlayerSessionAvatar = (socket: Socket, data: { networkId: string; avatar: string }): void => {
    this.sendTo(data.networkId, 'playerSessionAvatar', data.avatar);
  };

  onPing = (socket: Socket, time: number): void => {
    socket.send('pong', time);
  };

  onDisconnect = (socket: Socket, code?: number): void => {
    socket.player?.destroy(true);
    this.sockets.delete(socket.id);
  };

  override destroy(): void {
    if (this.socketIntervalId) {
      clearInterval(this.socketIntervalId);
    }
    if (this.saveTimerId) {
      clearTimeout(this.saveTimerId);
    }
    this.sockets.forEach(socket => socket.disconnect());
    this.sockets.clear();
  }
} 