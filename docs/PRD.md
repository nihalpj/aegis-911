# PRD — AEGIS-911: AI SOS Call Attending & Emergency Dispatch Console

- **Status:** Draft v1.1
- **Date:** 2026-09-30
- **Voice AI Vendor:** AssemblyAI — Speech-to-Text and Text-to-Speech ([docs](https://www.assemblyai.com/docs))
- **Telephony Provider:** Twilio — mobile numbers and SOS call receiving
- **Companion artifacts:** `DESIGN.md` (design system), `screen.png` (console mockup), `code.html` (static prototype)

---

## 1. Overview & Problem Statement

Public Safety Answering Points (PSAPs) face chronic call-taker overload: simultaneous emergencies queue up while each human operator can attend only one call at a time. Seconds lost in the queue are lives lost in the field.

**AEGIS-911** is an AI-augmented emergency call-attending console that lets a single operator supervise multiple concurrent SOS calls. An AI agent answers each line instantly, transcribes the caller in real time, matches the situation to an emergency protocol, and can speak life-saving instructions back to the caller — while the human operator monitors everything from one tactical console and can barge into any call at any moment.

The console UI already exists as a static prototype (`code.html`, `screen.png`) built on the tactical design system in `DESIGN.md`. This PRD defines the product requirements to turn that prototype into a working system: **Twilio** provisions the emergency mobile numbers and receives SOS calls over the PSTN, and **AssemblyAI** provides the speech-to-text (STT) and text-to-speech (TTS) layer ([AssemblyAI docs](https://www.assemblyai.com/docs)).

## 2. Goals & Success Metrics

| Goal | Metric | Target |
|---|---|---|
| Instant call answering | Time from ring to AI pickup | < 1 s |
| Accurate live transcription | Streaming STT word-level confidence | ≥ 95% median |
| Fast voice guidance | TTS text → audible speech in call | < 1 s first-byte |
| Real operator leverage | Concurrent calls supervised per operator | ≥ 3 |
| Correct triage | AI protocol match accepted without edit | ≥ 90% |
| Human override readiness | Barge-in takeover latency | < 300 ms |

Non-goals for MVP: replacing human dispatchers, automatic dispatch without human confirmation, non-English call handling.

## 3. Personas

1. **911 Operator / Dispatcher (primary)** — supervises concurrent calls, reviews AI suggestions, injects TTS guidance, barges in when needed, assigns units. Works 12-hour shifts on dual/triple-monitor setups; keyboard-first.
2. **Dispatch Lead (e.g., "Ofc. J. Miller, Station 4")** — owns the console session, triggers panic broadcast, confirms Code-3 dispatches, manages unit assignment grid.
3. **Supervisor / Admin** — audits call logs, reviews AI suggestion accuracy, configures protocol library and operator permissions.

## 4. Scope

### In scope (MVP)
- SOS call receiving on a pool of multiple Twilio-provisioned mobile numbers (PSTN/SIP)
- Multi-call intake with concurrent call cards and triage queue
- Real-time streaming STT transcription per call (AssemblyAI)
- AI emergency-protocol suggestion with confidence score
- TTS voice injection of AI/custom guidance into the live call (AssemblyAI)
- Human barge-in / PTT takeover at any time
- Dispatch command: unit assignment grid with ETAs, dispatch confirm, panic broadcast
- Caller location / GIS telemetry panel
- Call metadata auto-extraction (name, age, incident type, distress score)
- Call history with full call detail, playback, and export
- Tamper-evident audit logs of all user and system actions
- Settings page for all system configuration (Twilio, AssemblyAI, API keys, console preferences)

### Out of scope (MVP)
- Deep CAD vendor integrations (simulated/stubbed unit grid only)
- Mobile or field-responder app
- Video calls / multimedia
- Multi-language support (English only)
- Automated dispatch without operator confirmation

## 5. Functional Requirements

### FR-1 — SOS Call Receiving via Twilio (P0)
- Emergency mobile numbers are provisioned and managed through **Twilio** (Voice, PSTN/SIP) as a **configurable number pool (1…N)**: a deployment may run on a **single SOS number** (minimal/small-agency setup) or scale to **multiple numbers** — e.g., dedicated lines per agency/region (Police, Fire, EMS), per language (future), or per campaign — all feeding the same console.
- The pool size is a deployment/admin setting; running with 1 number is fully supported and requires no special configuration. Numbers can be added later without downtime.
- Each number has its own Twilio Voice webhook configuration and routing profile; an admin can add, remove, or repoint numbers without code changes.
- Incoming SOS calls to **any** number in the pool (including the single-number case) are answered programmatically within 1 s and bridged into the AEGIS-911 voice pipeline via Twilio Media Streams (bidirectional audio over WebSocket).
- Caller phone number, **dialed number (which SOS line was called)**, call SID, and line metadata are captured on pickup and attached to the call card; the dialed line is displayed on the card (e.g., `LINE 01 • #911-8841`) and can drive triage routing.
- Concurrent call capacity scales horizontally across the number pool and SIP trunk configuration; a single number still supports multiple simultaneous calls (Twilio concurrency per number), load-balanced across available AI sessions, and overflow calls queue with an AI pickup greeting.
- **Failover:** with ≥ 2 numbers, if one number/carrier route fails, calls roll over to the next number in the hunt group; with a single number, failover falls back to Twilio multi-region routing and the TwiML human-operator fallback. Per-number health is monitored in the console header.
- Call recording and hangup events flow through Twilio webhooks into session logging (FR-10).

### FR-2 — Multi-Call Intake & Triage Queue (P0)
- The console displays up to 3 concurrent call cards side-by-side, with a queue for overflow.
- Each card shows: line ID, caller number (from Twilio), caller name/age (when known), incident summary, elapsed call timer (tabular mono numerals), and a **distress score (0–100)**.
- Cards are border-coded by triage state: Red = active unassigned crisis, Amber = AI screen in progress, Green = handled/assigned.
- Top command header shows global triage counters (Critical / En Route / CAD Free), connection status, and operator identity.

### FR-3 — Real-Time STT via AssemblyAI (P0)
- Every call's audio arrives via Twilio Media Streams (transcoded to 48 kHz PCM dual-stream in the console) and is streamed to AssemblyAI's **Streaming Speech-to-Text API**.
- The transcript renders as a **dual-channel feed**: Caller utterances (left-aligned, neutral) vs AEGIS AI / Operator utterances (right-aligned, cyan-accented).
- Words stream with an underline indicator; any word under **85% recognition confidence** is flagged with a dotted amber underline (`#F59E0B`) to prompt operator clarification.
- Per-call STT status chip (e.g., `CONF: 98.4%`) in JetBrains Mono; green ≥ 85%, red < 70%.
- Transcript auto-scrolls (toggleable); cadence telemetry shows caller WPM and audio latency (e.g., `184 WPM | LAT: 42ms`).
- Header indicates `CONCURRENT STT: N CHANNELS LIVE` so the operator can confirm all lines are being transcribed.

### FR-4 — AI Protocol Suggestion Engine (P0)
- The AI continuously analyzes the transcript and surfaces the best-matching emergency protocol card per call (e.g., `PROTO: SHELTER & DOOR SEAL — 98.9% MATCH`, `PROTO: AGONAL BREATH — DO NOT STOP — 99.4% MATCH`).
- Each suggestion includes the exact instruction script to be spoken.
- Suggestions are advisory: nothing is spoken to the caller until the operator triggers it (or auto-speak is explicitly enabled per policy).

### FR-5 — TTS Voice Injection via AssemblyAI (P0)
- **Speak via AI TTS** button per call card (hotkeys **Ctrl+1 / Ctrl+2 / Ctrl+3** per line) synthesizes the suggested protocol script via AssemblyAI TTS and injects it into the caller's audio stream through the Twilio Media Stream.
- A **custom instruction field** per card lets the operator type any message and send it as TTS.
- A **TTS Preview** button auditions the synthesized audio to the operator before injection.
- Active AI speech is visually indicated on the AI transcript track; the AI voice must be clearly distinguishable and calm.

### FR-6 — Barge-In / Human Takeover (P0)
- **Barge-In** button per call card and **Hold Master PTT (Spacebar)** in the bottom dock immediately open the operator's mic to that call (operator audio injected into the Twilio Media Stream).
- On barge-in, any in-progress AI TTS is cut off and the AI is muted until re-armed.
- Takeover latency < 300 ms; a persistent visual state shows which calls are AI-attended vs human-attended.

### FR-7 — Dispatch Command (P0)
- Per-call unit grid with rapid selectors (e.g., `[Eng-14]`, `[Ladder-3]`, `[Medic-09]`) showing live ETA and status (En Route / Ready / Standby).
- Single click stages a unit; **Dispatch** (or Shift+Enter) confirms and broadcasts the assignment.
- Header **PANIC BROADCAST** button triggers an all-station emergency alert with a confirm guard.
- Bottom dock provides All-Station CAD, Priority EMS, Mutual Aid, and Strobe Alarm quick actions.

### FR-8 — GIS / Location Telemetry (P1)
- Per-call location line with address and distance (e.g., `742 Evergreen Terr (0.8 mi)`), editable (`EDIT LOC`).
- Bottom-left **Tactical GIS Radar** shows unit positions, GPS accuracy, and ETAs on a mini-map.
- Caller GPS coordinates and accuracy radius displayed in tabular mono telemetry.

### FR-9 — Call Metadata & Caller Profile (P1)
- The AI extracts caller name, age, incident type, hazards (e.g., "Severe Asthma + Lithium Battery in Garage"), and situational flags (fuel leak, lanes blocked, souls involved) from speech into structured chips.
- Extracted data feeds the distress score and protocol matching.

### FR-10 — Call History (P1)
- A dedicated **Call History view** lists every handled SOS call as a searchable, filterable table: date/time, dialed SOS line, caller number, caller name (when extracted), incident type, distress score, call duration, attending mode (AI-only / human-barged), units dispatched, operator(s) involved, and final disposition (resolved / handed off / escalated / dropped).
- **Filters & search:** by date range, phone number, SOS line, incident type, operator, distress-score band, disposition, and free-text search across transcripts.
- **Call detail page** per record: full dual-channel transcript with timestamps, playback of the Twilio call recording synced to transcript position, protocol suggestions shown with confidence and whether they were used, TTS injections, barge-in moments, dispatch timeline, and location/telemetry snapshot.
- **Export:** single-call export (PDF report + audio + transcript JSON/CSV) and bulk export of filtered results; exports are themselves audit-logged.
- **Retention:** configurable retention period per agency policy; records past retention are purged (with a purge audit entry); legal hold flag prevents deletion.

### FR-11 — Audit Logs (P1)
- A separate **Audit Log view** records every system and user action, independent of call content:
  - **Auth & access:** logins, logouts, failed login attempts, role/permission changes
  - **Configuration:** every Settings page change (FR-12) — before/after values, actor, timestamp; API key rotations (key value never logged)
  - **Call actions:** AI pickup, protocol suggestion triggered, TTS injection, barge-in takeover, dispatch confirm, panic broadcast, hangup
  - **Data access:** who viewed or exported which call record (audit-on-audit for Call History)
- **Tamper-evidence:** audit entries are append-only (no edit/delete from the UI), timestamped server-side, and hash-chained or written to immutable storage so tampering is detectable.
- **Filtering:** by actor, action type, resource, date range; exportable for compliance review.
- **Alerting (P2):** configurable alerts on sensitive events (failed login bursts, API key change, panic broadcast, bulk export).

### FR-12 — Settings & Configuration Page (P0)
- A dedicated **Settings page** (admin/supervisor role only) centralizes all system configuration — no config via code edits, environment variables, or redeploys. All vendor credentials and options are entered, saved, and applied entirely from the UI.
- **Twilio configuration:**
  - Account SID and Auth Token (API keys, stored encrypted, masked in the UI — e.g., `AC••••••••1234`)
  - Number pool management: add/remove/repoint SOS numbers, set per-number routing profile and label (agency/region/service line), configure hunt-group order
  - Webhook base URL and per-number webhook status/health check
  - Media Stream endpoint, recording on/off, fallback operator line number
- **AssemblyAI configuration:**
  - API key (stored encrypted, masked in the UI)
  - Streaming STT options: model/version, sample rate, confidence flag threshold (default 85%), language
  - TTS/Voice Agent options: voice selection, speech rate, auto-speak policy toggle (per agency policy)
  - Speech Understanding / Guardrails feature toggles (sentiment, PII redaction)
- **Console preferences:** hotkey bindings, auto-scroll default, distress-score thresholds, protocol library management, triage counter rules.
- **Save & automatic hot-reload:**
  - On **Save**, settings are validated, persisted (encrypted), and **hot-reloaded automatically** — the running system picks up the new configuration with **no service restart, redeploy, or operator action**.
  - The backend maintains a live configuration store; subscribing services (telephony gateway, STT/TTS pipeline, console) receive change events and rebuild their vendor clients/connections in the background, then atomically swap over.
  - **Active-call safety:** in-progress calls keep their existing Twilio stream and AssemblyAI session until hangup; the new configuration takes effect on the next call. Idle connections are recreated immediately.
  - **Health feedback:** after reload, the Settings page shows per-service apply status (`APPLIED • Twilio ✓ AssemblyAI ✓ 2s ago`) and the console header reflects the new connection state; a failed reload automatically **rolls back** to the last known-good configuration and alerts the admin.
  - Console-preference changes (hotkeys, auto-scroll, thresholds) hot-apply to connected operator consoles in real time via the live session channel — no page refresh.
- **Connection tests:** "Test Connection" buttons for both Twilio and AssemblyAI that validate credentials and report latency/status inline before saving.
- **Security:** API keys are write-only in the UI (never re-displayed), stored encrypted server-side, and every settings change is written to the audit log (FR-11) with actor and timestamp.
- **Validation:** invalid or unreachable credentials block saving with a clear error; saving is atomic (all-or-nothing) so a partial configuration can never be applied.

## 6. Twilio Integration Requirements (Telephony)

Twilio owns the phone layer: the pool of SOS mobile numbers and all call receiving ([Twilio Voice docs](https://www.twilio.com/docs/voice)).

| Area | Requirement |
|---|---|
| Number pool | **1…N Twilio-provisioned mobile numbers** serve as the public SOS lines: a **single number** is a valid minimal deployment, and the pool can grow to multiple numbers segmented by purpose (e.g., per agency/region/service line). Pool size is an admin setting; Admin UI to add/remove/repoint numbers without deployment |
| Per-number routing | Each number carries its own routing profile (which queue/protocol set it feeds); the dialed number is attached to the call card and can drive triage priority |
| Call receiving | Twilio Voice webhooks notify the backend on incoming calls to any pooled number; calls are answered programmatically (< 1 s) and connected to the AI pipeline |
| Media streaming | Twilio Media Streams fork bidirectional call audio over WebSocket to the voice pipeline (caller → AssemblyAI STT; AssemblyAI TTS / operator mic → caller); telephony audio (8 kHz μ-law) is transcoded to the 48 kHz PCM dual-stream used by the console; one stream per active call across all numbers |
| Failover & hunting | With ≥ 2 numbers, hunt groups roll calls over to the next number if one fails; with a single number, failover uses Twilio multi-region routing and the TwiML human-operator fallback. Per-number health surfaced in the console header |
| Recording | Twilio call recording enabled per agency policy on every number; recordings attached to Call History (FR-10) |
| Lifecycle | Call state events (ringing, answered, hangup, failed) per number drive call-card state in the console |
| Resilience | If the AI pipeline is unreachable, TwiML fallback routes the call directly to a human operator line |

## 7. AssemblyAI Integration Requirements (Voice AI)

AssemblyAI owns the voice-AI layer per its published APIs ([docs](https://www.assemblyai.com/docs)):

| Area | Requirement |
|---|---|
| STT | **Streaming Speech-to-Text API** — live audio over WebSocket, ~150 ms p50 latency; word-level timestamps and confidence scores; ≥ 3 concurrent streams |
| TTS | **Voice Agent API** (managed STT → LLM → TTS pipeline, ~1 s end-to-end) or direct TTS for protocol scripts and operator-typed instructions; synthesized speech injected back into the Twilio Media Stream; < 1 s time-to-first-audio |
| Speech understanding | **Speech Understanding API** powers FR-9 metadata extraction (summarization, sentiment → distress score, topic/intent detection) |
| Guardrails | **Guardrails API** for PII handling and content safety on stored transcripts |
| Integration path | AssemblyAI's documented **Twilio integration** (also LiveKit/Pipecat if the media layer changes) |
| Latency | STT partial results surfaced < 500 ms after speech; end-of-utterance finalization < 1 s |
| Resilience | On API degradation/outage: console falls back to operator-only mode (mic + manual notes), flags the call card, and queues audio for later transcription via the **Pre-recorded Speech-to-Text API** |
| Security | API keys stored server-side only, never in the client; all audio/transcripts TLS in transit and encrypted at rest |
| Cost control | Per-call stream lifecycle management (open on pickup, close on hangup) with concurrency caps and usage telemetry |

> **Vendor note:** Per the [AssemblyAI docs](https://www.assemblyai.com/docs), TTS is delivered through the Voice Agent API's managed speech-to-speech pipeline. Standalone TTS availability and voice options must be confirmed with the vendor for the "operator-typed text → speech" path (FR-5); the integration layer must abstract the voice vendor so a paired TTS provider can be swapped in without product changes if needed.

## 8. Non-Functional Requirements

- **Latency:** UI feedback sub-16 ms (per DESIGN.md "Zero Aesthetic Latency"); no layout reflow during active triage; dynamic numbers use tabular figures to prevent jitter.
- **Availability:** 99.95% for the console and voice pipeline; graceful degradation to operator-only mode.
- **Configuration hot-reload:** all Settings changes (FR-12) apply at runtime with zero downtime — no restarts or redeploys; reload completes < 5 s, never interrupts active calls, and rolls back automatically to the last known-good config on failure.
- **Security & compliance:** Encryption in transit/at rest; role-based access (operator / lead / supervisor); PII handling and audit logging consistent with CJIS-adjacent public-safety data practices.
- **Scalability:** Console supports 3 concurrent calls per operator at MVP; the Twilio number pool and backend voice pipeline must scale horizontally to agency call volume with headroom for major-incident surges.
- **Reliability:** Deterministic layout — panels must not jump or accordion during an active call.

## 9. UX Requirements

All UI must follow `DESIGN.md` ("Tactical Precision & High-Contrast Utilitarianism"):

- Hyper-dark tactical palette (`#0F131C` base) with functional signal colors: Red `#EF4444` strictly for life-safety triggers; Cyan `#06B6D4` for AI intelligence; Emerald `#10B981` for confirmed/healthy states; Amber `#F59E0B` for warnings.
- Inter for dialogue/body; JetBrains Mono for all telemetry, timestamps, coordinates, and confidence scores.
- 2–4 px corner radii; no circular actionable controls; no diffuse drop shadows — depth via tonal stratification and 1 px technical borders.
- Three-column layout: left incident queue (320 px), center incident stream (fluid), right dispatch command (420 px); 52 px master status bar.
- Keyboard-first operation: Ctrl+1/2/3 speak TTS, Space barge-in PTT, Shift+Enter confirm dispatch.

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| AssemblyAI standalone TTS gap (TTS ships inside the Voice Agent API pipeline) | FR-5 custom-text path may need adaptation | Confirm standalone TTS with vendor; abstract voice-vendor layer; swappable paired TTS provider as contingency |
| Twilio outage / number unreachable | SOS calls not received | Multi-number pool with hunt-group rollover, Twilio multi-region failover, TwiML fallback routing to human operator line |
| STT errors in noisy emergency audio | Wrong protocol match | Word-level confidence flagging, human-in-the-loop confirmation, no auto-speak by default |
| AI hallucinates unsafe guidance | Life-safety risk | Suggestions constrained to a curated protocol library; operator must trigger speech; full audit trail |
| Voice pipeline outage | Loss of AI assistance | Operator-only fallback mode, per-call status flags, queued re-transcription |
| API key leakage / misconfiguration (Twilio or AssemblyAI) | Toll fraud, data exposure, service outage | Write-only masked keys in Settings (FR-12), encrypted at rest, server-side only, audit-logged changes, connection test before save |
| Operator over-trust of AI | Delayed human intervention | Confidence scores always visible; barge-in always one keypress away; training requirement |

## 11. Open Questions

1. **AssemblyAI TTS path:** for operator-typed custom text (FR-5), does AssemblyAI expose standalone TTS outside the Voice Agent API pipeline? Confirm voice options, streaming injection latency, and pricing with the vendor.
2. Auto-speak policy: may the AI ever speak without an operator trigger (e.g., immediately on pickup)? Regulatory/agency sign-off needed.
3. ~~Telephony integration~~ — **resolved:** Twilio provides SOS mobile numbers, call receiving, and Media Streams; AssemblyAI's documented Twilio integration is the reference path.
4. Data retention period and CJIS certification path for stored call audio/transcripts (Twilio recordings + AssemblyAI transcripts).
5. Distress score model: rules-based v1 vs trained model; validation dataset source.
6. Twilio number pool strategy: start with a single number or multi-number pool? If pooled, how many numbers per segment (agency/region/service line)? Dedicated SOS short code vs standard mobile numbers; local vs toll-free; E911/location-registration obligations for each number in the pool.

## 12. Milestones

- **M1 — Telephony + Live STT Console (P0 core):** Twilio numbers and call receiving with Media Streams, multi-call cards, AssemblyAI streaming STT, dual-channel transcripts with confidence flagging, triage queue, barge-in, **Settings page with Twilio/AssemblyAI config and API key management**.
- **M2 — AI Suggestions + TTS:** protocol suggestion engine, Speak via AI TTS + custom TTS field (AssemblyAI Voice Agent API), TTS preview, hotkeys.
- **M3 — Dispatch, History & Audit:** unit assignment grid, dispatch confirm, panic broadcast, GIS radar, Call History with detail/playback/export (FR-10), tamper-evident Audit Logs (FR-11).
