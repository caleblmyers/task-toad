# Daily Development Changelog

Summaries of work completed each session. Most recent first.

---

## 2026-03-17 (cont.)

### Wave 26: Final Polish (3 workers, 3 tasks)

**Worker 1 — Focus Traps:**
- Extracted `useFocusTrap` hook from Modal.tsx — reusable Tab/Shift+Tab wrapping + focus save/restore
- Applied to mobile drawer (AppLayout), template overlay, export overlay (ProjectToolbar), and NotificationCenter
- Modal.tsx refactored to use the new hook (no duplicated logic)

**Worker 2 — Responsive Layout:**
- ProjectToolbar: view toggle icons-only below sm, search hidden below sm, breadcrumb truncates, toolbar wraps
- TaskDetailPanel: full-screen overlay drawer below md with backdrop + close button, desktop unchanged (440px sidebar)

**Worker 3 — Design System + DX:**
- Badge `pink` variant added (8 total variants)
- DependencyBadge, KanbanBoard (column pills + task cards), SprintSection (assignee), CodePreviewModal (subtask) migrated to Badge/Card
- `useAsyncData` hook created and adopted by BurndownChart + Projects; dead `fetchData`/`fetchProjects` callbacks removed

**Process:** Zero rejections. ProjectToolbar touched by workers 1 and 2 on different concerns — Git auto-merged cleanly. spawn.sh now creates per-worktree `.claude/settings.json` with full permissions for unattended workers.

---

### Wave 25: Responsive + Badge Consolidation + Accessibility (3 workers, 5 tasks)

**Worker 1 — Responsive Sidebar:**
- Collapsible desktop sidebar: toggle between w-56 (full) and w-14 (icon rail) with smooth transition, localStorage persistence
- Mobile drawer: hamburger top bar (md:hidden), slide-in overlay with backdrop, body scroll lock, Escape to close, nav links auto-close drawer
- Notification overlays repositioned for collapsed/mobile states
- DRY refactor: nav items extracted to `NAV_ITEMS[]` array, shared `sidebarContent()` renderer for desktop/mobile
- Card component adoption in Skeleton.tsx (KanbanColumnSkeleton)

**Worker 2 — Badge Adoption Round 2 (11 files):**
- Badge.tsx: added `purple` and `accent` variants (7 total now)
- Taskdetail components: TaskAIReviewSection, TaskAIHistory, TaskTitleEditor, TaskGitHubSection, TaskDetailPanel — all migrated to Badge
- Modal/panel components: CodePreviewModal, MeetingNotesDialog, ProjectHealthPanel, TaskPlanApprovalDialog, WebhookSettings — all migrated to Badge
- Eliminated ~30 inline `bg-*-100 text-*-700` pill patterns across the codebase

**Worker 3 — Toolbar ARIA + PWA Docs:**
- ProjectToolbar: template overlay → `role="dialog"` + aria-label + auto-focus + focus return; export overlay → `role="menu"` + `role="menuitem"` + ArrowDown/ArrowUp keyboard nav + auto-focus + focus return
- PWA cache invalidation strategy documented in decisions.md (autoUpdate lifecycle, NetworkFirst API cache, emergency SW unregister)
- navigateFallback denylist verified and extended with `/assets/`, `/sw.js`, `/workbox-*`

**Process:** Zero review rejections this wave. One minor file path issue (TaskDetailPanel.tsx path in task description).

---

## 2026-03-17

### Wave 24: Polish + Code Quality (3 workers, 6 tasks)

**Worker 1 — Dark Mode + Lint Fixes:**
- WCAG AA contrast fixes across 8 components: BacklogView, KanbanBoard, CalendarView, CSVImportModal, CloseSprintModal, SprintTransitionModal, ProjectSettingsModal, ProjectDashboard — changed `dark:text-slate-400` to `dark:text-slate-300` on interactive elements/dark backgrounds
- Fixed all 9 pre-existing lint warnings → 0 warnings: BurndownChart (useEffect fetch pattern), GanttChart (useMemo allTasks), ProjectSettingsModal (loadData deps), DropdownMenu (setActiveIndex moved to toggle), TaskPlanApprovalDialog/Home (unescaped entities), Projects (useEffect fetch pattern)

**Worker 2 — Badge/Card Adoption + Toolbar Fix:**
- Migrated inline pill patterns to Badge component in 5 files: SprintSection (priority/due date/active), TableView (priority), TaskFieldsPanel (priority), Search (status), Portfolio (health)
- Card component adoption in ProfilePage
- Fixed ProjectToolbar template/export overlay positioning: anchored to trigger buttons with `right-0 top-full mt-1`, added export menu Escape/click-outside handling, menus now close each other

**Worker 3 — ConfirmDialog + API + Tests:**
- Replaced last `window.confirm()` in useProjectData.ts popstate handler with promise-based ConfirmDialog (ref-stored confirm function + `.then()` chain)
- Added shared-types re-export in notification resolver (Comment/Report types not in shared-types yet — skipped correctly)
- 5 new S3 edge-case unit tests: key with special chars, custom endpoint config, uploadToS3 error propagation, custom URL expiry, deleteFromS3 error propagation

**Process:** Zero review rejections this wave. Lint went from 9 warnings to 0.

---

## 2026-03-16 (cont.)

### Wave 22-23: UX Audit Implementation (9 tasks across 2 waves)

**Wave 22 — Foundations + Quick Wins:**
- **Design system primitives:** Input, Textarea, Select (forwardRef, label, error, hint, aria-describedby, focus-visible ring), Card, Badge, SectionHeader
- **Button fix:** Added focus-visible:ring-2 to base class for keyboard accessibility
- **Modal fix:** Added scroll lock (body overflow hidden) on open
- **GlobalSearchModal deep-linking fix:** Task clicks now navigate to `/app/projects/:id?task=:taskId` instead of just `/app/projects/:id`
- **NavLink active states:** Sidebar links now use NavLink with `bg-slate-700 text-white` active styling; `/app` has `end` prop
- **ConfirmDialog + useConfirmDialog hook:** Replaced all 4 native `confirm()` calls (SprintSection delete, ProjectToolbar bootstrap, SlackSettings disconnect, WebhookSettings delete) with branded modal dialogs
- **ErrorBanner component:** Dismissible inline error with optional retry button, slide-in animation
- **Projects page:** Error state + retry (was `.catch(() => {})`)
- **Search page:** Error state + retry (was `catch { // ignore }`)
- **NotificationCenter:** Replaced `console.error` with visible ErrorBanner

**Wave 23 — Medium Restructurings:**
- **DropdownMenu primitive:** Accessible dropdown with role="menu"/role="menuitem", arrow key navigation, Enter/Escape, click-outside
- **Tabs primitive:** WAI-ARIA tabs pattern with role="tablist"/role="tab"/role="tabpanel", arrow key navigation, aria-selected
- **ProjectToolbar consolidation:** Grouped 10+ AI actions into "AI" dropdown menu, moved 6 secondary actions into "..." overflow menu. Visible toolbar: [Back/Name/Gear] [ViewToggle] [Search] [Filter] [Add Task] [AI ▾] [⋯]
- **OrgSettings tabs:** Split monolithic page into 5 client-side tabs (General, Team, Integrations, Webhooks, AI) using Card + SectionHeader + Tabs
- **Auth form labels:** Retrofitted all 6 auth pages (Login, Signup, ForgotPassword, ResetPassword, AcceptInvite, CreateOrg) with shared Input component — visible labels, aria-live error messages, loading states, autoComplete attributes

**Deferred to Wave 24+:** Responsive workspace (Item 9), Task detail re-architecture (Item 10)

---

### Wave 21: Testing + Ops Docs + Polish (3 workers, 3 tasks)

