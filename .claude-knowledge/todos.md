# Remaining Work

All original work sets (Q1, A11, W2, W6, D1, I1, F1, S1, SW1) are **completed** through Wave 25. Completed items are in `changelog.md`. What remains are follow-ups and polish.

---

## Swarm Rules

- **Task sizing:** 30-60 min per task. Full vertical slices (schema + resolver + typeDefs + frontend).
- **Parallelism:** Check file overlap. Two sets can run in parallel if their `files` arrays don't overlap.
- **File structure:** Prisma: `prisma/schema/`, TypeDefs: `typedefs/`, Resolvers: `resolvers/` — all domain-split.

---

## Remaining Work by Category

### Accessibility
**Touches:** `apps/web/src/components/`, `apps/web/src/pages/`
- [ ] Focus trap for ProjectToolbar overlays — template dialog and export menu don't trap focus; consider a reusable `useFocusTrap` hook
- [ ] Mobile drawer focus trap — Tab can escape the drawer to background elements; needs focus containment
- [ ] ARIA audit for remaining overlays — NotificationCenter, NotificationSettings, and modals should match ProjectToolbar's ARIA patterns
- [ ] Export menu Enter key — keyboard-only users need Enter support on focused menuitem (currently click-handler only)

### Responsive
**Touches:** `apps/web/src/components/ProjectToolbar.tsx`, `apps/web/src/components/TaskDetailPanel.tsx`, `apps/web/src/pages/AppLayout.tsx`
- [ ] Responsive ProjectToolbar — toolbar buttons overflow on narrow screens; needs responsive stacking or overflow menu
- [ ] Responsive task detail panel — on mobile should be a drawer or sheet overlay instead of full-width
- [ ] Sidebar collapse: notification preferences button hidden when collapsed; overlay doesn't show

### Design System Adoption
**Touches:** `apps/web/src/components/`
- [ ] Card component — remaining files with inline `bg-white dark:bg-slate-900 rounded-lg border...` patterns (AppLayout notification panel, others)
- [ ] Badge component — remaining files beyond the 16 migrated in Waves 24-25 (DependencyBadge, SlackSettings status indicators)
- [ ] Badge `pink` variant — `design-tool` and `ai-model` both map to `purple` in TaskDetailPanel; differentiate with a new variant

### API / Backend
**Touches:** `packages/shared-types/`, `apps/api/`
- [ ] Shared-types expansion — add Comment and Report types to `@tasktoad/shared-types` so resolvers can re-export them
- [ ] S3 multipart upload — current 10MB limit uses single PUT; implement multipart for larger files

### Architecture / DX
- [ ] useAsyncData hook — BurndownChart/Projects use inline fetch-in-useEffect with cancellation flags; extract to shared hook if pattern recurs
- [ ] Task detail re-architecture (UX Audit Item 10) — collapsible sections, prioritized field order, tabbed comments/activity. Functional as-is; polish after core UX ships.

### Process (non-code)
- [ ] Task descriptions creating new workspace packages should note: point `types` to source (`src/index.ts`) not dist

---

## Parallelism Matrix

**Safe parallel combos:**
- Accessibility + API/Backend (no file overlap)
- Responsive + Design System Adoption (different files if scoped carefully)
- Architecture + any other set

**Conflicts:**
- Accessibility + Responsive (both touch AppLayout, ProjectToolbar)
- Design System + Responsive (both touch component JSX)
