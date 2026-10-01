// Plugins are loaded in this order on both the client and the server.
// Each entry is a folder (relative to this file) holding an optional `client.js`
// and/or `server.js`, or `[folder, options]` to pass options to the plugin.
// See docs/plugins.md
export default {
  plugins: ['./src/plugins/webview', './src/plugins/world-info'],
}