**Testing — S3 + Notification/SSE + Export Fix (Worker 1):**
- S3 upload unit tests with AWS SDK mocking
- Notification resolver + SSE manager unit tests
- Export rate limit fix — relaxed rate limit in test environment to prevent 429s

**Ops Docs + Dark Mode Contrast (Worker 2):**
- D1 deployment documentation (Railway, backups, monitoring, staging)
- Dark mode WCAG AA contrast fixes: `dark:text-slate-400` → `dark:text-slate-300/200` across TaskDetailPanel, Button, GlobalSearchModal, ProjectDetail

**Polish — PWA Offline + S3 Config + Shared-types + og:image (Worker 3):**
- PWA offline fallback page (`offline.html`) for uncached routes
- Configurable S3 presigned URL expiry via `ATTACHMENT_URL_EXPIRY_SECONDS` env var
- Extended shared-types: ProjectStats, TaskConnection, CloseSprintResult, SprintPlanItem; sprint resolver re-exports
- og:image PNG fallback for platforms that don't render SVG

**Open follow-ups:**
- Dark mode contrast: remaining components (BacklogView, SprintCreateModal, KanbanBoard, etc.) may still have `dark:text-slate-400` on dark backgrounds
- Shared-types re-export in comment resolver (only sprint.ts was done)
- PWA navigateFallback verification — ensure offline.html only served for navigation requests
- Pre-existing lint warnings (8 warnings across 5 files)
- S3 unit tests: missing `getFromS3` and error handling coverage
- PWA cache invalidation strategy documentation
- S3 multipart upload for files >10MB

### Wave 20: A11+F1 + D1 + Follow-ups+S1 (3 workers, 6 tasks)

**A11+F1 — WCAG AA Contrast & Spacing (Worker 1):**
- Color contrast audit: replaced `text-slate-400` with `text-slate-500` for readable text (timestamps, labels), `text-slate-500` with `text-slate-700` on `bg-slate-100` badges — all pairings now meet 4.5:1
- Spacing/typography normalization across Home, Projects, TaskDetailPanel, BacklogView — consistent padding scales, heading sizes

**D1 — Object Storage (Worker 2):**
- Migrated file attachments from local disk (multer) to S3-compatible object storage (`@aws-sdk/client-s3`)
- Presigned URL redirects for downloads, memoryStorage for uploads, local disk fallback when `S3_BUCKET` unset
- Health check reports S3 connectivity status
- Documented deployment strategy in decisions.md (S3/R2, DB backup, monitoring recommendations)

**Follow-ups+S1 — PWA & Wave 19 Follow-ups (Worker 3):**
- PWA service worker via vite-plugin-pwa (autoUpdate, NetworkFirst API caching, 37 precached entries)
- E2E supertest export tests (JSON, CSV, activity, auth 401, tenant isolation)
- API now imports from `@tasktoad/shared-types` (task.ts + project.ts resolver type annotations)
- Composite og:image SVG (1200x630, brand colors, toad icon)

**Process fix:** Added `git update-index --assume-unchanged CLAUDE.md` to spawn.sh to prevent workers from committing the swarm role section

**Open follow-ups:**
- S3 integration tests, presigned URL expiry config, multipart upload for large files
- PWA offline fallback page, cache invalidation docs
- og:image PNG fallback for platforms that don't render SVG
- Export test rate limit handling (429 risk)
- Extend shared-types usage across more resolvers
- E2E notification/SSE flow test coverage
- Dark mode WCAG AA contrast verification

### Pre-wave fix: Query cost limit rejects tasks query
- Added `'tasks'` to `SINGLE_OBJECT_FIELDS` in `schema.ts` — the `tasks` query returns `TaskConnection` (single wrapper object), not a list, but was treated as a list with 50x multiplier, causing compounding 50×50 = 2500x cost (430K > 100K limit). Fix drops cost to ~2-3K.

### Wave 19: Q1 + S1 + SW1 + W2 (3 workers, 6 tasks)

**Q1 — E2E Test Suite (Worker 1):**
- E2E happy-path integration test: signup → login → create org → create project → create task → update task → add comment → create sprint → assign to sprint → tenant isolation verification
- E2E task lifecycle test: labels CRUD, multi-assignee flow, custom fields, bulk updates, subtasks, activity audit log

**S1 — Styling & Branding (Worker 2):**
- Dark mode for all 12 remaining modals (BatchCodeGen, DriftAnalysis, SprintCreate, ProjectSettings, GlobalSearch, GitHubRepo, BugReport, SprintTransition, CSVImport, PRDBreakdown, SprintPlan, KnowledgeBase)
- SVG favicon (frog silhouette in brand green) with PNG fallback
- Social preview meta tags (og:image, og:title, og:description, twitter:card)
- Spacing/typography audit on Projects, Home, TaskDetailPanel pages

**SW1 — Swarm Workflow (Worker 3):**
- Auto `prisma generate` in spawn.sh for each worktree
- `validate-tasks.sh` — cross-references task file arrays against repo, detects conflicts between workers
- Auto-strip worker role from CLAUDE.md during merge (delimiter-based sed strip in merge-worker.sh)

**W2 — Shared Types (Worker 3):**
- Created `@tasktoad/shared-types` workspace package with core interfaces (Task, Project, Sprint, Label, Comment, etc.)
- Web app now imports from shared package instead of manually duplicating types
- Initial submission pointed `types` to `dist/` (rejected — typecheck fails without build step); fixed to point to `src/index.ts`

**Open follow-ups:**
- Have API also import from `@tasktoad/shared-types` for resolver return type annotations
- E2E tests: add export route handler test via supertest (current tests verify DB state, not REST endpoint)
- E2E tests: add notification/SSE flow coverage
- Social preview: create proper composite og:image (current logo.png may be too small)
- Dark mode contrast audit needed (WCAG AA verification after 12-modal batch)

---

## 2026-03-16

### Wave 18: Q1 + F1 + I1 + W6 (3 workers, 6 tasks)

**Q1 — Code Quality & Testing (Worker 1):**
- Fixed integration test DB table names — corrected cleanDatabase truncate targets so integration tests no longer fail on missing tables
- TypeScript strictness audit — remaining `any` types cleaned up
- Expanded web test coverage — useTaskCRUD hook tests and ActivityFeed component tests
- Password validation fixes aligned with shared policy

**F1 — Frontend Performance & Architecture (Worker 2):**
- Virtualized ActivityFeed with react-window for large activity lists (>100 items)
- Paginated CommentSection for performance with many comments
- Extracted ProjectToolbar component from ProjectDetail, consolidated modal state management

**I1 — Integration Completeness (Worker 3):**
- Slack self-service user mapping — `/tasktoad link` and `/tasktoad unlink` commands for users to map their own Slack↔TaskToad accounts
- GitHub webhook dead letter queue — failed webhook deliveries stored for retry/inspection

**W6 — AI Extras (Worker 3):**
- Threaded promptLoggingEnabled through AI service layer — aiService.ts callers now pass org setting via promptLogContext

**Open follow-ups:**
- Uncommitted change in `schema.ts`: `'tasks'` added to `SINGLE_OBJECT_FIELDS` — needs review (may be leftover from reviewer or intentional cost analysis fix)

### Wave 17: Q1 + D1 + W6 (3 workers, 6 tasks)

**Q1 — Code Quality & Testing (Worker 1):**
- Authorization regression tests: 7 integration tests covering cross-org addTaskAssignee, updateTask assigneeId, cross-project setCustomFieldValue, cross-org deleteComment, requireOrgUser/requireProjectField helpers, automation assign_to skip
- Recurrence scheduler tests: 13 unit tests for cronMatchesNow/fieldMatches (wildcard, exact, step, range, comma, invalid cron); exported previously-internal functions
- Password policy: shared validatePassword() (uppercase + lowercase + digit + 8 chars) replacing simple length check in signup/resetPassword/acceptInvite; client-side validation in Signup.tsx
- Attachment DataLoader: taskAttachments loader following taskLabels pattern, wired into Task.attachments resolver

