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

export const isPremiumEnabled = !!process.env.TASKTOAD_LICENSE;

export function getEnabledFeatures(): string[] {
  return isPremiumEnabled ? [...ALL_FEATURES] : [];
}

export class LicenseError extends GraphQLError {
  constructor(feature: string) {
    super(`${feature} is a premium feature. Set TASKTOAD_LICENSE to enable.`, {
      extensions: { code: 'LICENSE_REQUIRED', feature },
    });
  }
}

export function requireLicense(feature: LicenseFeature): void {
  if (!isPremiumEnabled) {
    throw new LicenseError(feature);
  }
}

if (isPremiumEnabled) {
  logger.info('Premium license detected — all features enabled');
} else {
  logger.info('No license key — running in open source mode');
}
