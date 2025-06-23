# Hyperfy ⚡️

<div align="center">
  <img src="overview.png" alt="Hyperfy Ecosystem" width="100%" />
  <p>
    <strong>Build, deploy, and experience interactive 3D virtual worlds</strong>
  </p>
</div>

## What is Hyperfy?

Hyperfy is an open-source framework for building interactive 3D virtual worlds. It combines a powerful physics engine, networked real-time collaboration, and a component-based application system to create immersive experiences that can be self-hosted or connected to the wider Hyperfy ecosystem.

## 🧬 Key Features

- **Standalone persistent worlds** - Host on your own domain
- **Realtime content creation** - Build directly in-world
- **Interactive app system** - Create dynamic applications with JavaScript
- **Portable avatars** - Connect via Hyperfy for consistent identity
- **Physics-based interactions** - Built on PhysX for realistic simulation
- **WebXR support** - Experience worlds in VR
- **Extensible architecture** - Highly customizable for various use cases

## 🚀 Quick Start

### Prerequisites

- Node.js 22.11.0+ (via [nvm](https://github.com/nvm-sh/nvm) or direct install)

### Installation

```bash
# Clone the repository
git clone https://github.com/hyperfy-xyz/hyperfy.git my-world
cd my-world

# Copy example environment settings
cp .env.example .env

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Docker Deployment

For containerized deployment, check [DOCKER.md](DOCKER.md) for detailed instructions.

## 🧩 Use Cases

- **Virtual Events & Conferences** - Host live gatherings with spatial audio
- **Interactive Showrooms** - Create product displays and demos
- **Social Spaces** - Build community hubs for collaboration
- **Gaming Environments** - Design immersive game worlds
- **Educational Experiences** - Develop interactive learning spaces
- **Creative Showcases** - Display 3D art and interactive installations

## 📦 Using Hyperfy as a Node.js Module

Beyond running a full Hyperfy server, you can integrate Hyperfy's core functionalities into your own Node.js applications by using the official NPM package. This allows you to create and manage Hyperfy worlds, entities, and systems programmatically.

### Installation

To install the Hyperfy Node.js client package, use npm:

```bash
npm install hyperfy
```
*(Note: Ensure the package name `hyperfy` matches the name intended for NPM publication.)*

### Example Usage

Here's a basic example of how to import and use components from the `hyperfy` package:

```javascript
// example.js
import { createNodeClientWorld, System, Node, World } from 'hyperfy';

async function main() {
  // The createNodeClientWorld function initializes a world suitable for server-side/headless operations.
  // It may require specific options depending on your setup (e.g., for PhysX, assets).
  const world = await createNodeClientWorld({
    // Example options (refer to documentation for details):
    // physxWorker: new Worker(new URL('./physx-worker.js', import.meta.url)), // If PhysX is needed
    // assetsDir: './assets', // Path to your assets directory
  });
  
  console.log('Hyperfy World instance created:', world);

  // Example: Define a simple system
  class MySystem extends System {
    start() {
      console.log('MySystem started!');
    }

    update(delta) {
      // Called every frame
    }
  }

  // Register the system with the world
  world.register('mySystem', MySystem);

  // Example: Create and add a node
  const myNode = new Node({ id: 'myCube', name: 'My Cube' });
  myNode.position.set(0, 1, -2); // Set position (Vector3)
  // world.addNode(myNode); // How nodes are added might depend on specific world setup

  // Initialize and start the world (if not auto-started by createNodeClientWorld)
  // await world.init({}); // Pass necessary initialization options
  // world.start();

  console.log('Node created:', myNode.id, myNode.name, myNode.position.x, myNode.position.y, myNode.position.z);

  // To run the world's simulation loop (if applicable for your use case):
  // function gameLoop() {
  //   world.tick(performance.now());
  //   setImmediate(gameLoop); // or requestAnimationFrame if in a context that supports it
  // }
  // gameLoop();
}

main().catch(console.error);
```
This example demonstrates basic setup. Refer to the core module documentation for more in-depth usage of `World`, `Node`, `System`, and other components.

## 📚 Documentation & Resources

- **[Community Documentation](https://hyperfy.how)** - Comprehensive guides and reference
- **[Website](https://hyperfy.io/)** - Official Hyperfy website
- **[Sandbox](https://play.hyperfy.xyz/)** - Try Hyperfy in your browser
- **[Twitter/X](https://x.com/hyperfy_io)** - Latest updates and announcements

## 📏 Project Structure

```
docs/              - Documentation and references
src/
  client/          - Client-side code and components
  core/            - Core systems (physics, networking, entities)
  server/          - Server implementation
CHANGELOG.md       - Version history and changes
```

## 🛠️ Development

### Key Commands

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start

# Clean orphaned assets (experimental)
npm run world:clean

# Viewer only (development)
npm run viewer:dev

# Client only (development)
npm run client:dev

# Linting
npm run lint
npm run lint:fix
```

## 🖊️ Contributing

Contributions are welcome! Please check out our [contributing guidelines](CONTRIBUTING.md) and [code of conduct](CODE_OF_CONDUCT.md) before getting started.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a pull request

### Publishing the Node.js Client Package

The Hyperfy Node.js client is packaged for NPM distribution. Publishing is handled both automatically via GitHub Actions and can be done manually.

#### Automated Publishing (GitHub Releases)

- **Trigger**: New versions of the `hyperfy` NPM package are automatically built and published when a new release is created on the GitHub repository.
- **Workflow**: This process is managed by the `.github/workflows/npm-publish.yml` GitHub Actions workflow.
- **Requirements**: For automated publishing to succeed, the `NPM_TOKEN` secret must be configured in the GitHub repository settings. This token grants the workflow permission to publish to NPM.

#### Manual Publishing

To publish the package manually, follow these steps:

1.  **Ensure Version is Updated**: Before publishing, verify that the `version` field in the main `package.json` is updated to the new version number you intend to release. The build script (`scripts/build-node-client.mjs`) uses this version for the package generated in `dist/npm/`.
2.  **Authenticate with NPM**: You must be logged into NPM on your local machine with an account that has publish permissions for the `hyperfy` package. If you are not logged in, run:
    ```bash
    npm login
    ```
3.  **Run Publish Script**: Execute the following command from the root of the repository:
    ```bash
    npm run publish:node
    ```
    This script will:
    *   Build the Node.js client package into the `dist/npm/` directory.
    *   Change the current directory to `dist/npm/`.
    *   Run `npm publish` from within `dist/npm/`.

**Important**: Always ensure that the package is thoroughly tested and the version number is correct before publishing, whether manually or by creating a GitHub release.

## 🌱 Project Status

This project is still in alpha as we transition all of our [reference platform](https://github.com/hyperfy-xyz/hyperfy-ref) code into fully self hostable worlds.
Most features are already here in this repo but still need to be connected up to work with self hosting in mind.
Note that APIs are highly likely to change during this time.