**D1 — Deployment & Observability (Worker 2):**
- Prometheus resolver metrics: graphql-yoga onExecute plugin measuring wall-clock duration per operation name
- Prisma pool metrics: 30s interval collecting pool active/idle/wait gauges from prisma.$metrics.json(), cleared on shutdown
- Deploy pipeline: added test step, uncommented Railway deploy with conditional gate, new smoke-test job with postgres service container and health endpoint verification

**W6 — AI Extras (Worker 3):**
- AI prompt log toggle: promptLoggingEnabled Boolean on Org (migration), wired through setAIBudget mutation, prompt log creation guarded by setting, OrgSettings toggle UI
- SDL descriptions: added triple-quote descriptions to all query/mutation fields in github, report, slack, webhook, projectrole typedefs
- Subtask code gen abort: AbortController in useAIGeneration for subtask generation, Cancel button in CodePreviewModal, threaded through useProjectData → ProjectDetail

**Open follow-ups:**
- Integration test DB missing `Activity` table — all integration tests fail in cleanDatabase truncate (pre-existing)
- `promptLoggingEnabled` not yet threaded through aiService.ts callers — toggle guard exists in aiClient.ts but callers don't pass promptLogContext with the org setting

### Production Hardening Sprint (GPT-5.4 Audit Response)

**Phase 1 — Security Sprint:**
- Multi-tenant authorization hardening: added `requireOrgUser()` and `requireProjectField()` validators; applied to `updateTask`, `addTaskAssignee`, `removeTaskAssignee`, `bulkUpdateTasks`, `setCustomFieldValue`, `deleteComment`, and automation `assign_to` action
- Upload serving safety: Content-Disposition defaults to `attachment` (only whitelisted MIME types served inline), file type validation on upload, filename sanitization (path traversal, null bytes, non-safe chars), X-Content-Type-Options: nosniff header
- Auth hardening: email verification required on login, verification/reset tokens hashed with SHA-256 before storage, verification tokens now expire after 24 hours
- AI prompt retention: 30-day retention TTL on AIPromptLog, automated cleanup job (every 6 hours), sensitive pattern redaction (emails, API keys, tokens) before storage

**Phase 2 — Operational Safety:**
- Background job distributed locking: `pg_try_advisory_lock` wrapper ensures only one replica runs due-date reminders, webhook retries, recurrence scheduler, and prompt cleanup
- Removed stale AWS infra: deleted `infra/` CDK directory, replaced CDK deploy script with Railway reference, updated deploy.yml to build+typecheck+lint validation
- Centralized PrismaClient: eliminated 7 duplicate `new PrismaClient()` instances across upload.ts, export.ts, github/, slack/ — all now share the singleton from context.ts
- Fixed railway.toml healthcheck: changed from `/` to `/api/health`

**Phase 3 — Quality & UX:**
- Added Portfolio to sidebar navigation
- Wired `?task=<taskId>` deep-link parameter in ProjectDetail (auto-selects task from search results)
- Prisma migration for `verification_token_expiry` and `ai_prompt_logs.expires_at` fields

### Wave 16: W2 + W6 + Q1 (3 workers, 6 tasks)

**W2 — Advanced Tasks & Filters (Worker 1):**
- Recurring tasks: Prisma fields (recurrenceRule, recurrenceParentId, recurrenceLastCreated), cron scheduler utility with 60s interval and 23h debounce, TaskDetailPanel dropdown presets (Daily, Weekly Mon/Fri, Biweekly, Monthly), wired into index.ts startup/shutdown
- File attachments: Attachment model + migration, multer REST upload endpoint (POST/GET/DELETE /api/uploads), 10MB limit, rate-limited, TaskDetailPanel upload UI with file list and delete
- AI auto-review trigger: fire-and-forget reviewCode on status change to in_review when task has linked PRs

**W6 — Advanced Views & AI Extras (Worker 2):**
- Subtask-level code generation: generateCodeFromSubtask mutation using parent task context, per-subtask generation UI in CodePreviewModal with file accumulation across subtasks
- API docs SDL descriptions: ~40 operation descriptions added as triple-quote SDL comments, docs parser updated to extract and render descriptions below each operation

**Q1 — Code Quality & Testing (Worker 3):**
- Project integration tests: 13 tests covering createProject, updateProject, archiveProject, project queries, auth checks
- Notification integration tests: 9 tests covering queries (unreadOnly, limit), markRead, markAllRead, preferences
- AI service unit tests: 12 tests with mocked callAI covering generateProjectOptions, generateTaskPlan, expandTask, summarizeProject, isArraySchema, validation retry
- parseSuggestedTools runtime validator added to taskHelpers.ts

**Post-wave: Multi-step code generation pipeline**
- Redesigned code generation from single-call (truncation-prone) to plan-then-generate with context threading
- Phase 1: planCodeGeneration mutation generates file plan (~2K tokens)
- Phase 2: generatePlannedFile generates each file individually (~8K tokens) with completed file exports for cross-file consistency
- CodePreviewModal updated with plan review UI, per-file progress indicators, retry on failure
- handleGenerateCode now always uses multi-step flow

**Process notes (Wave 16):**
- 5 of 6 tasks passed review on first attempt
- Worker-2 had merge conflict on task-004 (task-003 commits still on branch after merge — rebase needed)
- merge-worker.sh handled pnpm install (multer) and prisma generate automatically

**Open follow-ups:**
- [ ] Upload filename sanitization — path.basename() on originalname to prevent path traversal
- [ ] Upload route uses its own PrismaClient instead of shared instance
- [ ] SDL descriptions for ~30 remaining operations (github, report, slack, webhook, projectrole)
- [ ] Subtask code gen abort support (no AbortController in CodePreviewModal subtask flow)

### Wave 15: Q1 + F1 + S1 (3 workers, 6 tasks)

**Q1 — Code Quality & Testing (Worker 1):**
- 51 AI module unit tests: tokenEstimator (estimateTokens, checkPromptSize), responseParser (stripFences, parseJSON), aiCache (hashPrompt, set/get, TTL, LRU eviction), promptBuilder (buildTaskPlanPrompt, buildProjectOptionsPrompt, userInput, context compression)
- CI test gate: PostgreSQL 16 service in GitHub Actions, `pnpm test` step between typecheck and build
- Task/sprint integration tests: createTask, updateTask (status/title/priority), archiveTask, bulkUpdateTasks, createSprint, activateSprint (single-active enforcement), deleteSprint

**F1 — Frontend Performance (Worker 2):**
- Fixed lazyWithRetry: async loop pattern replacing recursive bug, extracted to `utils/lazyWithRetry.ts`
- Lazy-loaded 17 conditional modals in ProjectDetail (GitHubRepoModal, StandupReportPanel, ProjectHealthPanel, TrendAnalysisPanel, MeetingNotesDialog, CSVImportModal, KnowledgeBaseModal, BugReportModal, PRDBreakdownModal, SprintTransitionModal, BatchCodeGenModal, DriftAnalysisModal, SprintReportPanel, CodePreviewModal, AIUsageDashboard, SprintPlanModal, ProjectChatPanel) — chunk reduced from 224KB to 179KB
- dependsOnCache size limit: MAX_CACHE_SIZE=1000 with oldest-entry eviction
- Cost limit: DEFAULT_LIST_MULTIPLIER applied to unknown fields with selection sets
- react-window list virtualization: SprintSection (>20 tasks), BacklogView (>20 tasks), TableView (>50 rows with CSS grid)
- Position rebalancing: needsRebalance detection (gap < 0.001), auto-rebalance to evenly-spaced positions

