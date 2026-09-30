---
name: Tactical Emergency Dispatch Console
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353943'
  surface-container-lowest: '#0a0e17'
  surface-container-low: '#181b25'
  surface-container: '#1c1f29'
  surface-container-high: '#262a34'
  surface-container-highest: '#31353f'
  on-surface: '#dfe2ef'
  on-surface-variant: '#e4beba'
  inverse-surface: '#dfe2ef'
  inverse-on-surface: '#2c303a'
  outline: '#ab8986'
  outline-variant: '#5b403e'
  surface-tint: '#ffb3ad'
  primary: '#ffb3ad'
  on-primary: '#68000a'
  primary-container: '#ff5451'
  on-primary-container: '#5c0008'
  inverse-primary: '#b91a24'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00a572'
  on-tertiary-container: '#00311f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad7'
  primary-fixed-dim: '#ffb3ad'
  on-primary-fixed: '#410004'
  on-primary-fixed-variant: '#930013'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0f131c'
  on-background: '#dfe2ef'
  surface-variant: '#31353f'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
    letterSpacing: 0.06em
  telemetry-data:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.5rem
  margin: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.375rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system is engineered for mission-critical emergency dispatch terminals, public safety answering points (PSAPs), and AI-augmented crisis operators. In life-or-death scenarios where fractions of a second matter, the user interface acts as an extension of the operator’s nervous system. 

The aesthetic is grounded in **Tactical Precision & High-Contrast Utilitarianism**. It discards whimsical decoration, heavy blur effects, and frivolous animations in favor of instantaneous cognitive parseability, rigorous information density, and unambiguous visual state anchoring.

### Personality & Tone
- **Imperative & Calm:** The UI maintains structural order under extreme stress. Deep tactical backdrops reduce retinal fatigue across long 12-hour shifts.
- **Instantaneous Comprehension:** Critical statuses (Cardiac Arrest, Fire In-Progress, Active Shooter, Line Drop) immediately arrest operator attention through razor-sharp chromatic hierarchy, while non-critical ambient telemetry stays recessed.
- **Reliable & Authoritative:** Machine-speed AI inferences (real-time speech-to-text, translation, sentiment, dynamic dispatch suggestions) are presented with clear confidence metrics, keeping human judgment in command.

### Design Principles
1. **Zero Aesthetic Latency:** Visual feedback must be instantaneous (sub-16ms transitions). No slow spring physics or non-functional decorative transforms.
2. **Deterministic Layout:** Spatial stability is non-negotiable. Panels must not jump, accordion unexpectedly, or reflow during active triage.
3. **Ergonomic Density:** Information is packed tightly using micro-borders, inline badges, and tabular telemetry, maximizing screen real estate on dual- and triple-monitor desktop configurations.

## Colors

The palette is tuned specifically for low-light command centers and high-stress cognitive loads. It uses a hyper-dark charcoal/zinc foundation punctuated by functional signal accents.

### Core Roles
- **Primary (`#EF4444` - Emergency Red):** Reserved strictly for life-safety triggers: Active SOS, Code-3 dispatches, dropped 911 lines, severe caller distress flags, and critical system interrupts. Never used for benign destructive actions like "Clear search".
- **Secondary (`#06B6D4` - Cyan / Signal Blue):** Represents AI-augmented intelligence: live streaming automated speech-to-text (STT), suggested dispatch responses, caller sentiment extraction, and prompt injection suggestions.
- **Tertiary (`#10B981` - Tactical Emerald):** Designates confirmed status, active biometric links, healthy AI call synthesis (TTS), live GPS pings, and established agency handoffs (EMS/Fire en route).
- **Warning / Priority (`#F59E0B` - Amber Alert):** Indicates holding queues, deteriorating latency, escalating caller agitation, and unassigned secondary alerts.
- **Neutral (`#090D16` - Deep Tactical Zinc):** The root background. Accompanied by stepped surface tiers (`#0F172A`, `#1E293B`, `#334155`) to establish depth without soft diffuse shadows.

### Contrast & Functional Tinting
Backgrounds feature a dedicated 1-to-2% cold blue/slate bias to prevent stark, eye-straining pitch-black contrast. Pure white (`#FFFFFF`) is reserved for primary caller utterances and vital telemetry data, while metadata (timestamps, cell tower IDs, packet latency) sits at `#94A3B8`.

## Typography

Typography in this system serves two distinct operational vectors: linguistic comprehension (caller/operator dialogue) and high-density telemetry (coordinates, network packet loss, timestamps, audio decibel levels).

### Type Pairing Rationale
- **Inter (Primary & Body):** Chosen for its tall x-height, unambiguous letterforms, and supreme legibility under glance conditions. It handles all caller transcripts, dispatch incident notes, and operational controls.
- **JetBrains Mono (Telemetry & Labels):** Applied to all technical, temporal, and spatial figures. Numerical data (GPS coordinates, caller phone numbers, elapsed call timers, audio waveform decibels, confidence scores) renders in tabular monospaced format to prevent layout jitter as numerical strings change dynamically.

### Legibility Rules
- Never use font weights below `400`. Hairline typography drops off under standard tactical displays and glare.
- All numbers indicating dynamic countdowns, lat/long updates, or confidence percentages must employ tabular numbers (`tnum` font feature setting).
- Dynamic speech-to-text text streams use `body-lg` with a slightly bumped line height (`24px`) to preserve readability when streaming at speeds up to 220 words per minute.

