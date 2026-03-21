# Daily Development Changelog

Summaries of work completed each session. Most recent first. Only the last 5 waves are detailed — older entries are one-liners (see git history for full details).

---

## 2026-03-21 (code quality + tests + P2 features)

### Wave 46: Code Quality, Unit Tests & P2 Features (3 workers, 3 tasks)

**Worker 1 — task-001: Code Quality Fixes:**
- SLA permission fix: `createSLAPolicy`/`updateSLAPolicy`/`deleteSLAPolicy` now use `requirePermission('MANAGE_PROJECT_SETTINGS')` instead of basic `requireProjectAccess`.
- Removed 3 `context.prisma as unknown as PrismaClient` double casts in auth.ts — changed `trackRefreshToken` parameter type to `Context['prisma']`.
- AppLayout `fetchCount` lint warning fixed — 0 lint warnings remaining across entire codebase.
- Sentry web frontend integration: `@sentry/react` installed, `Sentry.init()` in production with `VITE_SENTRY_DSN`, `ErrorBoundary.componentDidCatch` calls `Sentry.captureException`.

**Worker 2 — task-002: Unit Test Suites (35 new tests):**
- `cyclicDependencyCheck.test.ts` — 8+ tests: self-loops, direct/indirect cycles, non-blocking type exclusion, `is_blocked_by` normalization, multiple proposed edges.
- `urlValidator.test.ts` — 8+ tests: valid URLs, localhost variants, private IP ranges, blocked ports, protocol restrictions. DNS resolution mocked.
- `insightGeneration.test.ts` — 5+ tests: insight generation called after `generate_code`, skipped for other types, non-blocking on failure, TaskInsight record creation.

**Worker 3 — task-003: P2 Features:**
- Monte Carlo sprint forecasting: `sprintForecast` query, `monteCarloForecast.ts` pure simulation function, `SprintForecastPanel.tsx` with probability gauge + percentile table (50th/75th/90th/95th). Only renders with >= 3 closed sprints.
- Scheduled automation triggers: `cronExpression`, `timezone`, `nextRunAt`, `lastRunAt` fields on AutomationRule. `cronScheduler.ts` checks due rules every 60s via `setInterval`. `cron-parser` package for expression parsing. AutomationTab schedule section with presets (hourly, daily, weekly) and timezone selector.

**Process:** All 3 tasks merged. Reviewer encountered squash merge issue (deleting files from previously-merged tasks when worker branch diverged) — worked around with `git cherry-pick --no-commit`.

**Open follow-ups:**
- Monte Carlo forecast edge case tests
- Sentry ErrorBoundary initialization guard
- Automation rule validation: enforce cronExpression on scheduled triggers
- Cron scheduler graceful shutdown (track active promises)
- SprintForecastPanel loading state (use skeleton loader)
- merge-worker.sh: fix squash merge to use cherry-pick when diverged

---

## 2026-03-21 (P1 features + polish + L-5)

### Wave 45: P1 Features, Polish & Session Limit (5 workers, 6 tasks)

**Worker 1 — task-001 + task-002: Multi-Action Automation Rules:**
- Backend: automation engine now processes action arrays (backward-compatible with single objects). 4 new action types: `send_webhook` (validated URL + webhookDispatcher), `add_label` (TaskLabel, skip if exists), `add_comment` (Comment record), `set_due_date` (daysFromNow calculation).
- Compound conditions: `matchesCondition()` supports `{operator: "AND"|"OR", conditions: [{field, op, value}]}` in addition to simple `{key: value}`.
- Zod validation for action types in createAutomationRule/updateAutomationRule resolvers.
- Frontend: AutomationTab multi-action builder (dynamic add/remove rows, 8 action types with appropriate inputs), compound condition builder (AND/OR toggle, field/op/value rows).