**S1 — Styling & Branding (Worker 3):**
- Dark mode rollout across all views: ProjectDetail, TaskDetailPanel, BacklogView, KanbanBoard, TableView, SprintSection, CommentSection, CalendarView, ProjectDashboard, GanttChart, BulkActionBar, Skeleton
- Dark mode for shared components: FilterBar, SearchInput, ToastContainer, KeyboardShortcutHelp, DependencyBadge, MarkdownContent, MarkdownEditor
- Dark mode for pages: ProfilePage, OrgSettings
- Dark mode toggle: sun/moon icon in AppLayout sidebar, localStorage persistence, system preference default
- 23 ad-hoc buttons converted to shared `<Button>` component with variant/loading props
- PWA manifest: manifest.json with app metadata + Apple mobile web app meta tags

**Post-wave fix:** Cost limit rule calibration — added SINGLE_OBJECT_FIELDS set for non-list fields (user, project, field, etc.), reduced nested list multipliers (labels: 5, assignees: 3, etc.), set default limit to 50K. Root cause: connection wrapper `tasks` query field was being double-counted as a list (50×50=2500× nesting), blocking all standard app queries.

**Process notes (Wave 15):**
- Worker-3 had a merge conflict in TableView.tsx after worker-2's react-window changes — required one rebase
- merge-worker.sh pnpm install fix worked perfectly for react-window dependency (zero manual workarounds)
- All tasks merged successfully

**Open follow-ups:**
- [ ] Dark mode contrast audit — verify dark: color pairings meet WCAG AA 4.5:1
- [ ] Virtualize activity feeds — apply react-window to activity/comment feeds when > 100 items
- [ ] Dark mode for remaining modals — BatchCodeGenModal, DriftAnalysisModal etc. may still lack dark: variants
- [ ] PWA service worker — manifest exists but no service worker for offline caching

### Wave 14: P1 + P2 + A11 + F1 (3 workers, 6 tasks)

**P1 — Sentry Error Tracking (Worker 1, task-001):**
- @sentry/node integration: init in index.ts with SENTRY_DSN env var, graceful skip when unset
- Express requestHandler/errorHandler middleware, custom yoga plugin for GraphQL error capture (filters expected user errors)
- AI failure capture with prompt type/token context in aiService.ts
- User context (id, email) set per authenticated request in context.ts
- Graceful flush on shutdown via Sentry.close(2000)

**P2 — GraphQL Query Complexity Limits (Worker 1, task-002):**
- Custom AST-based cost analysis validation rule alongside existing depth limit
- Per-field cost multipliers (projects: 20, tasks: 50, comments: 30, etc.) with nested multiplication
- MAX_QUERY_COST configurable via env var (default 10,000)
- 50% threshold warning logs, introspection queries exempt
- Clear error message with actual vs max cost

**A11 — KanbanBoard Reorder Persistence (Worker 2, task-003):**
- `reorderTask(taskId, position)` GraphQL mutation with fractional positioning
- Keyboard Up/Down reorder calls mutation and survives page reload
- Drag-and-drop reorder also persists position
- Tasks sorted by position within columns (nulls last, then createdAt)
- `position` field added to TASK_FIELDS query constant

**A11 — Sprint Picker Keyboard UX (Worker 2, task-004):**
- Escape key closes dropdown and restores focus to trigger
- Click-outside closes dropdown via mousedown listener
- Full ARIA listbox pattern: role=listbox/option, aria-expanded, aria-activedescendant
- Up/Down arrow navigation between sprint options
- Focus management: first option focused on open, trigger refocused on close

**F1 — Lazy-Load Heavy Modals + Route Error Boundaries (Worker 3, task-005):**
- Lazy-loaded GanttChart, ProjectSettingsModal, TaskPlanApprovalDialog, CloseSprintModal via React.lazy
- Per-route RouteErrorBoundary with "Reload" and "Go Home" recovery options
- lazyWithRetry helper for chunk load retry (2 retries with 1s delay)

**F1 — Template UX Improvements (Worker 3, task-006):**
- Template dropdown closes on Escape key and click-outside
- Create/edit template forms now include instructions, acceptanceCriteria, estimatedHours, storyPoints fields
- Save as Template pre-fills instructions and acceptanceCriteria from source task

**Post-wave fix:** AI response parser hardening — capped task plan to 5-10 tasks (was up to 15, caused token truncation), rewrote stripFences() for robust JSON extraction, added assistant prefill to force structured output, improved error logging (500 char preview + response length)

**Process notes (Wave 14):**
- All 6 tasks passed review on first attempt — zero rejections (2nd consecutive zero-rejection wave)
- merge-worker.sh still doesn't run `pnpm install` — recurring issue since Wave 11, required manual merge for task-001 (@sentry/node)
- lazyWithRetry has a runtime bug in retry path (recursive call returns LazyExoticComponent instead of retrying importFn) — happy path works fine
- BatchCodeGenModal not lazy-loaded (minor gap from task description)

**Open follow-ups:**
- [ ] Fix lazyWithRetry retry bug (already tracked in F1 todos)
- [ ] Lazy-load BatchCodeGenModal (already tracked in F1 todos)
- [ ] merge-worker.sh pnpm install (already tracked in SW1 todos)

### Wave 13: S1 + Q1 + W6 (3 workers, 6 tasks)

**S1 — Styling & Branding (Worker 1):**
- Shared `<Button>` component with primary/secondary/ghost/danger variants, sm/md/lg sizes, loading spinner, forwardRef — 31 ad-hoc buttons converted across the codebase
- Dark mode infrastructure: Tailwind `darkMode: 'class'`, CSS custom properties for dark brand colors, `dark:` variants on layout shell (AppLayout, sidebar, header) + Button + Modal components

**Q1 — Code Quality & Testing (Worker 2):**
- Integration test foundation: `tasktoad_test` database setup with `cleanDatabase()` helper, auth resolver tests covering signup, login, and createOrg flows
- Zod validation for all unvalidated `JSON.parse` calls: `zodSchemas.ts` with 4 schemas (columns, options, statuses, suggestedTools), 7 bare `as` casts replaced with `safeParse` + warning log + fallback defaults

**W6 — Advanced Views & AI Extras (Worker 3):**
- AI code review UI: `TaskAIReviewSection` component with approval badge, review comments, code suggestions; AI Review button on tasks with linked PRs; `handleReviewPR` wired into `useTaskCRUD`
- Enhanced API documentation: domain-grouped operations (Auth, Organization, Project, Task, Sprint, etc.), rate limits table, Quick Start curl examples, sidebar TOC, schema download endpoints (`/api/docs/schema.graphql`, `/api/docs/schema.json`)

**Process notes (Wave 13):**
- Zero rejections — all 6 tasks passed review on first attempt (best wave yet)
- Worker-3 completed both tasks on single branch requiring manual commit splitting during merge (minor reviewer friction)

**Open follow-ups:**
- [ ] AI auto-review trigger — auto-trigger when task moves to `in_review` (currently manual button)
- [ ] API docs operation descriptions — extract from SDL comments (currently signature only)
- [ ] Dark mode rollout — extend `dark:` to remaining components + user toggle
- [ ] Button component adoption — ~26 remaining ad-hoc buttons not yet converted
- [ ] Integration test CI — test DB needs docker-compose or GH Actions step
- [ ] Integration test coverage — extend beyond auth to task CRUD, sprint, project resolvers

### Wave 12: F1 + W2 + SW1 (3 workers, 6 tasks)

