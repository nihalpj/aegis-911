# AEGIS-911 — Operations Runbook

This guide covers operational tasks for AEGIS-911: local development bring-up, call simulation, exposing webhooks for live telephony testing with Twilio, log/call history locations, and the runtime configuration hot-reload flow.

---

## 1. Local Development Bring-Up

### Prerequisites
- Node.js >= 22
- Docker & Docker Compose
- npm (workspaces support)

### Step-by-Step Bring-Up

1. **Environment Configuration**
   Copy the example environment configuration into the root `.env` or `infra/.env`:
   ```bash
   cp infra/.env.example infra/.env
   # Or configure root .env for Supabase database access and local server
   ```
   *Note:* By default in development, `MOCK_VENDORS=true` replaces external Twilio and AssemblyAI calls with local mock flows.

2. **Start Infrastructure Services**
   Bring up Postgres 16, Redis 7, and MinIO (S3 object store for recordings):
   ```bash
   npm run infra:up
   ```
   To run only Redis and MinIO (e.g. when connecting directly to Supabase Postgres as configured in root `.env`):
   ```bash
   docker compose -f infra/docker-compose.yml up -d redis minio
   ```

3. **Database Migration & Seeding**
   Deploy Prisma migrations and seed the emergency protocol library and demo operators:
   ```bash
   npx prisma migrate deploy --schema apps/server/prisma/schema.prisma
   npx prisma db seed --schema apps/server/prisma/schema.prisma
   ```

4. **Start Development Servers**
   Run all workspaces concurrently (`apps/server` and `apps/web`):
   ```bash
   npm run dev
   ```
   - **Backend Server (`apps/server`):** `http://localhost:8080` (or `http://localhost:4000`)
   - **Operator Console (`apps/web`):** `http://localhost:5173`
   - **MinIO S3 Console:** `http://localhost:9001` (user: `aegis`, pass: `aegis_dev_password`)

---

## 2. Testing with `scripts/simulate-call.mjs`

`scripts/simulate-call.mjs` is a zero-dependency Node 22 script designed for testing the intake pipeline without requiring real Twilio credentials or phone numbers.

### Basic Webhook Simulation (HTTP POST)
Sends an inbound Twilio voice webhook form payload to `/webhooks/twilio/voice` and outputs the resulting TwiML response:
```bash
node scripts/simulate-call.mjs
```

### Options & Customization
```bash
node scripts/simulate-call.mjs [options]

Options:
  --from <number>       Caller phone number in E.164 format (default: +15550199110)
  --to <number>         Dialed SOS line number (default: +15559110000)
  --call-sid <sid>      Twilio CallSid (default: generated CA...)
  --server <url>        Base server URL (default: http://localhost:8080)
  --stream              Connect to Media Stream WebSocket from TwiML <Stream url>
  --duration <seconds>  Stream duration in seconds (default: 30)
  --interval <ms>       Frame/transcript transmission interval in ms (default: 500)
  --help, -h            Show CLI help message
```

### Full Media Stream Simulation (`--stream`)
To simulate an active live call with streaming audio frames and transcript injection:
```bash
# Simulates a call from a custom caller to line #911-8841 for 20 seconds
node scripts/simulate-call.mjs --server http://localhost:8080 --from +15552345678 --to +15559118841 --stream --duration 20
```
This:
1. POSTs to `http://localhost:8080/webhooks/twilio/voice`.
2. Parses the `<Stream url="..."/>` WebSocket endpoint from the returned TwiML.
3. Establishes the WebSocket connection and exchanges Twilio `connected` and `start` events.
4. Sends base64 $\mu$-law silence audio frames and transcript injection control messages every 500ms.
5. Logs all bidirectional messages (TTS feedback, server events) and closes gracefully with a Twilio `stop` event.

---

## 3. Real Telephony Ingress with ngrok & Twilio

