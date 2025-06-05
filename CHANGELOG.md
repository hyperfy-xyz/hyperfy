# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

## [v0.13.0]

### Added
- core: new loading screen and world image settings
- core: open graph tag support + add to homescreen
- core: vr controller interaction button support
- core: experimental terrain (splatmaps) support
- core: show reconnect button when disconnected
- apps: support control.hideReticle() useful for vehicles etc

### Changed
- core: reduce default shadow quality on mobile/vr devices
- core: Z toggles all UI including apps
- core: reduced docker image size using multi-stage builds
- core: skysphere only move with player horizontally, not vertically
- core: increase mobile joystick threshold for running
- core: improved vr billboarding to look more natural
- core: update action button ui to match core ui
- core: only apply emote throttling to remote players, local players now 60fps
- core: set vr target framerate to 72Hz
- core: more accurately detect touch devices
- apps: mesh.visible disables render but maintains raycastability

### Fixed
- core: reduce minimum vrm height to support smaller avatars
- apps: skinnedmesh bone handle remounting

## [v0.12.0]

### Added
- core: add toggle to completely disable an app but keep it in the world
- core: add scale gizmo (3)
- core: add shift to scale in build mode
- core: add ui v3
- core: add initial app collection
- core: node-client support for running the client in a nodejs environment
- apps: experimental app.keepActive=true to keep apps executing while being moved
- apps: add audio.setPlaybackRate to control pitch
- apps: add image node
- apps: add `pivot` option to video node
- apps: add video.onLoad, video.loading, video.time, video.duration properties
- apps: inject `prng` utility
- apps: add material.fog option to allow meshes to opt-out of being effected by fog (eg skyboxes)
- apps: add skinnedmesh.getBone(name) with ability to read AND write bone transforms
- apps: add lod.scaleAware property (enabled by default)
- misc: simple blender addon

### Changed
- core: improve audio smoothing, less crackle
- core: cache and reuse physics materials, reduces memory usage
- core: reinstate production builds, shave off ~5MB of bundle size
- core: move stats to top right of screen
- apps: support bigStep option on number props (shift + up/down in input)

### Fixed
- core: correct video color space
- core: prevent chat opening up when hitting enter in an app prop input
- core: fix edge case where colliders cannot be generated for some meshes
- core: fix shift-click file props to download not working
- core: fix ctrl+R to reload the page duplicating objects when in build mode
- core: remove docker exit 0 hack and correctly exit during builds
- apps: fix initial lod not being set correctly when cloning

## [v0.11.0]

### Added
- core: add title and description fields to world menu to change tab title and shared links
- core: add fullscreen button for support devices
- core: add player limit option to world menu
- core: voice chat and speaking emotes while using voice chat
- core: improve mobile UI with jump and interact buttons
- core: improve billboarding for chat bubbles, nametags, particles etc across desktop, mobile and vr
- apps: support for skinned meshes and skinned mesh animations
- apps: support for listening to slash commands on server and client
- apps: add video node
- apps: add screensharing support to video node
- apps: add particles node
- apps: add ui scaler option to keep ui screen-sized while in world-space

### Changed
- core: limit camera zoom to 8m
- core: upgraded to latest react and added node polyfills
- core: when anchored, player capsule physics are now disabled
- core: fix audio not unlocks on meta quest 3
- core: decrease default shadow setting on mobile from high to medium

### Fixed
- core: fix environment model not loading/simulating on server
- core: fix rigidbody center of mass, linear velocity and angular velocity not working
- core: fix highspeed anchor jittering
- core: fix geometry used for both convex and non-convex not working
- apps: ui remount not triggering redraw
- apps: player enter event happened before you could access the player details

## [v0.10.0]

### Added
- core: new streamlined user interface
- core: grayscale overlay when disconnected
- core: new world menu for admins to change world environment, default avatar, spawns etc
- core: new gizmo for fine-grained builder controls
- apps: controller support for tag, contacts and layers
- apps: support for interleaved buffer geometry
- apps: geometry handles
- apps: Math globals
- apps: player.local boolean
- apps: ui margin and padding per side
- apps: apps can now redirect to a url or open in a new tab 
- apps: ability to load models from a url on the fly
- apps: node.get(id) to find matches inside any node hierarchy
- core: new mod/plugin hooks (experimental)
- core: added ping time to /stats

### Changed
- apps: uiimage node stability and docs
- apps: ui absolue positioning and flex additions

### Fixed
- apps: ui gap size not correct
- core: vr button not working
- core: octree issues with tiny objects, improves memory usage
- core: fix audio unmount issues
- core: equipping one vrm while one is already uploading (race condition)

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

[Unreleased]: https://github.com/hyperfy-xyz/hyperfy/compare/v0.13.0...HEAD
[0.13.0]: https://github.com/hyperfy-xyz/hyperfy/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/hyperfy-xyz/hyperfy/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/hyperfy-xyz/hyperfy/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/hyperfy-xyz/hyperfy/compare/v0.9.0...v0.10.0
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