**F1 — Frontend Performance (Worker 1):**
- React.memo on TaskRow (SprintSection), CommentItem, ActivityItem with stable useCallback props in parent components
- parseDependsOn cache utility in taskHelpers.ts — Map-based caching replaces inline JSON.parse in KanbanBoard and GanttChart
- Route lazy-loading via React.lazy: ProjectDetail, Portfolio, OrgSettings, Search, NewProject, Projects, ProfilePage — build now produces separate chunks (ProjectDetail 264KB, OrgSettings 36KB, etc.)
- portfolioOverview N+1 fix: batched from 1+2N queries (11 for 5 projects) to 3 total queries via `projectId: { in: projectIds }` bulk fetch

**W2 — Task Templates + JSON Helpers (Worker 2):**
- TaskTemplate Prisma model + migration, GraphQL CRUD (createTaskTemplate, updateTaskTemplate, deleteTaskTemplate, createTaskFromTemplate, taskTemplates query)
- Template picker dropdown in ProjectDetail toolbar + "Save as Template" button on task detail panel
- Template management tab in ProjectSettingsModal (list/edit/delete)
- jsonHelpers.ts: parseColumns(), parseOptions(), parseStatuses() centralized helpers — replaced 10 scattered JSON.parse call sites across 7 files
- Custom field reorder UI: Up/Down arrow buttons in ProjectSettingsModal with position swap via two updateCustomField mutations

**SW1 — Swarm Meta (Worker 3):**
- CLAUDE.md refreshed: test commands, REST endpoints (/api/health, /api/metrics), full GraphQL schema, key files (loaders.ts, metrics.ts, vitest configs), env vars (LOG_LEVEL, SENTRY_DSN)
- Knowledge base audit: app-overview.md (TaskAssignee, SlackUserMapping, WebhookDelivery models), skills.md (Vitest, prom-client, pino-http, React.lazy patterns), decisions.md (SSE migration, Vitest, Prisma metrics)
- status.sh file overlap warnings for in-flight tasks across workers
- BRANCH_STRATEGY.md documenting commit-per-task, rebase-after-merge, rejection handling
- swarm/SKILL.md standard acceptance criteria reminders for Prisma and npm package tasks

**Process issues (Wave 12):**
- Worker-3 committed CLAUDE.md with appended worker role section (caught by reviewer, required fixup)
- Task-003 files array listed auth.prisma for Org relation but model is actually in org.prisma (worker corrected)

**Open follow-ups:**
- [ ] Auto-strip worker role from CLAUDE.md commits (recurring issue — needs .gitignore or pre-commit hook)
- [ ] parseDependsOn cache memory management (Map never clears — needs TTL or size limit)
- [ ] Template dropdown click-outside close
- [ ] Template instructions/acceptanceCriteria fields in create UI form
- [ ] Route lazy-load error boundaries (retry logic for failed chunk loads)

### Wave 11: P1+D1 + Q1 + W2 (3 workers, 6 tasks)

**P1+D1 — Production Infra & Observability (Worker 1):**
- Prisma connection pooling documented in .env.example with pool params
- pino-http structured request logging: method, url, status, responseTime, requestId, GraphQL operationName
- LOG_LEVEL env var for production verbosity control
- GET /api/health endpoint with DB connectivity probe (200/503)
- Dockerfile HEALTHCHECK instruction
- GET /api/metrics Prometheus endpoint with prom-client: request duration histograms, request counters, Prisma pool stats (via preview metrics feature), Node.js default metrics

**Q1 — Code Quality & Testing (Worker 2):**
- Vitest setup for both API (TypeScript) and web (jsdom) packages
- Unit tests for resolverHelpers: validateStatus, parseInput, sanitizeForPrompt
- Unit tests for useTaskFiltering: search, status, priority, assignee, combined filters, edge cases
- Root `pnpm test` runs all tests across both packages
- Error handling audit: NotificationCenter (3 catches → console.error), GlobalSearchModal (silent → error UI), FilterBar (save/delete → error feedback)
- export.ts type safety: 9 `any` types replaced with `Prisma.TaskGetPayload<>` derived types
- AppLayout dead SSE handler documented with TODO

**W2 — Advanced Tasks & Filters (Worker 3):**
- Custom field DataLoader: customFieldValuesByTask with batched loading, eliminating N+1 queries
- customFieldValues added to TASK_FIELDS query constant (data now fetched with every task query)
- NUMBER filter: numeric input + operator dropdown (=, <, >, <=, >=) with comparison logic in useTaskFiltering
- DATE filter: date input + operator dropdown with ISO date comparison logic
- Multiple assignees: TaskAssignee join table + migration, GraphQL addTaskAssignee/removeTaskAssignee mutations, taskAssignees DataLoader, multi-select chip picker UI in TaskFieldsPanel, backwards-compatible assigneeId support

**Process issues (Wave 11):**
- Worker-1 hit pino-http type resolution twice — needed `@types/pino-http` or newer version with built-in types
- Worker-2 hit vitest type resolution twice — needed `/// <reference types="vitest" />` or tsconfig types config
- Worker-3 needed auth.prisma for TaskAssignee→User relation (not in files array, recurring pattern)

**Open follow-ups:**
- [ ] Expand test coverage: useTaskCRUD, tokenEstimator, aiService, resolver integration tests
- [ ] TypeScript strictness (remaining): eliminate other `any` types, Zod for JSON DB fields
- [ ] Sentry error tracking integration (P1 — deferred from this wave)

### Wave 10: P2 + A11 + I1 (3 workers, 6 tasks)

**P2 — Security Hardening (Worker 1):**
- GraphQL query depth limit (max 10) via custom validation rule in schema.ts
- `bulkUpdateTasks` now verifies per-project access (was only checking org membership)
- Comment mention regex hardened: tighter email pattern, 20-mention cap, batched DB lookups
- Per-user SSE connection limit (max 5, evicts oldest on overflow) in sseManager
- SSE token moved from query string to Authorization header (fetch-based client replaces native EventSource)
- Export endpoints rate limited to 5 requests per 10 minutes per IP

**A11 — Accessibility (Worker 2):**
- Form label associations: htmlFor/id pairs on TaskFieldsPanel (6 fields), SprintCreateModal (5 inputs), SprintPlanModal (2 inputs); aria-labels on FilterBar selects, CSVImportModal mapping selects
- Color contrast fixes: text-slate-300 → text-slate-500 on light backgrounds in FilterBar, CSVImportModal, SprintPlanModal
- KanbanBoard Up/Down arrow reordering within columns with aria-live announcements
- BacklogView sprint picker: keyboard-accessible via M key on focused task rows, with screen reader announcements

**I1 — Integration Completeness (Worker 3):**
- HTML email templates wired into all 4 sendEmail calls in auth.ts (verify, resend, reset, invite)
- Webhook retry processor wired into server lifecycle (startRetryProcessor on startup, stopRetryProcessor on shutdown)
- SSE connection cleanup added to graceful shutdown handler
- Email retry wrapper: 3 attempts with exponential backoff (1s/5s/15s)
- Slack user mapping: SlackUserMapping Prisma model + migration, GraphQL CRUD, `/tasktoad list` filters by mapped user, `/tasktoad create` auto-assigns, SlackSettings UI for managing mappings

**Open follow-ups from Wave 10:**
- [ ] GraphQL complexity/cost limits (depth done, cost analysis not yet)
- [ ] KanbanBoard reorder persistence — Up/Down moves are local state only, need `reorderTask` mutation
- [ ] BacklogView sprint picker: close on Escape/click-outside
- [ ] Slack user mapping self-service — `/tasktoad link` command for non-admin users
- [ ] Full WCAG AA 4.5:1 color contrast audit across all components

### S1: Branding & Design System

