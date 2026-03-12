# Cost Tracking

## Infrastructure (Current — MVP, local dev)

| Service | Cost | Notes |
|---|---|---|
| PostgreSQL | $0 | Docker, local |
| API hosting | $0 | Local dev only |
| Web hosting | $0 | Local Vite dev server |

**Total current monthly:** $0

---

## AI Usage (TaskToad App — Anthropic API)

### Model used: `claude-haiku-4-5-20251001`
All AI features (project generation, task planning, expand task, task instructions) use Haiku.
Switched from `claude-opus-4-6` on 2026-03-11 to reduce per-call cost ~20×.
Upgrade to `claude-sonnet-4-6` in `apps/api/src/graphql/ai.ts` if output quality is insufficient.

### Per-operation `max_tokens` budget
| Operation | max_tokens | Rationale |
|---|---|---|
| `generateProjectOptions` | 512 | 3 short items |
| `generateTaskPlan` | 4096 | 4–8 detailed tasks |
| `expandTask` | 2048 | 2–5 subtasks |
| `generateTaskInstructions` | 1024 | single task instructions |

### Usage logging
Every call logs: `[AI] model=... in=N out=N stop=...` to stdout for monitoring.

### API key storage
Per-org: `orgs.anthropic_api_key` (Postgres). Users bring their own key — no shared key.

---

## AI Usage (Claude Code)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|---|---|---|
| Claude Opus 4.6 | $15 | $75 |
| Claude Sonnet 4.6 | $3 | $15 |
| Claude Haiku 4.5 | $0.80 | $4 |

*Prices as of early 2026 — verify at console.anthropic.com*

---

## Deployment Options (Future)

### Cheap / hobby tier

| Option | Estimated Monthly |
|---|---|
| Railway (API + Postgres) | ~$5–10 |
| Render (free tier) | $0 (cold starts) |
| Fly.io (shared CPU) | ~$3–5 |
| Vercel (web) | $0 (hobby) |

### Production tier

| Option | Estimated Monthly |
|---|---|
| AWS RDS (t3.micro) | ~$15 |
| ECS Fargate (minimal) | ~$10–20 |
| Vercel Pro | $20 |

---

## Notes

- No paid services are currently in use
- Update this file when deployment begins
