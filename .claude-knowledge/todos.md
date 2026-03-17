# Remaining Work

All original work sets completed through Wave 25. Waves 22-26 addressed UX audit, polish, and accessibility. Completed items are in `changelog.md`. What remains is minor polish.

---

## Swarm Rules

- **Task sizing:** 30-60 min per task. Full vertical slices (schema + resolver + typeDefs + frontend).
- **Parallelism:** Check file overlap. Two sets can run in parallel if their `files` arrays don't overlap.
- **File structure:** Prisma: `prisma/schema/`, TypeDefs: `typedefs/`, Resolvers: `resolvers/` — all domain-split.

---

## Remaining Work

### Accessibility
- [ ] ARIA audit for NotificationSettings — checkboxes lack aria-labels; should match ProjectToolbar's ARIA patterns
- [ ] Export menu Enter key — keyboard-only users need Enter support on focused menuitem
- [ ] Sidebar collapse: notification preferences button hidden when collapsed; overlay doesn't show

### Design System
- [ ] Card component — AppLayout notification panel still uses inline card div
- [ ] Badge component — SlackSettings status indicators still inline

### API / Backend
- [ ] Shared-types expansion — add Report type to `@tasktoad/shared-types` (Comment already exists)
- [ ] S3 multipart upload — current 10MB limit uses single PUT; implement multipart for larger files

### Architecture / DX
- [ ] useAsyncData adoption — migrate other components with inline fetch-in-useEffect patterns
- [ ] Task detail re-architecture (UX Audit Item 10) — collapsible sections, tabbed comments/activity

### Process (non-code)
- [ ] Task descriptions creating new workspace packages should note: point `types` to source not dist
