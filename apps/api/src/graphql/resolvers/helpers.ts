import { NotFoundError } from '../errors.js';

/**
 * Load an entity and verify org ownership in one step.
 *
 * Uses a delegate pattern so callers keep full type-safety —
 * the finder function determines what gets loaded and what type is returned.
 *
 * @example
 * const field = await requireEntity(
 *   () => prisma.customField.findUnique({ where: { customFieldId } }),
 *   user.orgId,
 *   'Custom field',
 * );
 *
 * @example With a custom ownership check (e.g. userId instead of orgId):
 * const filter = await requireEntity(
 *   () => prisma.savedFilter.findUnique({ where: { savedFilterId }, include: { project: true } }),
 *   user.orgId,
 *   'Saved filter',
 *   (f) => f.userId === user.userId && f.project.orgId === user.orgId,
 * );
 */
export async function requireEntity<T extends { orgId: string }>(
  findFn: () => Promise<T | null>,
  orgId: string,
  label: string,
): Promise<T>;
export async function requireEntity<T>(
  findFn: () => Promise<T | null>,
  orgId: string,
  label: string,
  ownershipCheck: (entity: T) => boolean,
): Promise<T>;
export async function requireEntity<T>(
  findFn: () => Promise<T | null>,
  orgId: string,
  label: string,
  ownershipCheck?: (entity: T) => boolean,
): Promise<T> {
  const entity = await findFn();
  if (!entity) {
    throw new NotFoundError(`${label} not found`);
  }
  const owned = ownershipCheck
    ? ownershipCheck(entity)
    : (entity as T & { orgId: string }).orgId === orgId;
  if (!owned) {
    throw new NotFoundError(`${label} not found`);
  }
  return entity;
}
