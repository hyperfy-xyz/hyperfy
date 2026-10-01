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

**Tech Stack:** Node.js 22.11.0+, Three.js, PhysX (WASM), Fastify, React 19, esbuild

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/hyperfy-xyz/hyperfy)

## 🧩 Use Cases

- **Virtual Events & Conferences** - Host live gatherings with spatial audio
- **Interactive Showrooms** - Create product displays and demos
- **Social Spaces** - Build community hubs for collaboration
- **Gaming Environments** - Design immersive game worlds
- **Educational Experiences** - Develop interactive learning spaces
- **Creative Showcases** - Display 3D art and interactive installations

## 🚀 Quick Start

### Prerequisites

- Node.js 22.11.0+ (via [nvm](https://github.com/nvm-sh/nvm) or direct install)

### Installation

```bash
# Clone the repository
git clone https://github.com/hyperfy-xyz/hyperfy.git my-world
cd my-world

# Copy example environment settings (and set to your own values)
cp .env.example .env

# Install dependencies
npm install

# Start the development server
npm run dev
```

Now visit `localhost:3000` in your browser to jump in!

### Docker Deployment

For containerized deployment, check [DOCKER.md](DOCKER.md) for detailed instructions.

### World Folder

Every edit you make in the world is saved to your world folder which makes it easy to backup/restore.
A local SQLite db stores all world settings and transforms for apps, and the assets folder includes all uploaded assets.
You can also have multiple world folders and switch between them by changing the `WORLD` environment variable.

## 📚 Documentation & Resources

- **[Community Documentation](https://docs.hyperfy.xyz)** - Comprehensive guides and reference
- **[Website](https://hyperfy.io/)** - Official Hyperfy website
- **[Sandbox](https://play.hyperfy.xyz/)** - Try Hyperfy in your browser
- **[Twitter/X](https://x.com/hyperfy_io)** - Latest updates and announcements

## 📏 Project Structure

```
src/
  core/            - Engine that runs on both client and server
  client/          - React based browser client
  server/          - Fastify HTTP + WebSocket server
  world/           - Built-in assets (eg character animations), default scene app and app collection
  plugins/         - Built-in plugins, listed in hyperfy.config.js (see docs/plugins.md)
docs/              - Documentation and scripting API
```

## 🛠️ Development

### Key Commands

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

## 🚢 Deployment

Build and run a production server with `npm run build && npm start`. Set `JWT_SECRET`, `ADMIN_CODE`, and `PUBLIC_WS_URL` in your `.env` before starting. A reverse proxy (nginx/Caddy) forwarding WebSocket upgrades to port 3000 is recommended for public deployments.

See **[docs/deployment.md](docs/deployment.md)** for full setup instructions, Docker usage, and how to connect the GitHub Pages static preview to your server.

## 🖊️ Contributing

Contributions are welcome! Please check out our [contributing guidelines](CONTRIBUTING.md) and [code of conduct](CODE_OF_CONDUCT.md) before getting started.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a pull request

## 🌱 Project Status

This project is in beta.
Most APIs are stable but there may still be some small breaking changes to apps in the future.