**Worker 2 — task-003: SLA Tracking (Full Vertical Slice):**
- New `SLAPolicy` model (projectId, name, responseTimeHours, resolutionTimeHours, priority filter, enabled) and `SLATimer` model (taskId, policyId, startedAt, respondedAt, resolvedAt, responseBreached, resolutionBreached).
- Migration: `add_sla_tracking`.
- CRUD resolvers with permission checks. `taskSLAStatus` query returns timers with computed time-remaining fields.
- `slaListener.ts`: creates timers on task.created, updates on status transitions (start→in_progress, respond→in_review, resolve→done), checks breach flags.
- Frontend: `SLAStatusBadge.tsx` (green/amber/red) in task detail, SLA policy management in project settings.

**Worker 3 — task-004: Backend Polish:**
- TaskInsight sourceTask/targetTask field resolvers now use `context.loaders.taskById.load()` — eliminates N+1 queries.
- `refreshRepoProfile` creates/updates `KnowledgeEntry` with source='learned' instead of only writing to legacy `project.knowledgeBase` field (backward compat preserved).
- ManualTaskSpec acceptanceCriteria: removed unsafe double cast, uses direct property access.

**Worker 4 — task-005: Frontend Polish:**
- HierarchicalPlanEditor: `setExpandedIds` lint warning fixed (lazy initializer instead of effect). Lint warnings reduced from 3 to 1.
- Extracted ~3 inline dynamic mutations from useTaskOperations.ts to `buildUpdateTaskMutation()` in queries.ts.
- Insight duplicate fetch eliminated: TaskDetailPanel passes loaded insights to InsightPanel as initial data.
- OnboardingWizard: Enter/Ctrl+Enter advances steps, Escape closes, auto-focus on primary inputs.

**Worker 5 — task-006: L-5 Concurrent Session Limit:**
- New `RefreshToken` model (userId, tokenHash, expiresAt, userAgent) in auth.prisma. Migration: `add_refresh_tokens`.
- Login/acceptInvite/verifyEmail create RefreshToken records with hashed tokens.
- Max 5 concurrent sessions per user (configurable via `MAX_SESSIONS_PER_USER`). Oldest sessions pruned on new login.
- Refresh endpoint (`/api/auth/refresh`) validates token exists in DB, implements token rotation (delete old, create new).
- Logout deletes specific RefreshToken record.
- Expired token cleanup on server startup.

**Process:** All 6 tasks merged with zero rejections. 44 pre-existing test failures on main (not from this wave) prevented test validation in merge pipeline.

**Open follow-ups:**
- Fix 44 pre-existing integration test failures (FK/DB state issues)
- Remove `context.prisma as unknown as PrismaClient` casts in auth.ts (3 instances)
- SLA: createSLAPolicy should use requirePermission('MANAGE_PROJECT_SETTINGS')
- SLA: periodic breach-check job (currently only on status transitions)
- SLA: paused time handling (reopened tasks, business hours)
- AppLayout fetchCount lint warning (last remaining)

---

## 2026-03-21 (security cleanup + tests + polish)

### Wave 44: Security Cleanup, Integration Tests & Auth Follow-ups (3 workers, 5 tasks)

**Worker 1 — task-001: Remaining Security Fixes (M-4, L-6, L-11):**
- M-4: File upload magic byte validation via `file-type@16.5.4`. Validates uploaded file content against declared MIME type; rejects mismatches with 400. Text files (no magic bytes) skip validation.
- L-6: Unicode homograph detection — `hasHomoglyphRisk()` rejects filenames mixing Latin with Cyrillic/Greek scripts.
- L-11: Null byte stripping middleware added before all REST routes in app.ts via `stripNullBytes()` on req.body and req.query.

**Worker 1 — task-002: Data Migration Scripts:**
- `apps/api/scripts/migrate-encrypt-secrets.ts` — encrypts plaintext webhook secrets and Slack URLs using `encryptApiKey()`, skips already-encrypted values.
- `apps/api/scripts/migrate-hash-invite-tokens.ts` — hashes plaintext invite tokens via `hashToken()`, requires `--confirm` flag (warns about invalidating active invites).
- Both scripts load `.env` for DATABASE_URL and ENCRYPTION_MASTER_KEY.

