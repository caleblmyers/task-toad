import { GraphQLError } from 'graphql';
import { logger } from './logger.js';

export type LicenseFeature =
  | 'slack'
  | 'initiatives'
  | 'sla'
  | 'approvals'
  | 'cron_automations'
  | 'workflow_restrictions'
  | 'field_permissions'
  | 'project_roles';

const ALL_FEATURES: LicenseFeature[] = [
  'slack',
  'initiatives',
  'sla',
  'approvals',
  'cron_automations',
  'workflow_restrictions',
  'field_permissions',
  'project_roles',
];

const SELF_HOST_OVERRIDE = !!process.env.TASKTOAD_LICENSE;

export function isPremiumEnabled(orgPlan?: string): boolean {
  if (SELF_HOST_OVERRIDE) return true;
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

/** Extract org plan from context.org. Uses `unknown` so callers work
 *  before and after context.ts adds the `plan` field to the Context type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getOrgPlan(org: any): string | undefined {
  if (!org) return undefined;
  return typeof org.plan === 'string' ? org.plan : undefined;
}

if (SELF_HOST_OVERRIDE) {
  logger.info('Premium license detected — all features enabled (self-host override)');
} else {
  logger.info('No license key — running in open source mode');
}
