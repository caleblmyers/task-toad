# Remaining Work

All original work sets completed through Wave 25. Waves 22-26 addressed UX audit, polish, and accessibility. Completed items are in `changelog.md`. What remains is minor polish.

---

## Swarm Rules

- **Task sizing:** 30-60 min per task. Full vertical slices (schema + resolver + typeDefs + frontend).
- **Parallelism:** Check file overlap. Two sets can run in parallel if their `files` arrays don't overlap.
- **File structure:** Prisma: `prisma/schema/`, TypeDefs: `typedefs/`, Resolvers: `resolvers/` — all domain-split.

---

## Remaining Work

### Beta Scope — Completed (2026-03-17)
- [x] SSE notification broadcast (real-time notifications via fetch-based SSE)
- [x] JWT hardening (HMAC HS256, helmet, CORS, rate limiting)
- [x] NewProject resilience (error handling, validation)
- [x] Prometheus metrics (`/api/metrics` with prom-client)

### Beta Scope — Known Limitations
- [ ] **Project-level access control** — org-level read access for beta (all org members can access all projects). Project-level RBAC deferred to post-beta.
- [ ] **Runner / autonomous execution** — AutonomousSprintPanel and sprintRunner were aspirational features never built. Excluded from beta. TaskToad is AI-assisted (not autonomous) project management.

### Accessibility
- [x] ARIA audit for NotificationSettings — checkboxes lack aria-labels; should match ProjectToolbar's ARIA patterns (Wave 27)
- [x] Export menu Enter key — keyboard-only users need Enter support on focused menuitem (Wave 27)
- [x] Sidebar collapse: notification preferences button hidden when collapsed; overlay doesn't show (Wave 27)
- [ ] Remaining ARIA audit — screen reader testing, focus management on modal open/close, skip nav landmark coverage

### Design System
- [x] Card component — AppLayout notification panel still uses inline card div (Wave 27)
- [x] Badge component — SlackSettings status indicators still inline (Wave 27)

### API / Backend
- [ ] Shared-types expansion — add Report type to `@tasktoad/shared-types` (Comment already exists)
- [ ] S3 multipart upload — current 10MB limit uses single PUT; implement multipart for larger files

### Architecture / DX
- [ ] useAsyncData adoption — migrate other components with inline fetch-in-useEffect patterns
- [ ] Task detail re-architecture (UX Audit Item 10) — collapsible sections, tabbed comments/activity
- [x] Dead code cleanup: remove `CodePreviewModal`, `BatchCodeGenModal`, manual code gen handlers from `useAIGeneration`/`useProjectData`, and `generateCodeFromTask`/`regenerateCodeFile` GraphQL mutations (backend). All superseded by action plan pipeline. (Wave 27)
- [x] Deduplicate SSE connections — ProjectDetail creates a second SSE connection alongside AppLayout's. Consider a shared context or window event relay. (Wave 27)
- [ ] Remove deprecated `useEventSource` hook — still exported for backward compat but no longer used by any component. Can be deleted once confirmed unused.
- [ ] Clean up `BatchCodeGenerationSchema` and `buildBatchCodeGenerationPrompt` from `aiTypes.ts` and `promptBuilder.ts` — the resolver was removed but the AI types/prompt builder still export them

### Process (non-code)
- [ ] Task descriptions creating new workspace packages should note: point `types` to source not dist