**Worker 2 — task-003: Security Integration Tests (~19 tests):**
- New `security.integration.test.ts` covering 8 test groups:
  - Cookie auth flow (login sets cookies, logout clears, refresh works, revoked token rejected)
  - CSRF protection (403 without X-Requested-With, 200 with it)
  - AI rate limiter (throws when over limit, passes when under)
  - Audit logging (Activity records for setOrgApiKey, inviteOrgMember)
  - Email anti-enumeration (signup returns same response for existing email)
  - Export email redaction (?redactEmails=true masks emails)
  - Bulk update cap (101 items throws ValidationError)
  - Input validation (sprint name >200, label name >100 rejected)

**Worker 3 — task-004: Auth Follow-ups:**
- `verifyEmail` mutation now sets HttpOnly cookies (tt-access, tt-refresh) on success — auto-login after email verification.
- New `VerifyEmailResult` type in typedefs/auth.ts returning `{ success, token }`.
- Frontend VerifyEmail page handles new response — redirects to `/app` on success.
- `SessionExpiredModal` — replaces hard redirect to /login on refresh failure. Dispatches `session-expired` CustomEvent from client.ts, AuthProvider listens and shows modal overlay.

**Worker 3 — task-005: Frontend Polish:**
- Permission-based field disabling in TaskDetailPanel — fields disabled when user lacks EDIT_TASKS permission via existing PermissionContext.
- SavedViewPicker lint warnings fixed (lines 43, 58) — reduced total warnings from 5 to 3.
- BacklogView keyboard navigation — Enter/Space to select task, Arrow Up/Down to navigate, ARIA roles (listbox/option).

**Process:** All 5 tasks merged cleanly. No issues logged.

**Open follow-ups:**
- Run data migration scripts in production (migrate-encrypt-secrets.ts, migrate-hash-invite-tokens.ts)
- L-5 (concurrent session limit) still open — needs RefreshToken model design
- L-12 (test DB credentials in CI) — CI config, not code
- Integration tests for verifyEmail cookie-setting (new behavior)

---

## 2026-03-21 (security phase 3+4)

### Wave 43: Security Phase 3+4 — Medium & Low Fixes (3 workers, 4 tasks)

**Worker 1 — task-001: GraphQL Security Hardening (M-1, M-5, M-8, L-8):**
- M-1: Disabled GraphQL introspection in production via `NoSchemaIntrospectionCustomRule` from `graphql` package, conditionally added when `NODE_ENV=production`. GraphiQL UI also disabled in prod.
- L-8: Reduced depth limit from 10 to 7 in `depthLimitRule()`.
- M-5: Scoped DataLoaders by orgId — changed `createLoaders(prisma)` to `createLoaders(prisma, orgId)`. Added orgId filtering to 8 loaders (taskById, projectById, sprintById, userById, taskChildren, taskProgress, sprintTasks, knowledgeEntriesByProject). Join-table loaders skipped (documented as defense-in-depth via parent entity validation). Context.ts restructured to create loaders after user is determined.
- M-8: Added orgId validation to `updateFilter` and `deleteFilter` — queries now include `project: { orgId: user.orgId }` in WHERE clause.

**Worker 2 — task-002: Export, Webhook & Input Validation (M-3, M-7, M-9, M-10, L-7):**
- M-3: Sanitized Content-Disposition filenames via `sanitizeFilename()` — strips non-alphanumeric chars, caps at 100 chars. Applied to all 4 export endpoints.
- M-7: Added `?redactEmails=true` query param to export endpoints — masks emails as `u***@domain.com`. Default behavior unchanged (full emails).
- M-9: Added Zod input validation schemas for 5 mutations lacking them: `CreateSprintInput`, `CreateLabelInput`, `CreateCustomFieldInput`, `CreateKnowledgeEntryInput`, `CreateAutomationRuleInput`. Wired via `parseInput()` in respective resolvers.
- M-10: Added `X-Webhook-Delivery-ID` header (delivery UUID) to outgoing webhook requests in `webhookDispatcher.ts`.
- L-7: Added 100-item cap to `bulkUpdateTasks` — throws `ValidationError` if `taskIds.length > 100`.

