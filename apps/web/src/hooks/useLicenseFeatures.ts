import { useAuth } from '../auth/context';

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

export function useLicenseFeatures() {
  const { user, loading } = useAuth();
  const isPaid = user?.orgPlan === 'paid';
  const features = isPaid ? PREMIUM_FEATURES : [];

  return {
    features,
    hasFeature: (f: string) => isPaid && PREMIUM_FEATURES.includes(f),
    loading,
  };
}
