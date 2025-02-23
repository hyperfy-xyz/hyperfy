import { hasRole, uuid } from '../../utils';
import moment from 'moment';

export class CommandHandler {
    constructor(world, server, perm_tiers) {
        this.world = world;
        this.server = server;
        this.perm_tiers = perm_tiers; // Permission tiers map { role: number }
        this.commands = new Map();
    }

    registerCommand(name, callback, isStatic, min_perm_level, isServer) {
        const command = this.commands.get(name);
        if (command && command.isStatic) return 0;

        this.commands.set(name, {
            callback: callback,
            isStatic: isStatic,
            isServer: isServer,
            min_perm_level: min_perm_level
        });

        return 1;
    }

    unregisterCommand(name) {
        const command = this.commands.get(name);
        if (!command || command.isStatic) return 0;

        this.commands.delete(name);
        return 1;
    }

    getUserPermissionLevel(user) {
        if (!user || !user.roles) return 0; // Default to lowest level

        let maxPermLevel = 0;

        for (const [role, level] of Object.entries(this.perm_tiers)) {
            if (hasRole(user.roles, role) && level > maxPermLevel) {
                maxPermLevel = level;
            }
        }

        return maxPermLevel;
    }

    hasPermission(socket, min_perm_level) {
        const player = socket.player
        const user = player.data.user

        const user_perm_level = this.getUserPermissionLevel(user);
        const required_perm_level = this.perm_tiers[min_perm_level] ?? Infinity;

        return user_perm_level >= required_perm_level;
    }

    callCommand(name, socket, ...args) {
        const command = this.commands.get(name);
        if (!command) return 0;

        if (!this.hasPermission(socket, command.min_perm_level)) {
            socket.send('chatAdded', {
                id: uuid(),
                from: null,
                fromId: null,
                body: 'Insufficient permissions to use this command.',
                createdAt: moment().toISOString()
            });
            return 0;
        }

       return command.callback(this.world, this.server, socket, ...args);
    }
}