**Worker 3 — task-003: AI Rate Limiting + Audit Logging (M-2, M-6):**
- M-2: Created `utils/aiRateLimiter.ts` — counts `AIPromptLog` entries per org in last hour, throws if exceeding limit (default 60/hour, configurable via `AI_RATE_LIMIT_PER_HOUR`). Wired into `callAndParse` in aiService.ts before AI API call.
- M-6: Created `utils/auditLog.ts` — fire-and-forget Activity creation for sensitive ops. Added to: `setOrgApiKey`, `setAIBudget`, `inviteOrgMember` (org.ts), `revokeInvite`, `logout` (auth.ts). Failures caught and logged, never break the operation.

**Worker 3 — task-004: Auth & Low Fixes (L-2, L-3, L-4, L-10):**
- L-2: Signup returns identical response whether email exists or not — prevents email enumeration. Verification email only sent for new accounts. Updated integration test that previously asserted `ConflictError` for duplicates.
- L-3: URL-encoded GitHub file path segments in API calls (`path.split('/').map(encodeURIComponent).join('/')`).
- L-4: ErrorBoundary `console.error` now dev-only (`import.meta.env.DEV`). Production errors silently caught (Sentry frontend not yet configured).
- L-10: Disabled Anthropic SDK auto-retries (`maxRetries: 0`) and/or capped any Retry-After parsing to 3600 seconds max.

**Process:** 3 independent tasks merged on first try with no conflicts. task-004 rejected once — worker changed signup behavior without updating the existing test that asserted the old behavior. Fixed and re-merged with ~5 min delay.

**Open follow-ups:**
- Integration tests for AI rate limiter, audit logging, email anti-enumeration, export redaction, bulk cap
- M-7: Consider making email redaction default with admin opt-out
- Sentry frontend integration for ErrorBoundary (currently just suppresses console.error in prod)
- AI rate limiter uses COUNT query per request — consider in-memory cache for high-throughput orgs
- Anthropic SDK maxRetries=0 disables automatic retry on transient errors — consider app-level retry with capped backoff

---

## 2026-03-21 (security phase 2)

### Wave 42: Security Phase 2 — Auth Hardening (3 workers, 5 tasks)

**Worker 1 — H-1 Backend + Frontend (task-001, task-002):**
- JWT migration from localStorage to HttpOnly cookies: 15-min access token + 7-day refresh token with rotation
- `POST /api/auth/refresh` endpoint with hashed refresh token storage (`RefreshToken` model concept via tokenVersion)
- Cookie options: `HttpOnly`, `Secure` (prod), `SameSite=Strict`, `Path=/api`
- CSRF protection: middleware on `POST /graphql` requires `X-Requested-With` header (403 without)
- Frontend: removed localStorage token storage, `gql()` sends `X-Requested-With: XMLHttpRequest`, credential: 'include'
- Auto-refresh: `client.ts` intercepts 401, calls `/api/auth/refresh`, retries original request (once)
- `useEventSource.ts` updated to use cookie auth (removed token query params)
- `context.ts` reads `access_token` cookie with `Authorization` header fallback

**Worker 2 — H-6: Pagination Caps (task-003):**
- `Math.min(limit, 100)` enforced on all list query resolvers across task, sprint, comment, notification, report, webhook, slack, knowledge base, search, AI prompt history, and release queries
- Consistent capping pattern: resolvers clamp user-provided limit before passing to Prisma

**Worker 3 — H-3 + H-4 + H-9 + H-10 + H-12 (task-004, task-005):**
- Webhook secrets encrypted at rest via AES-256-GCM (`encryptField`/`decryptField` in encryption.ts)
- Slack webhook URLs encrypted at rest, masked in query responses
- Invite tokens hashed with SHA-256 before DB storage (`hashToken()` in encryption.ts)
- `acceptInvite` resolver compares against hashed token
- Advisory lock SQL migrated from `$queryRawUnsafe` to `$queryRaw` tagged template literals
- `setOrgApiKey` mutation requires `confirmPassword` argument for re-authentication

