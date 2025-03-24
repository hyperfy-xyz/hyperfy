# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

## [v0.9.0]

### Added
- core: standalone viewer/clients
- apps: add world.getPlayers() to list all players in the world
- apps: screen-space UI 
- core: add player health
- apps: support world.overlapSphere queries
- core: player to player collision (optional, disabled by default)
- apps: player.push(force)
- core: support ctrl+z to undo added, moved and removed apps
- core: build mode right click with mouse to inspect
- apps: new "buttons" prop
- apps: app.sendTo(playerId, name, data) available on server
- apps: node.children array of all child nodes
- apps: uiimage.src support asset urls from props
- apps: emit an app.on('destroy', cb) event that is run right before an app is destroyed/restarted
- apps: add player.isAdmin for securely checking if a player is an admin

### Changed
- apps: support webp image props
- infra: pipe all client variables through initial server snapshot
- core: preload local avatar and movement emotes before entering the world
- apps: ui borderRadius use arcs instead of quadratic curves
- apps: player effects moved to player.applyEffect (BREAKING CHANGE)
- core: use more memory efficient app proxies
- core: support custom app runtime method injection
- core: show red reticle when in build mode for clarity
- apps: unify player.id/userId/networkId etc as player.id

### Fixed
- core: avatar feet too far above ground
- core: fix esm module bundling
- apps: anchors positions behind by one frame
- apps: ui canvas using incorrect color space
- apps: ensure control.camera initial values are accurate
- apps: exporting app with emojis in props broken
- apps: ui pointer events were not accurate
- apps: ensure player enter event is emitted after they receive snapshot
- apps: ui gap value not correctly multiplied by resolution

## [v0.8.1]

### Fixed
- apps: effects cancel bug

## [v0.8.0]

### Added
- apps: stable effects system via control

### Changed
- core: simplified build controls and actions displayed
- core: nametags and chat bubbles now track player head
- core: remove glb extension from app names (via drag-n-drop)

