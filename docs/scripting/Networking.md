# Networking

**See also:** [App API](/docs/scripting/app/App.md) · [World API](/docs/scripting/world/World.md)

Apps in Hyperfy communicate using `app.send`, `app.on`, `app.emit`, and `world.on`.

Apps execute their scripts in every environment, eg on the server and on every client.

The `world.isServer` and `world.isClient` allows scripts to determine what environment they are running in.

* `app.send`: Sends an event to other instances of the same app. When called on a server is sent to all clients, and when called on a client is sent to the server.
* `app.on`: Listens for an event sent from an app (via `app.send`) in its counter-environment (server or clients).
* `app.emit`: Emits an event for any app to listen to, in the same environment it was called from (either a single client or the server).
* `world.on`: Listens for an event emitted from any app (via `app.emit`) in the same environment.

## Example

### App 1

```js
if (world.isServer) {
  app.on('ping', () => {
    console.log('ping heard on server of original app');
    app.emit('cross-app-ping', {});
  });
  world.on('cross-app-pong', () => {
    app.send('end', {});
  });
}

if (world.isClient) {
  app.on('end', () => {
    console.log('full loop ended');
  });
  app.send('ping', {});
}
```

### App 2

```js
if (world.isServer) {
  world.on('cross-app-ping', () => {
    console.log('ping heard on different app');
    app.emit('cross-app-pong', {});
  });
}
```

## Flow

1. App 1 (client) sends ping via `app.send`.
2. App 1 (server) receives ping via `app.on`, emits `cross-app-ping` to other apps.
3. App 2 (server) listens for `cross-app-ping` via `world.on`, emits `cross-app-pong`.
4. App 1 (server) listens for `cross-app-pong` via `world.on`, sends `end` to itself.
5. App 1 (client) receives `end` via `app.on`, completing the loop.
