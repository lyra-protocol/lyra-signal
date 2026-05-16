# Deploying Lyra Signal

## Important: Vercel and this backend

**Vercel serverless functions cannot act as a WebSocket server** and cannot keep the **PumpPortal** WebSocket open. See [Vercel limits — WebSockets](https://vercel.com/docs/limits#websockets).

So the **real** `lyra-signal` process (HTTP + `wss://…/feed` + Pump worker) must run on a **container** or **VM** platform:

- [Railway](https://railway.app) (Dockerfile included)
- [Render](https://render.com) (`render.yaml` included)
- [Fly.io](https://fly.io), Google Cloud Run (with min instances ≥ 1), etc.

### What you can put on `lyra-signal.vercel.app`

Deploy the **static landing** in `deploy/vercel-site` as a **separate Vercel project** (documentation only):

```bash
cd deploy/vercel-site
vercel --prod
```

Assign the project name **lyra-signal** in the Vercel dashboard so the URL is `https://lyra-signal.vercel.app`.

The **live WebSocket URL** for the app will still be your Railway (etc.) URL, e.g. `wss://lyra-signal-production.up.railway.app/feed`.

---

## Environment variables (production)

Set the same secrets as local `.env` on the host:

- `HELIUS_API_KEY` or full `SOLANA_RPC_URL`
- `PUMP_PORTAL_WS_URL`
- `AZURE_OPENAI_*` for sentence generation
- Optional: `SUPABASE_*` if you add persistence later

**Port:** platforms usually set `PORT`. The server uses `PORT` first, then `SIGNAL_HTTP_PORT`, default `3847`.

**HTTPS / WSS:** use the platform’s public HTTPS URL; browsers connect with `wss://` to the same host and path `/feed`.

---

## Railway (Docker)

1. Create a new project → Deploy from GitHub (this repo) or `railway up`.
2. Set **Root Directory** to `lyra-signal` if the monorepo root is elsewhere.
3. Railway detects `Dockerfile` or use `railway.toml`.
4. Add environment variables in the dashboard.
5. Generate a public domain (Settings → Networking).

Health check: `GET https://YOUR_DOMAIN/health`

---

## Render

1. New → Blueprint → connect repo, or Docker deploy with `render.yaml`.
2. Set env vars.
3. Use the generated `onrender.com` URL or attach a custom domain.

---

## Local Docker

```bash
docker build -t lyra-signal lyra-signal
docker run --env-file lyra-signal/.env -p 3847:3847 lyra-signal
```

---

## Connecting lyra-ui

Set `NEXT_PUBLIC_SIGNAL_WS_URL` (or your chosen name) to `wss://YOUR_BACKEND_HOST/feed` in the Next app’s environment for the signal page.

## Birdeye + Telegram production setup

The Birdeye-powered worker runs inside this long-lived `lyra-signal` process, not in Vercel serverless.

Required worker env vars:

- `BIRDEYE_API_KEY` — Birdeye Data Services key.
- `TELEGRAM_BOT_TOKEN` — BotFather token for Lyra Signal Bot.
- `REDIS_URL` — optional but recommended; stores Telegram subscribers/preferences across restarts.

Useful tuning vars:

- `BIRDEYE_WORKER_ENABLED=1`
- `BIRDEYE_CANDIDATE_LIMIT=8`
- `BIRDEYE_MIN_SAFETY_SCORE=70`
- `BIRDEYE_MIN_LIQUIDITY_USD=5000`
- `BIRDEYE_TRENDING_INTERVAL_MS=30000`
- `BIRDEYE_NEW_LISTING_INTERVAL_MS=60000`

The worker exposes recent alerts at:

```text
GET https://YOUR_SIGNAL_HOST/api/signals/recent?limit=20
```

The WebSocket feed remains:

```text
wss://YOUR_SIGNAL_HOST/feed
```

## Connecting lyra-ui

Set these in the Vercel project for `lyra-ui`:

- `NEXT_PUBLIC_LYRA_SIGNAL_URL=wss://YOUR_SIGNAL_HOST` (client live feed)
- `LYRA_SIGNAL_URL=https://YOUR_SIGNAL_HOST` (server proxy for `/api/signals/recent`)
- `TELEGRAM_BOT_TOKEN` (server-only, used by `/api/telegram/bot` to resolve the `t.me` link)
- Optional: `NEXT_PUBLIC_LYRA_TELEGRAM_BOT_URL=https://t.me/YOUR_BOT_USERNAME`
