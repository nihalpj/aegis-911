# AEGIS-911 — AI SOS Call Attending & Emergency Dispatch Console

AI-augmented emergency dispatch console: one operator supervises multiple concurrent SOS calls while an AI agent answers, transcribes (AssemblyAI Streaming STT), suggests emergency protocols, and speaks guidance back (AssemblyAI TTS) over Twilio-provisioned SOS numbers.

- Product spec: [docs/PRD.md](docs/PRD.md)
- Technical plan: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- UI reference: `reference/` (DESIGN.md design system, code.html static prototype, screen.png mockup)

## Monorepo layout

```
apps/
  server/   # Node 22 + Fastify + TypeScript: api-gateway, media-gateway, ai-orchestrator, realtime-gateway, config-service
  web/      # React 18 + Vite + Tailwind: operator console, call history, audit logs, settings
packages/
  shared/   # shared types & config schemas
infra/      # docker-compose, env templates
```

## Quick start

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) §13 (Deployment & Environments).
