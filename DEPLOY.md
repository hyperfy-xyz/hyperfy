# Deploying HyperCore Odyssey (Hyperfy)

The game is one Node.js server (HTTP + WebSockets) plus a `world/` folder holding the SQLite
database and uploaded assets. Any host that runs a Docker container with **WebSockets** and a
**persistent disk** works (Railway, Render, Fly.io, a VPS). Serverless hosts (Vercel, Netlify)
cannot run it.

## 1. Container

Use the included `Dockerfile` (Node 22, `NODE_ENV=production`). It listens on `PORT` (3000).
Mount a persistent volume at `/app/world` so players, builds and uploads survive restarts.

## 2. Environment variables

| Variable | Value |
| --- | --- |
| `WORLD` | `world` |
| `PORT` | `3000` |
| `JWT_SECRET` | random 32+ chars (`openssl rand -hex 32`) — required in production |
| `ADMIN_CODE` | private code; type `/admin <code>` in chat to become admin — required in production |
| `SAVE_INTERVAL` | `60` |
| `PUBLIC_MAX_UPLOAD_SIZE` | `12` |
| `PUBLIC_WS_URL` | `wss://<your-domain>/ws` |
| `PUBLIC_API_URL` | `https://<your-domain>/api` |
| `ASSETS` | `local` |
| `ASSETS_BASE_URL` | `https://<your-domain>/assets` |
| `DB_URI` | `local` (or a Postgres URI) |
| `CLEAN` | `true` |
| `PUBLIC_PLAYER_COLLISION` | `false` |
| `BILLING_ENABLED` | `false` until Stripe is ready |

Optional: `LIVEKIT_*` for voice chat, `AI_*` for the in-world AI builder.

## 3. After the first deploy

1. Open the site, type `/admin <ADMIN_CODE>` in chat.
2. Set the world title, description and preview image in world settings (used for link previews).
3. Build the starter area players spawn into, then `/spawn set`.

## 4. Turning on paid builder access (later)

1. Create a Stripe product "Architect Pro" with a monthly price; copy the price ID.
2. Add a webhook endpoint `https://<your-domain>/api/billing/webhook` with events
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`; copy its signing secret.
3. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `BILLING_ENABLED=true`,
   and set the world's default rank to Builder so trial/Pro players can build.