When testing with live phones, real PSTN incoming calls, and live AssemblyAI streaming (`MOCK_VENDORS=false`):

1. **Expose the Local Server via ngrok**
   ```bash
   ngrok http 8080
   # Forwarding: https://<subdomain>.ngrok-free.app -> http://localhost:8080
   ```

2. **Configure the Twilio Phone Number**
   In the [Twilio Console](https://console.twilio.com/) under **Phone Numbers > Manage > Active Numbers**:
   - Set **"A CALL COMES IN"** to `Webhook (HTTP POST)`:
     ```
     https://<subdomain>.ngrok-free.app/webhooks/twilio/voice
     ```
   - (Optional) Set **Call Status Changes** webhook:
     ```
     https://<subdomain>.ngrok-free.app/webhooks/twilio/status
     ```
   - (Optional) Set **Recording Status Callback** webhook:
     ```
     https://<subdomain>.ngrok-free.app/webhooks/twilio/recording
     ```

3. **Verify Webhook Signing & System Clock**
   Twilio verifies incoming requests via the `X-Twilio-Signature` header computed from your `TWILIO_AUTH_TOKEN`. Ensure your system clock is synchronized (e.g. via NTP/systemd-timesyncd), as signature validation is timestamp-sensitive.

---

## 4. Audit Logs & Call History Storage

Data is segregated between transactional call records and security audit logs:

### Call Records & History
- **Database Table:** `calls`, `transcript_segments`, `suggestions`, `dispatches`
- **Call Recordings:** S3/MinIO bucket `aegis-recordings` under keys `recordings/{call_id}/{timestamp}.wav`
- **Console Access:** Navigate to `/history` on the web console (`http://localhost:5173/history`) for full searchable, filterable call logs, synced audio playback, and PDF/JSON transcript export.

### Audit Logs (Tamper-Evident)
- **Database Table:** `audit_logs` (schema: `id`, `actor_id`, `action`, `resource`, `resource_id`, `before_jsonb`, `after_jsonb`, `ip`, `prev_hash`, `hash`, `created_at`)
- **Tamper Evidence:** Append-only log with a cryptographic hash chain:
  $$\text{hash} = \text{SHA256}(\text{prev\_hash} \parallel \text{canonical}(\text{entry}))$$
- **Tracked Events:**
  - Auth: Logins, logouts, role changes
  - Operations: Dispatches, barge-in, panic broadcasts, call exports
  - Settings: All credential/configuration edits and API key rotations (with masked key values)
- **Console Access:** Navigate to `/audit` on the web console (`http://localhost:5173/audit`).

---

## 5. Hot-Reload Settings Flow

The Settings page (`/settings`) allows administrators to adjust Twilio credentials, number pools, and AssemblyAI options with **zero downtime or service restarts**:

### Architecture Flow
```
[Settings UI (/settings)]
       │ (1) PUT /api/settings/:scope (Zod schema validation)
       ▼
[Config Service] ─── (2) Encrypt secrets (AES-256-GCM via KMS)
       │         ─── (3) Validate credentials (test connection)
       │         ─── (4) Persist version in config_versions & record audit_logs
       ▼
[Redis Pub/Sub]  ─── (5) Broadcast 'config.changed' event
       │
       ├───────────────────────────────┐
       ▼                               ▼
[Telephony / Media Gateway]     [Console Realtime Gateway]
 Rebuilds vendor clients &       Pushes 'config.updated' to active
 swaps connections in background operator consoles (hotkeys/thresholds)
```

### Safety Guarantees & Rollback
- **Active Call Safety:** In-progress SOS calls remain pinned to their pickup configuration version (`call.config_version`). The new configuration applies atomically to subsequent incoming calls.
- **Automated Rollback:** After swapping, background health checks verify the new configuration within 10 seconds. If connection tests or health checks fail, the system automatically rolls back to the last known-good version, emits a `config.rollback` alert, and registers the failure in `audit_logs`.