## Layout & Spacing

The layout is built for multi-window desktop operator consoles (typically 1440p to 4K ultra-wide setups). It prioritizes deterministic density over expansive whitespace.

### Structural Architecture
- **Master Multi-Call Status Bar (Top):** Fixed 52px header displaying system operational readiness, active concurrent incoming queues, network jitter, radio gateway links, and immediate emergency triage tabs.
- **Three-Column Tactical Split-Screen (Body):**
  1. **Left (Incident Queue & Triage, 320px fixed):** Incoming lines, priority sorting (Code 3 vs Code 1), caller state, automated AI pre-screen triage badges.
  2. **Center (Primary Incident Stream, fluid):** Split vertically into real-time dual-channel audio waveform/transcript (Caller vs AI/Operator) on top, and AI-assisted action suggestions & TTS generator below.
  3. **Right (Dispatch Command & Context, 420px fixed):** Live GIS mapping, precise GPS telemetry with accuracy radius, CAD (Computer-Aided Dispatch) integration, rapid unit assignment (Police, Fire, EMS), and automatic health profile retrieval.

### Spacing Philosophy
Compact micro-rhythms (`space-xs` and `space-sm`) define the internal padding of indicators, telemetry cells, and quick-action trigger buttons, guaranteeing that operators can absorb an entire incident landscape without vertical page scrolling.

## Elevation & Depth

This system intentionally rejects diffuse ambient drop shadows. Heavy drop shadows smudge information boundaries, degrade contrast on military-spec monitors, and introduce visual clutter.

Depth is achieved via **Tonal Stratification and Low-Contrast Technical Borders**:
- **Canvas (Level 0):** Pure base tone (`#090D16`), housing global structural grid dividers.
- **Panels & Modules (Level 1):** `#0F172A` with a crisp 1px structural stroke (`#1E293B`).
- **Interactive Cells & Transcriptions (Level 2):** `#1E293B` with inline separator borders.
- **Active Focus & High-Alert Overlays (Level 3):** `#182234` paired with hard, 1px perimeter glow highlights in `#EF4444` (Emergency SOS) or `#06B6D4` (AI In-Focus).

When modals or interruptive call takeovers are triggered, a semi-transparent scrim (`rgba(4, 7, 13, 0.85)`) isolates the module, backed by a direct 1px sharp alert boundary rather than a soft shadow plume.

## Shapes

The design system employs a **Soft Technical (`1`)** shape language (radii scaling strictly between `2px` and `4px`). 

- Standard action tiles, telemetry cards, and multi-call queue tabs utilize `2px` to `4px` corner radii.
- Circular shapes are strictly forbidden for actionable interface controls; full pills (`rounded-full`) are reserved solely for live status indicator pips (e.g., active recording dot, streaming agent connectivity status, triage urgency badges).
- This squared-off, precision-machined geometry conveys operational durability, maximizes internal text container bounds, and seamlessly aligns with dense data grids.

## Components

### 1. Action Trigger Buttons
- **Dispatch Emergency Buttons (Code-3):** Solid `#EF4444` surface with crisp white bold Inter labels. On hover/active, the button features a high-intensity red outline with zero vertical travel.
- **AI Suggested Response Send:** Deep cyan-tinted ghost button (`rgba(6, 182, 212, 0.1)`) bordered by `#06B6D4`. Includes a keyboard shortcut badge pinned to the right edge (e.g., `Ctrl + 1`).
- **TTS Preview & Intercept:** Minimal secondary button featuring a waveform play glyph, allowing dispatchers to audition synthesized guidance before injecting into the caller audio stream.

### 2. Live Audio Transcript Stream (Dual Channel)
- Separate visual tracks for "Caller" (left-aligned, subtle neutral boundary) and "AI Agent / Operator" (right-aligned, cyan-accented track).
- Words stream with an animated underline indicator. Real-time words under 85% speech recognition confidence are flagged with a dotted warning underline (`#F59E0B`) to prompt operator clarification.

### 3. Telemetry Chips & Confidence Badges
- Constructed with `JetBrains Mono`, featuring an internal indicator pip.
- **AI STT Accuracy:** Monospaced pill displaying confidence rating (e.g., `CONF: 98.4%` in `#10B981`, dipping to `#EF4444` below 70%).
- **Caller Latency & Speed:** Real-time speech cadence monitor (e.g., `184 WPM | LAT: 42ms`).

### 4. CAD Dispatch Action Grid
- Rapid multi-unit dispatch selector configured as a dense segmented matrix: `[EMS - AMB 14]`, `[FIRE - ENG 02]`, `[POLICE - UNIT 404]`.
- Single-click activates stage 1 staging; long-press or keyboard modifier (`Shift + Enter`) triggers final hardware-assisted broadcast.

### 5. Multi-Call Concurrent Monitor Bar
- Horizontal tabs representing concurrent callers. Each card features:
  - Incident Code (e.g., `10-79 BOLO`, `911-STR-FIRE`)
  - Elapsed Time Counter in tabular numerals
  - Audio VU meter micro-bar for sound activity detection
  - Triage Priority Border (Red = Active Unassigned Crisis, Amber = AI Screen In-Progress, Green = Handled/Assigned).