**Process:** All 5 tasks merged cleanly with zero rejections. Worker-1 handled two sequential tasks (backend then frontend) on same branch — squash merge correctly deduped.

**Security findings resolved:** H-1, H-2, H-3, H-4, H-6, H-9, H-10, H-12 (all 8 remaining High items). Also resolves L-1 (JWT expiry) and L-9 (SameSite cookie).

**Open follow-ups:**
- Data migration scripts needed: encrypt existing plaintext webhook secrets/Slack URLs, hash existing invite tokens
- Signup mutation should also set HttpOnly cookies (currently only login and resetPassword do)
- Integration tests for cookie-based auth flow and CSRF protection
- Auto-refresh loop protection: failed refresh redirects to /login, could lose unsaved work
- L-5 (concurrent session limit) now feasible with tokenVersion + refresh tokens

---

## Older Entries (one-line summaries)

- **2026-03-20** — Wave 41: Execution dashboard (plan list, stat cards, SSE real-time), insight review UI + toast notifications, manual task specs + auto-start project.
- **2026-03-20** — Wave 40: Status-driven events (action_plan_failed, task.blocked/unblocked), TaskInsight model + AI generation hook, CI monitor + auto-fix executors.

- **2026-03-20** — Wave 39: Project orchestrator (parallel execution, advisory locks, concurrency limit), AI-enriched PR descriptions, plan dependency editor wiring, HierarchicalPlanDialog feedback.
- **2026-03-20** — Wave 38: Hierarchical plan generation (3-level epics→tasks→subtasks), batch cycle detection, plan editor UI (tree view, drag-to-reorder, dependency picker).

- **2026-03-20** — Wave 37: KB panel (CRUD + file upload), onboarding interview wizard, KB context injection into action pipeline.
- **2026-03-20** — Wave 36: KnowledgeEntry model + CRUD, AI-based KB retrieval, autoComplete flag + informs link type.
- **2026-03-20** — Wave 35: Critical security fixes (C-1 through C-5, H-5/H-7/H-8/H-11) — token revocation, multi-tenant isolation, SSRF protection.
- **2026-03-20** — Wave 34: Query centralization (~90 inline→queries.ts), ARIA audit + TaskDetail tabs, permission scheme (22 permissions).
- **2026-03-20** — Waves 31-33: Task watchers, WIP limits, release model, cumulative flow chart, time tracking, saved views, multi-level hierarchy, user capacity, compound filters.
- **2026-03-19** — Waves 28-30: codebase cleanup (dead code, decomposition), dependency graph, cycle time metrics, server-side filtering, workflow transitions, kanban swimlanes.
- **2026-03-17** — Waves 22-27: GitHub integration (repo linking, PR creation, issue decomposition), Slack integration, webhook system, notification preferences, dark mode, PWA, S3 file attachments, responsive layout, SSE real-time.
- **2026-03-16** — Waves 14-21: Sentry integration, lazy loading, code splitting, unit/integration tests, CI pipeline, file attachments, recurring tasks, accessibility audit, shared-types package, action plan pipeline improvements.
- **2026-03-14** — Waves 8-13: AI code generation, GitHub PR creation, action plan pipeline, AI caching, prompt logging, task templates, multiple assignees, custom fields, saved filters, Prometheus metrics, structured logging.
- **2026-03-13** — Waves 4-7: Sprint model, kanban board, backlog view, AI task planning, notification system, SSE real-time events, comment @mentions, project export (CSV/JSON).
- **2026-03-12** — Waves 1-3: Initial build. Express + graphql-yoga + Prisma setup, HMAC JWT auth, React frontend, task CRUD, project CRUD, org management, security hardening (helmet, CORS, rate limiting), generation UX (skeletons, progress, abort).