- **CSS custom properties** + **Tailwind brand tokens**: `--brand-green`, `--brand-lime`, `--brand-dark`, `--brand-cyan`, `--brand-green-light`, `--brand-green-hover` — defined in `:root` and referenced via `brand.*` in tailwind.config.js
- **Logo deployed** to `apps/web/public/`: `logo.png` (T-Frog), `logo-data.png` (Node Frog), `favicon.png`
- **Meta tags**: favicon, description, theme-color, og:title/description/image/type in `index.html`
- **Logo placements**: sidebar header (28px), login/signup (40px centered), home page (64px centered), project dashboard (32px data logo)
- **Brand-green CTA buttons**: Home page generate, login sign-in, signup create account, TaskPlanApprovalDialog approve
- **Full button color migration**: all action buttons across 35 files converted from `bg-slate-800/700` to `bg-brand-green`/`hover:bg-brand-green-hover` — pages (ProfilePage, ResetPassword, NewProject, CreateOrg, VerifyEmail, OrgSettings, Projects, AcceptInvite, ForgotPassword, ProjectDetail) and components (ProjectSettingsModal, WebhookSettings, SlackSettings, GitHubRepoModal, AIUsageDashboard, ErrorBoundary, SprintPlanModal, CSVImportModal, PRDBreakdownModal, BugReportModal, CommentSection, SprintCreateModal, SprintTransitionModal, MeetingNotesDialog, CloseSprintModal, BatchCodeGenModal, ProjectChatPanel, MarkdownEditor, TaskSubtasksSection)
- **Focus ring migration**: all `focus:ring-slate-400` → `focus:ring-brand-green` across 19 files (inputs, textareas, selects)
- **Active tab/toggle indicators** → `bg-brand-green`: AIUsageDashboard, BurndownChart, ProjectChatPanel, TaskPlanApprovalDialog step indicator
- **Loading spinner branding**: `border-t-slate-700` → `border-t-brand-green` in App.tsx, OrgSettings, TaskPlanApprovalDialog
- **Unchanged (intentional)**: sidebar bg-slate-800 (dark chrome), BulkActionBar (dark floating toolbar), text colors (semantic), status/priority colors (separate system)
- **Branding knowledge base** updated: `.claude-knowledge/branding.md` with deployed assets, color tokens, and UI placement reference

### Wave 9: P1 + A11 + I1 (3 workers, 6 tasks)

**P1 — Production Hardening (Worker 1):**
- Graceful shutdown handlers (SIGTERM/SIGINT) with Prisma disconnect, interval cleanup, 10s force-kill timeout
- Startup DB connectivity check, production env warnings for missing SMTP/API keys
- React Error Boundary with fallback UI + Suspense wrapper for lazy routes
- Static asset caching: immutable for hashed assets, no-cache for index.html

**A11 — Accessibility Foundation (Worker 2):**
- Shared `<Modal>` component with focus trap, aria-modal, aria-labelledby, Escape-to-close, focus restoration
- All 19 modal/dialog components converted to use shared Modal
- ARIA labels on icon-only buttons, aria-hidden on decorative SVGs
- ToastContainer live regions (aria-live="polite", role="alert" for errors)
- Skip-to-content link, sidebar nav aria-label, notification badge announcements
- KanbanBoard keyboard navigation: Enter/Space move mode, arrow keys between columns

**I1 — Integration Completeness (Worker 3):**
- WebhookDelivery model + migration, exponential backoff retry queue (5s→1hr, 5 attempts max)
- Webhook delivery dashboard UI with status badges, replay button for failed deliveries
- Fixed missing webhook dispatches for comment.created and sprint.created events
- Slack slash commands: `/tasktoad list` (assigned tasks) and `/tasktoad status` (project summary) with Block Kit
- Branded HTML email templates for verification, password reset, and invite emails

**Pre-wave:** Adaptive AI generation limits — replaced hardcoded output count ranges with scope-aware guidance, added delegationHint to code generation, bumped token ceilings

