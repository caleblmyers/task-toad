const PREMIUM_FEATURES = [
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

// All features free — TaskToad is now open source
export function useLicenseFeatures() {
  return {
    features: PREMIUM_FEATURES,
    hasFeature: (_f: string) => true,
    loading: false,
  };
}
