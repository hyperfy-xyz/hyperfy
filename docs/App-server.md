### Prerequisites

- Run your world with client dev features enabled: set env `PUBLIC_DEV_SERVER=true` when starting the client app.
- You must be an admin in the world to access Dev Tools and link apps.

---

### Start the local app server

```bash
npx @drama.haus/app-server           # starts on http://localhost:8080 (WS on ws://localhost:8080/)
```

Notes
- Hot reload is ON by default. Disable with `--no-hot-reload` or `HOT_RELOAD=false`.
- Health check: `GET http://localhost:8080/health`.

---

### Link an app from your world (one‑time per app)

1) In your running world, open the Sidebar → Dev Tools (gear icon). It should show Connected if the server is up on port 8080. You can change the port and reconnect from this pane.
2) Select an app in the Apps pane, open its inspector, and click the Link (chain) icon. The client will:
   - Create `apps/<appName>/` locally on the dev server if missing
   - Upload current script and metadata
   - Save minimal overrides to `apps/<appName>/links.json`

After linking, the app is associated with your world URL and eligible for hot reload.

---

### Common workflow

1) Edit your local file on disk: `apps/<appName>/index.js`.
2) The dev server detects changes and pushes an update to the connected world only for that linked app.
3) The client receives the update, hashes and stages the script as `asset://<hash>.js`, uploads it if needed, updates the app blueprint, and applies the changes live.

Result: Changes appear in‑world in ~1–2 seconds without page refresh.

What’s watched by the server
- `apps/<appName>/index.js` — script changes deploy to the linked world
- `apps/<appName>/links.json` — blueprint/prop changes deploy to the linked world

Tips
- You can still use the Dev Tools pane to manually Deploy or Unlink an app.
- If you add model/prop assets referenced as `asset://<hash>.<ext>`, the server may request the file from the client; assets are saved under `apps/<appName>/assets/`.

---

### Minimal CLI you might use

```bash
# Start server (hot reload on)
npx @drama.haus/app-server

# (Optional) Create a scaffold if starting from scratch
npx @drama.haus/app-server create myApp

# Manually deploy (rarely needed once hot reload is on)
npx @drama.haus/app-server deploy myApp
```

---

### Troubleshooting

- Dev Tools shows Disconnected: ensure the server is running and the port matches (default 8080). Use Refresh Status.
- No Dev Tools in Sidebar: ensure `PUBLIC_DEV_SERVER=true` and you are admin.
- Changes not appearing: confirm the app is linked (Link icon active) and that you are editing `apps/<appName>/index.js` on the dev server’s filesystem.


