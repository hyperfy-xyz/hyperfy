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

## WebSockets

Scripts can connect to outside services over WebSockets, but only when the world owner allows it. List the allowed origins in `PUBLIC_SCRIPT_WEBSOCKET_ORIGINS`, comma separated:

```
PUBLIC_SCRIPT_WEBSOCKET_ORIGINS=wss://api.example.com,wss://live.example.com
```

When it is unset (the default), `WebSocket` is not defined in scripts. When it is set, scripts on the server and on clients get a `WebSocket` that can only open `ws://` or `wss://` URLs on those origins; any other URL throws.

```js
const ws = new WebSocket('wss://api.example.com/feed')
ws.onopen = () => ws.send('hello')
ws.onmessage = e => console.log('got', e.data)
ws.onclose = e => console.log('closed', e.code)
```

The socket supports `send(data)`, `close(code, reason)`, `readyState`, `url`, `protocol`, and the `onopen`, `onmessage`, `onclose` and `onerror` handlers. Binary messages arrive as an `ArrayBuffer`. Every socket an app opens is closed when the app is rebuilt or removed.
