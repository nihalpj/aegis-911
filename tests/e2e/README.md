# AEGIS-911 — E2E Tests (Playwright)

End-to-end smoke suite for the dispatch console. Specs live next to
`playwright.config.ts` (`*.spec.ts`).

## Setup

```bash
# From the repo root — installs the tests/e2e workspace (Playwright)
npm install

# One-time: download the Chromium browser (+ OS deps)
npm run e2e:install --workspace tests/e2e
```

## Running

The suite expects the web console at `http://localhost:5173`. If the app
isn't running, every test **skips gracefully** instead of failing, so this is
safe to run at any time.

```bash
# Terminal 1 — infra + app
npm run infra:up
npm run dev                 # apps/web on :5173

# Terminal 2 — tests
npm run test:e2e            # headless
npm run e2e --workspace tests/e2e -- --headed   # watch the browser
npm run e2e:ui --workspace tests/e2e            # Playwright UI mode
```

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:5173` | Point the suite at a different deployment |
| `WEB_PORT` | `5173` | Port used to derive the base URL |

Reports/traces land in `tests/e2e/artifacts/` and `playwright-report/`
(git-ignored).

## Current coverage

- **Smoke:** console page loads, top command header renders the `AEGIS-911`
  brand and the triage stats strip. Per IMPLEMENTATION_PLAN §11, this grows
  into the full console flow (pickup → transcript → suggest → TTS →
  barge-in → dispatch) as M1/M2 land.
