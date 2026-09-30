# AEGIS-911 — Technical Implementation Plan

- **Status:** Draft v1.0
- **Date:** 2026-09-30
- **Implements:** `PRD.md` (v1.1), UI per `DESIGN.md` / `code.html` / `screen.png`
- **Vendors:** Twilio (telephony), AssemblyAI (STT + TTS, per https://www.assemblyai.com/docs)

---

## 1. Architecture Overview

```
                       PSTN callers
                            │
                     ┌──────▼───────┐
                     │    Twilio    │  Voice webhooks, Media Streams (WS, 8kHz μ-law), recording
                     └──────┬───────┘
                            │ HTTPS webhook / WSS media
              ┌─────────────▼──────────────┐
              │      API Gateway (REST)    │  TwiML responses, authN/authZ, CRUD
              └─────────────┬──────────────┘
                            │
        ┌───────────────────┼────────────────────────┐
        │                   │                        │
┌───────▼────────┐  ┌───────▼────────┐      ┌────────▼────────┐
│ Media Gateway  │  │ AI Orchestrator│      │ Console Realtime │
│ (per-call WS   │─▶│ (protocol      │─────▶│ Gateway (WS to   │
│  bridge,       │  │  suggestion,   │      │  operator UI)    │
│  transcode)    │  │  TTS control)  │      └────────┬────────┘
└───────┬────────┘  └───────┬────────┘               │
        │ WSS               │ gRPC/WS                │ WSS
┌───────▼───────────────────▼────────┐      ┌────────▼────────┐
│          AssemblyAI                │      │ Operator Console │
│ Streaming STT · Voice Agent (TTS)  │      │ (React SPA)      │
│ Speech Understanding · Guardrails  │      └─────────────────┘
└────────────────────────────────────┘
        │
┌───────▼─────────────────────────────────┐
│ Platform services: Config Service (hot  │
│ reload), PostgreSQL, Redis, S3 storage, │
│ Audit Log writer, Metrics/Alerting      │
└─────────────────────────────────────────┘
```

**Runtime services (deployable units):**

| Service | Responsibility | Key FRs |
|---|---|---|
| `api-gateway` | REST API, Twilio voice webhooks, TwiML, JWT auth, RBAC | FR-1, FR-7, FR-10–12 |
| `media-gateway` | Twilio Media Stream WS per call; transcode; fork audio to AssemblyAI; inject TTS/operator audio back | FR-1, FR-3, FR-5, FR-6 |
| `ai-orchestrator` | Transcript consumption, protocol suggestion engine, metadata extraction, distress score, TTS script generation | FR-4, FR-5, FR-9 |
| `realtime-gateway` | Authenticated WSS to operator consoles: live transcripts, telemetry, call state, config push | FR-2, FR-3, FR-12 |
| `config-service` | Versioned config store, validation, hot-reload event bus, rollback | FR-12 |
| `console-web` | React SPA: dispatch console, call history, audit logs, settings | FR-2–FR-12 (UI) |
| `worker` | Async jobs: recording ingestion, pre-recorded STT fallback, retention purge, exports | FR-10, FR-11 |

**Data stores:** PostgreSQL (system of record), Redis (pub/sub for hot-reload + live session fanout + rate limits), S3-compatible object storage (call recordings, exports), OpenSearch or Postgres FTS (transcript search for FR-10).

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS | Prototype (`code.html`) is already Tailwind; direct port of `DESIGN.md` tokens to `tailwind.config` |
| Frontend realtime | Native WebSocket client + Zustand store | Deterministic layout, sub-16ms UI feedback; no heavy state lib |
| Backend | Node.js 22 + TypeScript + Fastify | Same language end-to-end; first-class `ws` support for media streaming; fast webhook handling |
| AssemblyAI client | Official AssemblyAI TypeScript SDK | Documented Streaming STT + integrations |
| Twilio client | `twilio` Node SDK (TwiML, REST, webhook validation) | Standard |
| DB | PostgreSQL 16 + Prisma (or Drizzle) | Typed migrations, JSONB for flexible telemetry |
| Bus/cache | Redis 7 (pub/sub + streams) | Hot-reload events, live transcript fanout |
| Storage | S3 (MinIO in dev) | Recordings, exports |
| Auth | OIDC (agency IdP) or built-in JWT + TOTP MFA | RBAC roles: operator, lead, supervisor/admin |
| Infra | Docker + docker-compose (dev), Kubernetes + Helm (prod) | Multi-service, horizontal scale |
| Observability | OpenTelemetry → Prometheus/Grafana, Loki logs, Sentry | Latency budgets are core KPIs |

## 3. Telephony Design — Twilio (FR-1)

1. **Number provisioning:** numbers purchased/managed via Twilio Console or REST API; registered in `numbers` table via Settings UI (FR-12). Pool of 1…N, each with routing profile + hunt order.
2. **Inbound call flow:**
   - Twilio hits `POST /webhooks/twilio/voice` (signature-validated with Auth Token).
   - API looks up dialed number → routing profile → creates `call` row (status `RINGING`) → responds with TwiML:
     ```xml
     <Response>
       <Connect>
         <Stream url="wss://media.aegis911.internal/twilio" />
       </Connect>
     </Response>
     ```
   - Answer time budget: webhook p95 < 300 ms → AI pickup < 1 s.
3. **Media Streams:** bidirectional WSS; inbound frames = 8 kHz μ-law base64. Media gateway:
   - Decodes μ-law → PCM, resamples 8k→16k for AssemblyAI Streaming STT; 8k→48k for console playback/monitoring.
   - Outbound: TTS/operator PCM 16k → μ-law 8k frames → Twilio stream (`media` messages with `track: outbound`).
4. **Barge-in (FR-6):** operator mic (browser `getUserMedia`) → realtime-gateway → media-gateway → outbound Twilio track; on barge-in, orchestrator sends `CUT_TTS` and mutes AI; latency target < 300 ms.
5. **Failover:** hunt groups via TwiML `<Dial>` fallback on stream connect failure; single-number deployments rely on Twilio multi-region + fallback operator `<Dial>`. Stream `error`/`stop` events update call-card state.
6. **Recording:** `<Stream>` plus Twilio call recording (`record: record-from-answer-dual`); recording-status callback → worker downloads to S3 → links to call record (FR-10).

## 4. Voice AI Design — AssemblyAI (FR-3, FR-4, FR-5, FR-9)

Per https://www.assemblyai.com/docs:

1. **Streaming STT:** one Universal-Streaming WebSocket per call (~150 ms p50). 16 kHz PCM frames from media gateway. Handle `PartialTranscript` (render streaming underline) and `FinalTranscript` (persist `transcript_segments` with word-level confidence + timestamps). Words < threshold (default 85%, configurable) flagged amber.
2. **Concurrency:** connection pool keyed by `callId`; ≥ 3 concurrent streams per operator console; horizontal scale by adding media-gateway replicas (streams are per-call, stateless to scale).
3. **TTS path:** primary = AssemblyAI Voice Agent API (managed STT→LLM→TTS, ~1 s) for AI-attended dialogue; for operator-typed text (FR-5) use Voice Agent's TTS leg or confirmed standalone TTS endpoint. Synthesized audio chunks stream back → media-gateway → Twilio outbound. Target first-byte < 1 s.
4. **Speech Understanding:** post-call (or rolling) summarization, sentiment → distress score input, topic/intent detection → incident type, entity extraction (name, age, hazards) → FR-9 structured chips.
5. **Guardrails:** PII redaction applied to stored transcripts per agency policy.
6. **Degradation fallback (NFR):** STT circuit breaker (3 consecutive failures) → call card flagged, operator-only mode; audio buffered → worker submits Pre-recorded STT after hangup and backfills transcript.

## 5. Protocol Suggestion Engine (FR-4)

- Curated **protocol library** (PostgreSQL `protocols` table + YAML seed): id, name, trigger intents/keywords, script text, category (medical/fire/police), version.
- Matching pipeline per final transcript segment: intent classification (AssemblyAI Speech Understanding or LLM Gateway) → ranked protocol candidates with confidence → top card pushed to console (`PROTO: ... — NN.N% MATCH`).
- Guardrail: suggestions only from curated library (no free-generation of medical advice); operator must trigger TTS (Ctrl+1/2/3) unless auto-speak policy enabled in Settings.
- All suggestion events persisted for FR-11 audit and FR-10 call detail.

## 6. Console Frontend (FR-2 … FR-9, FR-12)

- Port `code.html` → React components; `DESIGN.md` tokens → `tailwind.config` (colors, Inter/JetBrains Mono, radii 2–4px, tabular-nums).
- Component tree: `TopCommandHeader`, `CallMatrix` → `CallCard` (`CallerVitals`, `TranscriptFeed`, `ProtocolSuggestion`, `TTSControls`, `UnitGrid`), `BottomDock` (`GISRadar`, `HotkeyBar`, `MasterPTT`), plus routes: `/console`, `/history`, `/history/:id`, `/audit`, `/settings`.
- State: Zustand stores per callId; WS messages (`transcript.partial/final`, `suggestion`, `telemetry`, `call.state`, `config.updated`) merged with 60fps batched rendering to respect sub-16ms feedback.
- Hotkeys: global listener — Ctrl+1/2/3 (speak TTS), Space (PTT hold), Shift+Enter (dispatch confirm); bindings configurable in Settings.
- GIS: MapLibre GL with unit markers + caller accuracy circle.

## 7. Settings & Hot-Reload (FR-12)

- **Config model:** versioned documents in `config_versions` (scope: `twilio`, `assemblyai`, `console`); secrets encrypted with KMS-managed envelope key (AES-256-GCM); UI shows masked write-only fields.
- **Save flow:** UI → `PUT /api/settings/:scope` → server validates schema (zod) → connection tests (Twilio: fetch account; AssemblyAI: open test stream) → persist new version → publish `config.changed` on Redis → return apply plan.
- **Hot-reload:** each service subscribes to its scope; rebuilds vendor clients in background, health-checks, atomic swap. Config-fetch is always from in-memory cache backed by Redis (single source: Postgres).
- **Active-call safety:** running calls pin the config version active at pickup (`call.config_version`); new version applies to next call.
- **Rollback:** if post-swap health check fails within 10 s, auto-restore previous version and emit `config.rollback` alert + audit entry.
- **Console push:** `config.updated` over realtime-gateway → live-apply hotkeys/thresholds without refresh.

## 8. Data Model (PostgreSQL, core tables)

```
users(id, name, role, badge_no, mfa_secret, created_at)
numbers(id, e164, label, routing_profile, hunt_order, status)
calls(id, twilio_call_sid, number_id, caller_e164, status, distress_score,
      incident_type, started_at, answered_at, ended_at, hangup_cause,
      config_version, attending_mode, disposition)
transcript_segments(id, call_id, channel[CALLER|AI|OPERATOR], text,
      words_jsonb[{w,conf,start,end}], is_final, created_at)
suggestions(id, call_id, protocol_id, confidence, script, triggered_by,
      tts_injected_at, created_at)
dispatches(id, call_id, unit_id, unit_type, eta_s, status, confirmed_by, created_at)
protocols(id, name, category, script, triggers_jsonb, version, active)
call_recordings(id, call_id, s3_key, duration_s, created_at)
audit_logs(id, actor_id, action, resource, resource_id, before_jsonb,
      after_jsonb, ip, prev_hash, hash, created_at)   -- hash-chained, append-only
config_versions(id, scope, version, payload_jsonb(enc), status, actor_id,
      applied_at, rolled_back_from, created_at)
exports(id, call_id?, actor_id, type, s3_key, created_at)
```

Hash chain for `audit_logs`: `hash = SHA256(prev_hash || canonical(entry))`; daily anchor job verifies chain.

## 9. API Surface (REST, prefix `/api`, JWT + RBAC)

| Endpoint | Purpose | FR |
|---|---|---|
| `POST /webhooks/twilio/voice` | Inbound call → TwiML | FR-1 |
| `POST /webhooks/twilio/status` / `/recording` | Lifecycle, recording callbacks | FR-1, FR-10 |
| `GET /calls?filters` | Call History search | FR-10 |
| `GET /calls/:id` (+`/transcript`, `/recording-url` signed) | Call detail | FR-10 |
| `POST /calls/:id/export`, `POST /exports/bulk` | Exports (audit-logged) | FR-10 |
| `POST /calls/:id/tts` / `/barge-in` / `/dispatch` | Live actions (also via WS) | FR-5–7 |
| `GET /audit?filters` | Audit log view (supervisor) | FR-11 |
| `GET/PUT /settings/:scope`, `POST /settings/:scope/test` | Settings + connection test | FR-12 |
| `GET /settings/twilio/numbers`, `POST/DELETE …/numbers` | Number pool mgmt | FR-1, FR-12 |
| `WSS /realtime` | Console live channel | FR-2–6 |

## 10. Security & Compliance

- Twilio webhook signature validation on every callback; WSS media auth via one-time stream token.
- Secrets: KMS envelope encryption; never logged; masking in all API responses.
- RBAC enforced at gateway + service; routes guarded (settings/audit = supervisor+).
- TLS 1.2+ everywhere; at-rest encryption (RDS/S3); PII redaction via AssemblyAI Guardrails before persistence where policy requires.
- Audit-on-audit: reads of call detail/history exports write `audit_logs` entries.
- CJIS-adjacent controls: MFA, session timeouts, IP allow-list option, retention + legal hold (FR-10).

## 11. Testing Strategy

| Level | Scope | Tooling |
|---|---|---|
| Unit | transcode, protocol matcher, config validation, hash chain | Vitest |
| Contract | Twilio webhook payloads, AssemblyAI WS message handling | Recorded fixtures + `twilio` test creds |
| Integration | full call: Twilio simulator → media-gateway → mock AssemblyAI → console WS | docker-compose test env |
| E2E | console flows: pickup → transcript → suggest → TTS → barge-in → dispatch; settings save → hot-reload verify | Playwright |
| Load | 3 concurrent calls/operator × N operators; STT stream fanout; p95 budgets | k6 |
| Chaos/failover | AssemblyAI outage → fallback mode; config rollback; number hunt rollover | fault injection in staging |
| Security | webhook forgery, RBAC escalation, secret leakage scan | OWASP ZAP, gitleaks |

## 12. Milestones & Task Breakdown

### M1 — Telephony + Live STT Console + Settings (weeks 1–5)
1. Repo/monorepo scaffold, CI, docker-compose (Postgres, Redis, MinIO)
2. `api-gateway`: auth, RBAC, Twilio voice webhook + TwiML
3. `media-gateway`: Twilio stream bridge, μ-law↔PCM transcode
4. AssemblyAI streaming STT integration; partial/final pipeline
5. `realtime-gateway` + console shell: header, 3 call cards, transcript feed with confidence flags, barge-in
6. `config-service` + Settings UI (Twilio/AssemblyAI keys, test connection, hot-reload bus, rollback)
7. Call History schema + basic list/detail
8. **Exit criteria:** live call on a real Twilio number transcribes to console with <500ms partials; settings change hot-applies with zero restart

### M2 — AI Suggestions + TTS (weeks 6–9)
1. Protocol library + matcher + confidence surfacing
2. TTS injection (Ctrl+1/2/3, custom text, preview) via Voice Agent API
3. Metadata extraction + distress score (Speech Understanding)
4. Auto-scroll, WPM/latency telemetry, STT channel counter
5. **Exit criteria:** suggested protocol spoken to caller <1s; barge-in cuts TTS <300ms

### M3 — Dispatch, History & Audit (weeks 10–13)
1. Unit grid (stub CAD), dispatch confirm, panic broadcast
2. GIS radar (MapLibre), location telemetry
3. Recording ingestion to S3, synced playback in Call History, exports
4. Append-only hash-chained audit logs + Audit view + alerting (P2)
5. Retention purge + legal hold; load/chaos test pass; security review
6. **Exit criteria:** full E2E drill — 3 concurrent simulated SOS calls handled, dispatched, audited; 99.95% availability config verified in staging

## 13. Deployment & Environments

- **Dev:** docker-compose; Twilio test credentials; AssemblyAI dev key; ngrok for webhook ingress.
- **Staging:** single K8s namespace, fault-injection toggles, seeded protocol library.
- **Prod:** K8s multi-AZ; `api-gateway`/`media-gateway`/`realtime-gateway` HPA on CPU + active-stream count; Postgres HA + PITR; Redis sentinel; S3 lifecycle policies matching retention.
- **CI/CD:** GitHub Actions — lint/typecheck/test → image build → staging deploy → E2E gate → manual prod promotion.

## 14. Key Technical Risks & Spikes (do in week 1)

1. **Standalone TTS spike (FR-5):** validate AssemblyAI Voice Agent vs standalone TTS for operator-typed text; measure first-byte latency — fallback: paired TTS provider behind vendor-abstraction interface (`VoiceSynthesizer`).
2. **Media stream latency budget:** measure Twilio→gateway→AssemblyAI round trip on staging network; confirm <500ms partial budget and <300ms barge-in.
3. **Hot-reload under load:** prove config swap with 100+ active streams causes zero dropped calls.
4. **Transcript search:** Postgres FTS vs OpenSearch decision at M3 scale.
