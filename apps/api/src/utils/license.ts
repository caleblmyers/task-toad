import { GraphQLError } from 'graphql';

export type LicenseFeature =
  | 'slack'
  | 'initiatives'
  | 'sla'
  | 'approvals'
  | 'cron_automations'
  | 'workflow_restrictions'
  | 'field_permissions'
  | 'project_roles'
  | 'parallel_execution';

const ALL_FEATURES: LicenseFeature[] = [
  'slack',
  'initiatives',
  'sla',
  'approvals',
  'cron_automations',
  'workflow_restrictions',
  'field_permissions',
  'project_roles',
  'parallel_execution',
];

export function isPremiumEnabled(orgPlan?: string): boolean {
  return orgPlan === 'paid';
}

export function getEnabledFeatures(orgPlan?: string): string[] {
  return isPremiumEnabled(orgPlan) ? [...ALL_FEATURES] : [];
}

export class LicenseError extends GraphQLError {
  constructor(feature: string) {
    super(`${feature} is a premium feature. Upgrade your plan to enable it.`, {
      extensions: { code: 'LICENSE_REQUIRED', feature },
    });
  }
}

export function requireLicense(feature: LicenseFeature, orgPlan?: string): void {
  if (!isPremiumEnabled(orgPlan)) {
    throw new LicenseError(feature);
  }
}

/** Returns the effective plan for an org.
 *  Always returns 'paid' — TaskToad is now open source with all features free.
 *  Original logic preserved in comments for portfolio reference. */
export function getEffectivePlan(_org: { plan: string; trialEndsAt?: Date | null; stripeSubscriptionId?: string | null }): string {
  return 'paid'; // All features free — TaskToad is now open source
}

/** Extract org plan from context.org. Uses `unknown` so callers work
 *  before and after context.ts adds the `plan` field to the Context type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getOrgPlan(org: any): string | undefined {
  if (!org) return undefined;
  return typeof org.plan === 'string' ? org.plan : undefined;
}