**Open follow-ups:**
- Wire `startRetryProcessor()` into `index.ts` (exported but not called — retry processor won't run until integrated)
- Wire HTML email templates into auth resolver `sendEmail()` calls (templates built but callers still pass plain text)
- Slack `/tasktoad list` shows all tasks, not user-specific (blocked on Slack user mapping)

**Process notes:**
- Worker-3 couldn't wire retry processor into index.ts because it wasn't in their files array. Future: include entry point files when tasks add background processors.
- Worker-1 delivered both tasks cleanly — zero type errors, no lint regressions across 13 files.

### Wave 8: W1 + W2 (2 workers, 2 tasks completed, 1 deferred)

**W1 — API Quality (Worker 1):**
- Fixed inconsistent mutation return types — `deleteComment` returns deleted Comment, `markAllNotificationsRead` returns count
- Added cursor-based pagination to `activities` and `reports` queries (ActivityConnection, ReportConnection)
- Auto-generated API docs served at `GET /api/docs`

**W2 — Custom Fields & Saved Filters (Worker 2):**
- Custom fields on tasks — CustomField + CustomFieldValue models, 4 field types (text, number, date, dropdown), CRUD mutations, TaskDetailPanel rendering, FilterBar integration, ProjectSettingsModal management
- Saved filters/views — SavedFilter model, save/load/delete in FilterBar

**Deferred:** Task templates, file attachments, recurring tasks (moved back to W2 todos for future wave)

**Codebase audit:** Added 8 new work sets to todos.md — P1 (production hardening), P2 (security), A11 (accessibility), Q1 (code quality/testing), D1 (deployment/observability), I1 (integration completeness), F1 (frontend performance), S1 (styling/branding)

**Process notes:**
- Worker-2 submitted without running `prisma generate` — 17 typecheck errors caught by reviewer. Future: task descriptions must include "run `npx prisma generate` AND `pnpm typecheck`" for schema changes.
- JSON column cleanup sub-item was skipped by worker. Future: mark optional sub-items explicitly or split into separate tasks.
- Worker modified files not in task's `files` array (auth.prisma, org.prisma, resolvers/index.ts) — necessary for Prisma relations. Future: include related model files in files array.

### Wave 7: W1 + W5 + W6 (3 workers, 5 tasks)

**W1 — API Refactor & Security Hardening + Frontend Cleanup:**
- Extracted `requireTask`/`requireProject`/`validateStatus` resolver utilities (eliminated 20+ duplicated blocks)
- Added GraphQL error codes in extensions, Zod input validation at resolver boundaries
- Sanitized AI prompt injection, added CSP headers, rate-limited password reset/verification
- Decomposed BacklogView, lazy-loaded react-markdown, refactored setState injection

**W5 — Slack Integration:**
- Full vertical slice: SlackIntegration model, Slack client with Block Kit formatting
- Notification dispatch alongside webhooks, slash command endpoint for task creation
- GraphQL CRUD + SlackSettings UI in OrgSettings

**W6 — Views & AI History:**
- Timeline/Gantt SVG chart with dependency arrows and day/week/month zoom
- Portfolio overview page with cross-project health scores and metrics
- AIPromptLog model with automatic persistence in AI client
- Historical trend analysis (analyzeTrends query + TrendAnalysisPanel)

**Process notes:**
- Worker-3 had merge conflict after first task merged (multi-task same branch). Future: workers should rebase between tasks.
- Missing Prisma migration caught by reviewer. Future: always include "run prisma migrate" in task descriptions for schema changes.

---

### Wave 6: W1 + W3 + W4 + W5 + W6 (3 workers, 10 tasks)

**W1 — Frontend Architecture Refactor (partial):**
- Split `useProjectData.ts` into focused hooks (`useTasks`, `useSprintManagement`, `useAIGeneration`, `useProjectUI`)
- Decomposed `TaskDetailPanel.tsx` into sub-components
- Added `useMemo`/`useCallback` memoization to KanbanBoard and BacklogView
- Extracted GraphQL query strings into `queries.ts`

**W3 — Users, Roles & Automation:**
- User avatars and profile management (display name, timezone, notification prefs)
- Project-level roles (viewer, editor, admin) with permission checks in resolvers
- Automation rules engine with configurable triggers and rule builder UI

**W4 — AI Power Features:**
- Task dedup (prevent AI from generating duplicate tasks)
- Bug report → Task parser with BugReportModal UI
- PRD → Task breakdown with preview/commit flow
- Sprint transition analyzer (AI analyzes backlog on sprint close)
- GitHub repo → Project bootstrap (import repo, AI generates initial tasks)

**W5 — External Integrations (partial):**
- Outgoing webhooks with HMAC signing, retry queue, management UI
- Real-time SSE updates with auth, `useEventSource` hook, live UI patching

**W6 — AI Extras (partial):**
- Contextual project chat — NL Q&A grounded in live project data
- Repo ↔ Task drift analysis — flags outdated/untracked work
- Batch code generation — multi-task code gen in one PR

---

## 2026-03-14

### Production Deployment

- Deployed to Railway (Hobby plan): single service serving both API + web frontend
- Dockerfile: multi-stage build with OpenSSL for Prisma, ESM `__dirname` fix
- API serves Vite build as static files in production (no separate web service needed)
- Railway auto-deploys, auto-migrates via `prisma migrate deploy` in startCommand
- Fixed: Prisma generate must run before tsc in Docker, `cd` not available in slim containers
- Manually linked GitHub App installation in prod DB (owner redirect limitation)
- Skipped email verification redirect for MVP (SMTP not configured)
- Production URL: `https://tasktoad-api-production.up.railway.app`

### "In Review" Status + PR Lifecycle

- Added `in_review` as default status and "In Review" as default kanban column
- Auto-move task to `in_review` when PR is created via `createPullRequestFromTask`
- Auto-move task to `done` when PR receives approved review via `pull_request_review` webhook
- Swapped column colors: In Review = purple, Done = green

### GitHub Integration Fixes

- Fixed webhook signature verification: `express.raw()` before `express.json()`
- Fixed PKCS#1 → PKCS#8 key conversion for jose (GitHub generates PKCS#1 keys)
- Base64-encoded private key in `.env` (multi-line PEM not supported by Node env loading)
- GitHub App transferred to `tasktoad` org
- Popup-based GitHub App installation flow

### Swarm System v2

- Restructured todos from 15 file-based groups into 18 parallel-optimized Task Sets
- Schema sets (S1-S10) run one at a time; Independent sets (I1-I8) run freely in parallel
- Planner auto-selects work by priority (no manual set specification needed)
- Added `task-update.sh` and `merge-worker.sh` helper scripts
- Workers loop until all tasks merged, auto-rebase, self-fix on review feedback
- Added `.claude/settings.json` with project-level permissions (auto-allow safe commands)

### Wave 2: S2 + I2 + I4 (3 workers, 8 tasks)

**S2 — AI Persistence & Cost Control:**
- AIUsageLog model with per-call tracking (feature, tokens, cost, latency)
- Org budget fields (monthlyBudgetCentsUSD, alertThreshold)
- aiUsage query with per-feature breakdown and budget usage percentage
- setAIBudget mutation for org admins
- Persisted reports model (standup, sprint, health) for historical analysis
- AI Usage Dashboard in OrgSettings with cost cards, feature table, budget controls

**I2 — Code Gen UX:**
- Regenerate single file in code preview modal with optional feedback
- Code gen templates / style guides — per-project localStorage with prompt injection

**I4 — Frontend Views:**
- Burndown/burnup SVG chart using existing sprintBurndown query
- DependencyBadge component with hover tooltip and blocked indicators
- Cross-project search page with debounced input, grouped results

### Wave 1: S1 + I1 + I3 (3 workers, 9 tasks)

**S1 — Core PM Foundation:**
- Epics / task hierarchy with taskType field (epic → story → task → subtask)
- createSubtask mutation with auto type inference, Task.children + Task.progress field resolvers
- Epic grouping in BacklogView with expand/collapse and progress bars
- Task type badges (purple=epic, blue=story) on KanbanBoard and TaskDetailPanel
- Sprint goal field on Sprint model + SprintCreateModal UI
- Story points on Task model + TaskDetailPanel input + BacklogView display
- Sprint velocity now tracks both hours and points

**I1 — AI Pipeline Polish:**
- AI-generated commit messages (conventional commits format) with graceful fallback
- AI-enriched PR descriptions (summary, changes, testing sections)
- Multi-file context injection — fetches project file tree from GitHub for code gen prompts
- Pre-flight cost estimation display in CodePreviewModal

**I3 — Infrastructure:**
- GitHub Actions CI workflow (lint, typecheck, build on push/PR)
- Deploy workflow (placeholder, builds successfully)
- Multi-stage Dockerfile for API
- Railway deployment config with auto-migration
- DEPLOY.md documentation

### Swarm: Code generation pipeline + AI UX (Groups A, B)

Second swarm run — 3 workers, 5 tasks.

**Group A — AI Code Generation Pipeline:**
- Backend: `generateCode` in aiService + Zod schema + promptBuilder + aiConfig (8192 max tokens)
- GraphQL: `generateCodeFromTask` mutation with `GeneratedFile` and `CodeGeneration` types
- Frontend: `CodePreviewModal` with collapsible file previews, token cost display, "Create PR" button
- Full flow working: Task → Generate Instructions → Generate Code → Preview → Create PR on GitHub

**Group B — AI Generation UX:**
- Graceful rejection handling — after 3 rejections, shows context input for better results
- Iterative generation input — collapsible "Refine" section with refinement history

### GitHub integration fixes

- Fixed webhook signature verification: `express.json()` was parsing body before webhook route, breaking HMAC
- Fixed PKCS#1 → PKCS#8 key conversion for `jose` (GitHub generates PKCS#1 keys)
- Base64-encoded private key in `.env` (multi-line PEM not supported by Node env loading)
- GitHub App transferred to `tasktoad` org
- Popup-based GitHub App installation flow (replaces full-page navigation)

### Swarm improvements

- Added `task-update.sh` and `merge-worker.sh` helper scripts (reduces manual approvals)
- Workers now loop until all tasks merged, auto-rebase, self-fix on review feedback
- No remote pushes from workers/reviewer — only user pushes from main
- Added cross-group blocker isolation rules to planner

### Todos expansion

- Added 25 new feature items across PM parity gaps and AI pipeline enhancements
- New groups: M (User & Profile), N (Real-time), O (Data Portability)

### Swarm: Groups J, A, C (parallel development)

First swarm run — 3 workers + reviewer, 10 tasks across 3 groups.

**Group J — API Architecture (Tech Debt):**
- Split monolithic schema.ts (~2000 lines) into 10 domain resolver modules under `resolvers/`
- Added structured GraphQL error handling (7 error classes + requireAuth/requireAdmin guards)
- Added structured logging with pino (replaced all console.error/log calls)

**Group A — AI Reports:**
- Daily standup report — AI generates completed/inProgress/blockers from sprint data
- Sprint report — AI summary with completion rate, highlights, concerns, recommendations
- Project health analyzer — AI health score (0-100) with issues, strengths, action items
- Meeting notes → Tasks — AI extracts tasks from pasted meeting notes

**Group C — GitHub Integration:**
- GitHub issue sync — create GitHub issues from tasks, bidirectional status sync
- PR status on tasks — show linked PR status (open/merged/closed) on task cards
- Auto-link commits — parse branch names to associate commits with tasks

---

## 2026-03-13

### Tier 1 & 2 Features (table stakes + standard)

Implemented all Tier 1 and Tier 2 features from the PM gap analysis. 31 files changed, ~4,800 lines added.

**Collaboration:**
- Threaded comments on tasks with edit/delete
- Activity feed (project-level and per-task)
- @mentions with autocomplete dropdown

**Views:**
- Table view with inline editing (status, assignee, due date, sprint)
- Calendar view (tasks plotted by due date, month navigation)
- Project dashboard with stats, charts, and activity feed

**Task management:**
- Bulk actions bar (multi-select → update status/assignee/sprint/archive)
- Custom statuses per project (add/remove from toolbar)
- Labels/tags system (create, color-pick, assign to tasks, filter by label)
- Markdown editor/renderer for task descriptions
- Task archiving UI with "show archived" toggle

**Reporting:**
- Burndown/burnup chart (per-sprint, SVG-based)
- Sprint velocity chart (completed tasks/hours across sprints)

**Navigation:**
- Global search modal (Cmd+K) — searches tasks and projects across org
- Notification center in app header (bell icon, unread count, mark-read)

**Backend:**
- New Prisma models: Comment, Activity, Label, TaskLabel, Notification
- New migration with all new tables and indexes
- Activity logging utility, notification creation utility
- 742 new lines in schema.ts (resolvers for comments, activities, labels, notifications, stats, search, bulk updates)

**Todos reorganization:**
- Converted from priority tiers to module-based groups (A–L) for parallel development
- Removed all completed items

### GitHub App Integration

Full GitHub App backend + frontend linking UI. 26 files changed, ~2,000 lines added.

**Backend (`apps/api/src/github/`):**
- `githubAppAuth.ts` — JWT generation (RS256), installation token caching with 1-min-before-expiry refresh
- `githubAppClient.ts` — GraphQL client for GitHub API
- `githubRepositoryService.ts` — connect/disconnect repos, create repos, list installation repos (REST)
- `githubCommitService.ts` — create branches, commit files via GitHub GraphQL
- `githubPullRequestService.ts` — create PRs
- `githubService.ts` — orchestration (create PR from task)
- `githubWebhookHandler.ts` — handles installation created/deleted events
- `githubTypes.ts` — shared interfaces
- `githubLogger.ts` — structured logging

**GraphQL:**
- Types: `GitHubInstallation`, `GitHubRepoLink`, `GitHubPullRequest`, `GitHubRepo`
- Queries: `githubInstallations`, `githubInstallationRepos`, `githubProjectRepo`
- Mutations: `linkGitHubInstallation`, `connectGitHubRepo`, `disconnectGitHubRepo`, `createGitHubRepo`, `createPullRequestFromTask`
- `githubRepositoryName`/`githubRepositoryOwner` fields on `Project` type

**Frontend:**
- `OrgSettings.tsx` — GitHub section showing installations with "Connected" badges, auto-links on callback redirect (`?installation_id=`), "Install GitHub App" button
- `GitHubRepoModal.tsx` — two-state modal (connected: show repo + disconnect; not connected: installation dropdown → repo list with filter → connect)
- `ProjectDetail.tsx` — GitHub icon button in toolbar showing `owner/repo` label, opens modal
- `IconGitHub` component added to shared Icons

**Prisma:**
- `GitHubInstallation` model + GitHub fields on `Project` (repositoryId, name, owner, installationId, defaultBranch)

---

## 2026-03-12 (Session 2)

### PM Platform Gap Analysis & Todo Overhaul

Compared TaskToad against 8 industry PM platforms (Asana, Jira, Linear, Monday, ClickUp, Notion, Wrike, Shortcut). Added 31 missing features across 9 categories to `todos.md`: collaboration (comments, activity feed, @mentions, file attachments), notifications (in-app, email, preferences), views (calendar, timeline/Gantt, table), task management (bulk actions, labels/tags, dependencies UI, rich text, archiving UI, recurring tasks), workflow (custom statuses, automation rules, task templates), reporting (burndown, velocity, dashboard), project management (edit details, portfolio), search (global search, saved filters), integrations (GitHub, Slack, webhooks, API docs), permissions (project-level roles). Added a prioritization section ranking all 58 uncompleted items across 7 tiers.

### Frontend Refactor — ProjectDetail Decomposition

Decomposed `ProjectDetail.tsx` from ~830 lines to ~357 lines (57% reduction). Extracted:
- `hooks/useProjectData.ts` (709 lines) — data fetching, mutations, sprint/task CRUD, AI ops
- `hooks/useTaskFiltering.ts` (63 lines) — search + status/priority/assignee filtering
- `hooks/useKeyboardShortcuts.ts` (100 lines) — j/k/Esc/n keyboard shortcuts
- `hooks/useToast.ts` (26 lines) — toast notification state
- `utils/taskHelpers.ts` (37 lines) — TASK_FIELDS, status↔column mapping
- `components/shared/` (5 files, 367 lines) — SearchInput, FilterBar, Icons, Toast, KeyboardShortcutHelp

Added semantic Tailwind colors (status/priority tokens) and animations (slide-in, fade-in). Removed 5 unused component files and 4 build artifacts.

### AI Subsystem Architecture Refactor

Decomposed monolithic `graphql/ai.ts` (367 lines) into dedicated `src/ai/` subsystem (10 files, 811 lines):

```
src/ai/
  index.ts          — barrel (public API)
  aiTypes.ts        — Zod schemas + inferred types
  aiConfig.ts       — model, per-feature max tokens, cost constants, system prompts
  aiClient.ts       — Anthropic wrapper (client reuse, error mapping, cache, size check)
  aiService.ts      — 6 feature functions with retry-on-validation-failure
  promptBuilder.ts  — per-feature prompt templates with context compression
  responseParser.ts — stripFences + Zod-validated JSON parsing
  tokenEstimator.ts — prompt size estimation + context window guard
  aiLogger.ts       — structured usage logging (feature, tokens, cost, latency, cache)
  aiCache.ts        — in-memory LRU cache (50 entries, TTL-based)
```

New capabilities: client reuse (cached per API key), auto-retry on Zod validation failure, LRU response caching (enabled for summarizeProject, 5min TTL), pre-flight prompt size estimation, structured JSON logging with cost estimates, centralized per-feature config, context compression (truncate descriptions to 200 chars, project text to 400 chars, cap sibling lists at 15), deterministic preprocessing (tasks pre-grouped by status for summaries).

Estimated token savings: summarizeProject ~60-80% reduction, generateTaskInstructions ~20-40% on large projects.

### Documentation

Updated: `todos.md`, `app-overview.md`, `decisions.md`, `CLAUDE.md`, `README.md`, `.gitignore`.

---

## 2026-03-12 (Session 1)

### Auth Flows

- Email verification on signup — `verificationToken` on User, `verifyEmail`/`sendVerificationEmail` mutations, `/verify-email` page, dev fallback logs to console
- Password reset — `resetToken`/`resetTokenExpiry` on User, `requestPasswordReset`/`resetPassword` mutations, `/forgot-password` and `/reset-password` pages
- Org member invite — `OrgInvite` model, `inviteOrgMember`/`acceptInvite`/`revokeInvite` mutations, `orgInvites` query, `/invite/accept` page, Team section in OrgSettings

### Sprint Management

- Sprint edit/delete, apiKeyHint fix, Docker Compose, env validation
- Offset-based pagination, task DnD ordering, drag between sprint sections
- Due dates with color-coded chips, project archiving, sprint velocity display

### Stack & Security

- Rewrote stack: Postgres/Prisma/GraphQL with security hardening (helmet, CORS, rate limiting, AI prompt injection defense, Zod validation)
- Updated README for current stack

### UX

- Skeleton loading states, step-by-step AI progress indicator, input blocking during generation
- Navigation warning during AI ops, AbortController cancellation
- Status ↔ kanban column bidirectional sync, keyboard shortcuts, search + filtering