### Fixed
- core: fix scaling things to zero causing octree issues
- core: remove external cdn deps (they're unreliable)
- core: preload rubik font before nametags draw
- apps: release control when app unmounts
- apps: prevent app pointer event errors bubbling up to engine

## [0.7.1]

### Fixed
- core: fix worlds not launching on iOS/safari

## [0.7.0]

### Added
- core: epic new build-mode controls
- core: flying in build-mode
- core: double-jump in normal-mode
- core: initial WebXR support
- apps: dropdown prop
- apps: new "pin" option to prevent accidentally moving something
- apps: support for LODs
- apps: new "unique" toggle that creates unlinked duplicates by default
- apps: sky node sun color property
- core: new admin apps list to help find apps, improve performance, etc
- core: new device setting panel to change shadows, resolution, postprocessing, volume etc
- apps: add fog support to sky node
- apps: add delete button to app inspect window
- apps: world.raycast() support
- apps: support for borderWidth and borderColor on `ui` and `uiview` nodes
- apps: player effects (anchor, emote, snare, freeze, duration, cancellable)
- apps: support reading player bone transforms for attachments
- 

### Changed
- core: improved GUI, chat, actions and app inspector design
- core: reduce z-fighting at long distance
- core: apps drop rotated 180 degrees for consistency with 3D design tools
- apps: set metadata name to initial glb file name
- core: crosshair now changes color depending on its background for high visibility
- core: improve anisotropy for viewing textures at an angle

### Fixed
- apps: download not exporting metadata image
- docs: add missing `num` utility for generating random numbers
- core: code pane sometimes shrinks to 1px in size
- core: when dropping a glb, it will correctly snap to an initial 5deg rotation
- core: subsequent model button presses not working in app inspector
- core: fix DOM-related memory leak 
- core: fix artifial 2s delay on file uploads

## [0.6.0]

### Added
- apps: audio node and audio file prop
- core: camera adjusts to avatar height
- apps: support mesh.material.emissiveIntensity for bloom control
- apps: official custom props + configure and docs
- apps: support Date.now()
- core: support downloading apps as .hyp files
- core: support drag and drop .hyp files
- core: support app metadata (image, name, author, url, desc)
- apps: new number field
- apps: support snap points and embedded snap points in glbs
- core: support drag and drop urls from another website (glbs, hyps etc)

### Changed
- core: reduce docker image size + provide prebuilt images
- apps: props are now a global in scripts
- apps: support app.create(name, props) syntax
- core: unified node props 
- core: upgrade to three@0.173.0
- core: show chat message when dropping a file without permission
- core: lock pointer when raising/lowering apps while holding shift
- core: make default grass environment much much larger
- core: show grab cursor while moving apps

### Fixed
- core: fix crashes caused by undefined blueprint props
- apps: fix removing app configure not updating inspect window
- apps: ui not updated in octree after moving
- apps: fix crash due to props not being set up
- core: dont show context wheel when app has no visible actions
- core: support castShadow/receiveShadow props on imported glbs
- core: fix avatars not unmounting correctly causing memory leak
- core: fix big audio memory issue + firefox not working
- 

## [0.5.0]

### Added
- apps: world.getPlayer(id)
- apps: avatar.height property
- apps: new `nametag` node 
- core: player nametags
- core: app preload option + overlay
- apps: sky node for controlling skybox image, hdr, sunDirection and sunIntensity
- apps: rigidbody.sleeping property
- apps: all nodes including ui now suppot onPointerEnter, onPointerLeave, onPointerDown, onPointerUp events
- apps: player.teleport(position, rotationY)
- core: /status endpoint
- apps: uiimage node
- apps: uv scrolling via mesh.material.textureX|textureY values
- apps: emitting events to other apps via app.emit(name, data)
- core: `/spawn set` and `/spawn clear` commands for admins to change spawn
- core: generate player colliders on the server to track contacts/triggers
- apps: world.getTime() returns server time, even on client
- apps: support node.clone(recursive)
- core: display loading overlay while preloading apps when entering world

### Changed
- core: `vrm` node refactored to `avatar` node, to match types instead of files
- core: improved memory efficient for garbage collecting glbs

### Fixed
- core: fixed server tick rate
- core: cache bust env.js file so browsers don't fetch stale envs
- core: inspecting something while already inspecting properly updates pane
- core: general ui node improvements
- core: prevent setting player name to empty string
- core: physics kinematic movement
- core: trigger colliders crashing world
- core: trimesh colliders crashing world
- apps: scaling nodes not being tracked
- apps: uitext.value crash when not a string
- apps: uitext height layout incorrect for lineHeight
- core: shadow colors and weird artifacts

## [0.4.0]

### Added
- Expose fetch to app runtime
- Add UI, UIView and UIText nodes
- Add app.uuid() utility
- Add app.getTimestamp(format?) utility
- Add app.getTime() utility (uses performance.now)
- Allow apps to post to chat
- Support VRM drag and drop, to place or equip
- Add ability to run multiple worlds and switch using WORLD env

### Changed
- New pane improvements
- Update @pixiv/three-vrm to latest
- Support dynamic environment variables for containerized workflows

### Fixed
- Fix various edge cases where scripts can crash
- Fix node proxy mechanism not working
- Disabled VRM loading on server (affects vrm's renamed to glb)
- Properly abort all in-flight fetch requests an app is making when it rebuilds
- Prevent app async unhandled exceptions bubbling up to a full world crash (see lockdown)
- Fixed camera insanity when loading into the world

## [0.3.0]

### Added
- Environment variable to limit model upload size
- Node.traverse(callback)
- Ability to disable world saving completely
- Initial app networking
- Temporary skybox
- Re-enabled stats via /stats chat command
- Let players know when they are disconnected from the world
- Add /health endpoint
- Action node for interactive apps
- Script to clean up orphaned blueprints/files in a world (npm run world:clean) [experimental]
- Expose Collider.convex to script runtime
- Expose LOD.insert to script runtime
- Initial docs!

### Changed
- Use "geometry" type for Mesh and Collider nodes (instead of "custom")
- Enter and Leave world events are now a player object instead of just the networkId

### Fixed
- Production source-maps issue
- Errors using geometry with morph targets
- Server crash attempting to load an asset that does not exist
- World event unhandled errors

## [0.2.0] - 2025-01-14

### Added
- Docker support for local development and deployment
- ESLint and Prettier configuration
- Contribution guidelines and templates
- Sync with upstream documentation
- ESLint and Prettier configuration for component development
- Docker deployment documentation
- Upstream sync documentation and procedures
- Development environment standardization
- Docker configuration for production deployment
- Multi-stage build optimization
- Volume mounting for assets and source code

### Changed
- Updated development dependencies
- Improved code formatting rules
- Enhanced documentation structure
- Updated ESLint rules and ignored patterns
- Restructured development dependencies
- Enhanced Docker configuration
- Optimized Docker image size using Alpine base
- Enhanced container environment configuration

### Fixed
- ESLint configuration for ESM compatibility
- Build process for Docker environments
- ESLint compatibility with ESM modules
- Development environment setup process
- Docker build process for Node.js 22
- Volume permissions for assets directory

## [0.1.0] - 2025-01-14

### Added
- Initial fork from Hyperfy
- Basic project structure
- Core functionality from original project

[Unreleased]: https://github.com/hyperfy-xyz/hyperfy/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/hyperfy-xyz/hyperfy/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/hyperfy-xyz/hyperfy/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/hyperfy-xyz/hyperfy/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/hyperfy-xyz/hyperfy/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/hyperfy-xyz/hyperfy/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/hyperfy-xyz/hyperfy/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/hyperfy-xyz/hyperfy/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/hyperfy-xyz/hyperfy/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/hyperfy-xyz/hyperfy/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/hyperfy-xyz/hyperfy/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/hyperfy-xyz/hyperfy/releases/tag/v0.1.0 