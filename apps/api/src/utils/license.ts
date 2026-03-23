import { GraphQLError } from 'graphql';
import { logger } from './logger.js';

// ── License types ──

export type LicenseFeature =
  | 'slack'
  | 'initiatives'
  | 'sla'
  | 'approvals'
  | 'cron_automations'
  | 'workflow_restrictions'
  | 'field_permissions'
  | 'project_roles';

// ── License state ──

export const isPremiumEnabled = !!process.env.TASKTOAD_LICENSE;

if (!isPremiumEnabled) {
  logger.info('No license key — running in open source mode');
}

// ── License helpers ──

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

export function getEnabledFeatures(): string[] {
  if (!isPremiumEnabled) return [];
  return [
    'slack',
    'initiatives',
    'sla',
    'approvals',
    'cron_automations',
    'workflow_restrictions',
    'field_permissions',
    'project_roles',
  ];
}
