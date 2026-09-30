# AEGIS-911 — Local Infrastructure

Docker Compose stack for local development: **Postgres 16**, **Redis 7**,
**MinIO** (S3-compatible storage for call recordings), plus an optional
app tier (`apps/server`, `apps/web`).

## Quick start

```bash
# 1. Environment (defaults work out of the box; copy to override)
cp infra/.env.example infra/.env

# 2. Bring up infra (postgres + redis + minio)
npm run infra:up            # = docker compose -f infra/docker-compose.yml up -d

# 3. Schema + seed (from the repo root; server workspace owns Prisma)
npx prisma migrate deploy --schema apps/server/prisma/schema.prisma
npx prisma db seed          # protocol library + demo users

# 4. Run the app in dev mode
npm run dev                 # all workspaces --if-present
#   apps/server → http://localhost:4000
#   apps/web    → http://localhost:5173
```

Useful commands:

| Command | What it does |
|---|---|
| `npm run infra:up` | Start postgres/redis/minio (detached) |
| `npm run infra:down` | Stop the stack (data volumes are kept) |
| `npm run infra:reset` | Stop **and delete** data volumes (fresh DB/MinIO) |
| `npm run test:e2e` | Playwright smoke suite against `http://localhost:5173` |
| `docker compose -f infra/docker-compose.yml logs -f postgres` | Tail a service |

Services and ports:

| Service | Port | Notes |
|---|---|---|
| postgres | 5432 | db `aegis911`, user/pass from `infra/.env` |
| redis | 6379 | AOF persistence on, password auth |
| minio (S3 API) | 9000 | bucket `aegis-recordings` auto-created |
| minio (console) | 9001 | web UI, root creds from `infra/.env` |
| server *(profile `app`)* | 4000 | built from `apps/server/Dockerfile` |
| web *(profile `app`)* | 5173 | built from `apps/web/Dockerfile`, serves on :80 in-container |

## The `app` profile

The compose file also defines `server` and `web` services behind the optional
`app` profile. `npm run infra:up` enables the profile **automatically, but
only once both `apps/server/Dockerfile` and `apps/web/Dockerfile` exist** —
before that, the infra services come up alone. To run the containerized app
by hand:

```bash
docker compose -f infra/docker-compose.yml --profile app up -d --build
```

Conventions for those Dockerfiles (they live in `apps/`, owned by the
server/web agents):

- **Build context is the repo root**, dockerfile path `apps/<svc>/Dockerfile`,
  so the build can `COPY packages/ …` (npm workspaces).
- `server` is expected to listen on `$PORT` (default 4000) and expose
  `GET /health`; `web` serves static assets on port 80.

## Real-number testing (Twilio webhook ingress)

With `MOCK_VENDORS=false` and real Twilio/AssemblyAI credentials configured
(via the Settings UI or env — see `infra/.env.example`), Twilio must be able
to reach the local server. Expose it with ngrok:

```bash
ngrok http 4000
# → Forwarding https://<random>.ngrok-free.app -> http://localhost:4000
```

Then point the Twilio number's **"A call comes in"** webhook to:

```
https://<random>.ngrok-free.app/webhooks/twilio/voice
```

and the status/recording callbacks to `/webhooks/twilio/status` and
`/webhooks/twilio/recording` respectively. Twilio signs every request, so the
local clock must be roughly correct (signature validation is time-sensitive).

## Data & lifecycle

- Named volumes `postgres-data`, `redis-data`, `minio-data` persist across
  `infra:down`; `infra:reset` wipes them.
- `infra/postgres/init/*.sql` runs **only on first volume creation**
  (creates `aegis911`, `uuid-ossp`, `pg_trgm`). To re-run from scratch:
  `npm run infra:reset && npm run infra:up`.
- The `minio-init` one-shot container runs on every `up` and is a no-op once
  the `aegis-recordings` bucket exists.
