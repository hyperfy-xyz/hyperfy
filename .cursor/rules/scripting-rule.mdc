---
description: rules for creating scripts for the hyperfy engine
globs: 
alwaysApply: false
---
# Overview

Hyperfy is a web-based multiplayer collaborative world engine for building 3D games and experiences accessible in the browser.
Admins of a world can drag and drop glb models into the world in realtime and move them around etc.
When dropping a glb into the world, it becomes an "app".
Each app is comprised of a glb model, and optional script, and any number of additional config/assets that can be provided through props.
Every single thing in a world is an app.
Each script attached to an app is written in javascript.
Apps all run inside an isolated runtime environment with different globals to the ones web developers generally find when making websites.
Scripts execute on both the server and the clients.
When the server boots up, the app scripts execute first on the server, and then when clients connect the scripts run after they receive the initial snapshot.
When scripts are edited on the client by a builder, the app script changes execute instantly on the client first, and then the server is notified to reboot with the new script.
Each app script has access to all of the nodes that make up the glb model and they can move, clone or remove any part of it using code.
If in blender for example, your mesh is named "Sword" then in a script you can get a handle of this mesh node using `app.get('Sword')`.

## The `world` global

The app runtime exposes a `world` global variable, providing access to info about the world itself or performing world related functions

`world.isServer`
- a boolean that is true if the code currently executing is on the server

`world.isClient`
- a boolean that is true if the code currently executing is on a client

`world.add(node)`
- adds a node into world-space

`world.remove(node)`
- removes a node from world space

`world.attach(node)`
- attaches a node into world-space, maintaining its current world transform

`world.on(event, callback)`
- listens to world events emitted by other apps, allows inter-app communication
- applies only to its own context, eg if running on the server it will only listen to events emitted by other apps on the server

`world.off(event, callback)`
- cancel a world event listener

`world.getTime()`
- returns the number of seconds since the server booted up.
- this is also usable on the client which synchronizes time with the server automatically.

`world.chat(msg, broadcast)`
- posts a message in the local chat, with the option to broadcast to all other clients and the server
- TODO: msg object needs details here

`world.getPlayer(playerId)`
- returns a handle to a player
- if playerId is not specified, it returns the local player if running on a client

`world.getPlayers()`
- returns an array of all players currently in the world

`world.createLayerMask(...layers)`
- create a collision layer mask for raycasts etc
- TODO: provide more details

`world.raycast(origin, direction, maxDistance, layerMask)`
- performs a physics raycast and returns the first hit, if any.
- hit object = { tag: String, playerId: String }

`world.get(key)`
- returns value from key-value storage
- only works on the server

`world.set(key, value)`
- sets a value in key-value storage
- only works on the server

## The `app` global

The app runtime exposes an `app` global variable that provides access to the root app node itself and also a few additional methods for the app itself

`app.instanceId`
- a unique id for an instance of this app

`app.state`
- the state object for this app.
- when clients connect to the world, the current value of `app.state` is sent to the client and available when the client script runs.
- that is all it does, it does not automatically sync one or both ways when changed, but it can be used to keep state up to date as server events are received.

`app.props`
- TODO: need to describe props

`app.on(event, callback)`
- listens to app events from itself in other contexts.
- on the client, this will be called when the server calls `app.send(event, data)`
- on the server, this will be called when a client calls `app.send(event, data)`
- to subscribe to the update event, we can do `app.on('update' (delta) => {})`

`app.off(event, callback)`
- removes a previously bound listener

`app.send(event, data)`
- sends event to the same app running on its opposite context
- if called on the client, it will be sent to the server
- if called on the server, it will be sent to all clients

`app.sendTo(playerId, event, data)`
- same as `app.send` but targets a specific player client
- can only be used on the server

`app.emit(event, data)`
- emits an event from this app to the world, for other apps that might be listening
- should generally be namedspaced (eg `mything:myevent`) to avoid inadvertent collisions
- if called on a client, only apps on that client will be able to receive the event
- if called on the server, only apps on that server will be able to receive the event

`app.get(name)`
- returns a specifc node somewhere in the hierarchy
- nodes can be meshes, rigidbodies, colliders, and many more

`app.create(name, data)`
- creates a node such as an action, ui, etc
- nodes can then be added to the world (`world.add(node)`) or the local app space (`app.add(node)`) or another node (`otherNode.add(node)`)
- TODO: provide more info

`app.control(options)`
- creates a control handle for reading and writing inputs, camera transforms, etc
- TODO: provide more info

`app.configure(fields)`
- exposes prop inputs in the app inspector that allow non-developers to configure your app
- the values of the props are read in-script from the `props` global object
- TODO: explain each field type, when logic, keys etc

## The `node` base class

Every single node in the world (mesh, collider, etc) inherits the node base class and its methods and properties.

`node.id`
- a string id of the node
- this cannot be changed once set, eg a glb will have these that match blender object names, and you can set this once when creating a node with `app.create('mesh', { id: 'myId' })` if needed
- if not provided when creating a node, it will be given a unique one automatically

`node.name`
- the node type, eg `mesh` or `action` or `rigidbody` etc

`node.position`
- a `Vector3` representing the local position of the node

`node.quaternion`
- a `Quaternion` representing the the local quaternion of the node
- changing this automatically syncs with `node.rotation`

`node.rotation`
- a `Euler` representing the the local rotation of the node
- changing this automatically syncs with `node.quaternion`

`node.scale`
- a `Vector3` representing local scale of the node

`node.matrixWorld`
- a `Matrix4` for world transform of the node
- this is automatically updated each frame if the local transform of this or any parents change

`node.active`
- whether the node is active or not
- when not active, it as if its not even in the world, including all of its children

`node.parent`
- the parent node if any

`node.children`
- an array of all child nodes

`node.add(childNode)`
- adds a node as a child of this one

`node.remove(childNode)`
- removes a node from a child of this one

`node.clone(recursive)`
- clones the node so that it can be re-used
- must then be added to the world, app or another node to be active in the world

`node.onPointerEnter`
- can be set to a function to be notified when the player reticle is pointing at this node/mesh etc

`node.onPointerLeave`
- can be set to a function to be notified when the player reticle leaves pointing at this node/mesh etc

`node.onPointerDown`
- can be set to a function to be notified when the player reticle clicks on this node/mesh etc

`node.onPointerUp`
- can be set to a function to be notified when the player reticle released click on this node/mesh etc

`node.cursor`
- changes the cursor in pointer mode when hovering over this node, useful for ui etc eg `pointer`