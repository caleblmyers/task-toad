import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { gql, restPost } from '../api/client';
import {
  ORG_USERS_QUERY,
  ORG_INVITES_QUERY,
  GITHUB_INSTALLATIONS_QUERY,
  SET_ORG_API_KEY_MUTATION,
  INVITE_ORG_MEMBER_MUTATION,
  LINK_GITHUB_INSTALLATION_MUTATION,
  REVOKE_INVITE_MUTATION,
  SET_PROMPT_LOGGING_MUTATION,
} from '../api/queries';
import { useFormState } from '../hooks/useFormState';
import type { Org, OrgUser, OrgInvite, GitHubInstallation } from '../types';
import AIUsageDashboard from '../components/AIUsageDashboard';
import UserAvatar from '../components/shared/UserAvatar';
import WebhookSettings from '../components/WebhookSettings';
import SlackSettings from '../components/SlackSettings';
import TeamCapacityPanel from '../components/TeamCapacityPanel';
import Tabs from '../components/shared/Tabs';
import Card from '../components/shared/Card';
import SectionHeader from '../components/shared/SectionHeader';
import Input from '../components/shared/Input';
import Select from '../components/shared/Select';
import { useLicenseFeatures } from '../hooks/useLicenseFeatures';

const GITHUB_APP_SLUG = import.meta.env.VITE_GITHUB_APP_SLUG as string | undefined;
const STRIPE_PRO_MONTHLY_PRICE_ID = import.meta.env.VITE_STRIPE_PRO_MONTHLY_PRICE_ID as string | undefined;
const STRIPE_PRO_ANNUAL_PRICE_ID = import.meta.env.VITE_STRIPE_PRO_ANNUAL_PRICE_ID as string | undefined;

/** Extended ORG query that includes billing fields */
const BILLING_ORG_QUERY = `query GetOrg { org { orgId name hasApiKey apiKeyHint promptLoggingEnabled plan licenseFeatures trialEndsAt stripeSubscriptionId } }`;

interface OrgBilling extends Org {
  trialEndsAt?: string | null;
  stripeSubscriptionId?: string | null;
}

export default function OrgSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasFeature } = useLicenseFeatures();
  const [org, setOrg] = useState<OrgBilling | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Support ?tab=billing deep link (e.g. from Stripe redirect or upgrade prompts)
  const initialTab = new URLSearchParams(window.location.search).get('tab') ?? undefined;

  // API Key form
  const apiKeyForm = useFormState(
    { apiKey: '' as string, confirmPassword: '' as string },
    async (values) => {
      if (!values.apiKey.trim() || !values.confirmPassword) return;
      const data = await gql<{ setOrgApiKey: Org }>(
        SET_ORG_API_KEY_MUTATION,
        { apiKey: values.apiKey.trim(), confirmPassword: values.confirmPassword }
      );
      setOrg(data.setOrgApiKey);
    },
    { resetOnSuccess: true }
  );

  // Team section state
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);

  const reloadInvites = async () => {
    const data = await gql<{ orgInvites: OrgInvite[] }>(ORG_INVITES_QUERY);
    setInvites(data.orgInvites);
  };

  // Team invite form
  const inviteForm = useFormState(
    { email: '' as string, role: 'org:member' as string },
    async (values) => {
      if (!values.email.trim()) return;
      await gql<{ inviteOrgMember: boolean }>(
        INVITE_ORG_MEMBER_MUTATION,
        { email: values.email.trim(), role: values.role }
      );
      await reloadInvites();
    },
    { resetOnSuccess: true }
  );

  // GitHub section state
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [loadingInstallations, setLoadingInstallations] = useState(true);
  const [linkErr, setLinkErr] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [linkingInstallation, setLinkingInstallation] = useState(false);

  const linkInstallation = (installationId: string, onDone: () => void) => {
    setLinkingInstallation(true);
    setLinkErr(null);
    gql<{ linkGitHubInstallation: GitHubInstallation }>(
      LINK_GITHUB_INSTALLATION_MUTATION,
      { installationId }
    )
      .then(() => {
        setLinkSuccess(true);
        onDone();
      })
      .catch((e) => {
        setLinkErr(e instanceof Error ? e.message : 'Failed to link installation');
        onDone();
      })
      .finally(() => setLinkingInstallation(false));
  };

  useEffect(() => {
    if (user?.role !== 'org:admin') {
      navigate('/home', { replace: true });
      return;
    }
    gql<{ org: OrgBilling }>(BILLING_ORG_QUERY)
      .then((data) => setOrg(data.org))
      .catch((e) => setLoadErr(e instanceof Error ? e.message : 'Failed to load org'));
    gql<{ orgUsers: OrgUser[] }>(ORG_USERS_QUERY)
      .then((data) => setOrgUsers(data.orgUsers))
      .catch(() => {/* non-critical */});
    gql<{ orgInvites: OrgInvite[] }>(ORG_INVITES_QUERY)
      .then((data) => setInvites(data.orgInvites))
      .catch(() => {/* non-critical */});

    // Load GitHub installations
    const loadInstallations = () => {
      setLoadingInstallations(true);
      gql<{ githubInstallations: GitHubInstallation[] }>(GITHUB_INSTALLATIONS_QUERY)
        .then((data) => setInstallations(data.githubInstallations))
        .catch(() => {/* non-critical */})
        .finally(() => setLoadingInstallations(false));
    };

    // Handle GitHub App callback — auto-link installation
    // This runs both in the main window AND in the popup window
    const params = new URLSearchParams(window.location.search);
    const callbackInstallationId = params.get('installation_id');
    if (callbackInstallationId) {
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);

      // If this is a popup, notify the opener and close
      if (window.opener) {
        window.opener.postMessage(
          { type: 'github-installation', installationId: callbackInstallationId },
          window.location.origin
        );
        window.close();
        return;
      }

      // Otherwise handle inline (direct navigation fallback)
      // Defer to avoid setState-during-render lint warning
      setTimeout(() => linkInstallation(callbackInstallationId, loadInstallations), 0);
    } else {
      loadInstallations();
    }

    // Listen for messages from popup window
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'github-installation') {
        linkInstallation(event.data.installationId, loadInstallations);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInstallGitHubApp = () => {
    if (!GITHUB_APP_SLUG) return;
    const url = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    window.open(url, 'github-install', `width=${width},height=${height},left=${left},top=${top}`);
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      await gql<{ revokeInvite: boolean }>(
        REVOKE_INVITE_MUTATION,
        { inviteId }
      );
      setInvites((prev) => prev.filter((i) => i.inviteId !== inviteId));
    } catch (error) {
      inviteForm.setError(error instanceof Error ? error.message : 'Failed to revoke invite');
    }
  };

  if (!org) {
    return <div className="p-4 text-slate-500">{loadErr ?? 'Loading…'}</div>;
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-6">Settings</h1>

      <Tabs
        defaultTab={initialTab}
        tabs={[
          {
            id: 'general',
            label: 'General',
            content: (
              <Card className="space-y-6">
                <div>
                  <SectionHeader>Organization</SectionHeader>
                  <p className="text-lg text-slate-800 dark:text-slate-200 mt-1">{org.name}</p>
                </div>

                <div>
                  <SectionHeader>Anthropic API Key</SectionHeader>
                  {org.hasApiKey ? (
                    <p className="text-slate-700 dark:text-slate-300 font-mono text-sm">
                      {org.apiKeyHint} <span className="text-slate-400 font-sans">(configured)</span>
                    </p>
                  ) : (
                    <p className="text-amber-600 text-sm">Not configured — AI features are disabled.</p>
                  )}
                </div>

                <form onSubmit={apiKeyForm.handleSubmit} className="space-y-3">
                  <Input
                    label={org.hasApiKey ? 'Replace API key' : 'Add API key'}
                    type="password"
                    placeholder="sk-ant-..."
                    value={apiKeyForm.values.apiKey}
                    onChange={(e) => apiKeyForm.setValue('apiKey', e.target.value)}
                    error={apiKeyForm.error ?? undefined}
                    className="font-mono"
                    autoComplete="off"
                  />
                  <Input
                    label="Confirm your password"
                    type="password"
                    placeholder="Enter your password"
                    value={apiKeyForm.values.confirmPassword}
                    onChange={(e) => apiKeyForm.setValue('confirmPassword', e.target.value)}
                    autoComplete="off"
                  />
                  {apiKeyForm.success && <p className="text-sm text-green-600">API key saved.</p>}
                  <button
                    type="submit"
                    disabled={apiKeyForm.loading || !apiKeyForm.values.apiKey.trim() || !apiKeyForm.values.confirmPassword}
                    className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {apiKeyForm.loading ? 'Saving…' : 'Save'}
                  </button>
                </form>
              </Card>
            ),
          },
          {
            id: 'team',
            label: 'Team',
            content: (
              <Card className="space-y-6">
                {/* Current members */}
                <div>
                  <SectionHeader>Members</SectionHeader>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {orgUsers.map((u) => (
                      <li key={u.userId} className="py-2 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <UserAvatar email={u.email} size="sm" />
                          <span className="text-slate-800 dark:text-slate-200">{u.email}</span>
                        </div>
                        <span className="text-slate-500">{u.role ?? '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Pending invites */}
                {invites.length > 0 && (
                  <div>
                    <SectionHeader>Pending Invites</SectionHeader>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {invites.map((inv) => (
                        <li key={inv.inviteId} className="py-2 flex items-center justify-between text-sm gap-2">
                          <div>
                            <span className="text-slate-800 dark:text-slate-200">{inv.email}</span>
                            <span className="ml-2 text-slate-500">{inv.role}</span>
                            <span className="ml-2 text-slate-400 text-xs">
                              expires {new Date(inv.expiresAt).toLocaleDateString()}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRevoke(inv.inviteId)}
                            className="text-red-600 hover:text-red-800 text-xs"
                          >
                            Revoke
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Invite form */}
                <div>
                  <SectionHeader>Invite member</SectionHeader>
                  <form onSubmit={inviteForm.handleSubmit} className="space-y-2">
                    <Input
                      label="Email address"
                      type="email"
                      value={inviteForm.values.email}
                      onChange={(e) => inviteForm.setValue('email', e.target.value)}
                      required
                    />
                    <Select
                      label="Role"
                      value={inviteForm.values.role}
                      onChange={(e) => inviteForm.setValue('role', e.target.value)}
                    >
                      <option value="org:member">Member</option>
                      <option value="org:admin">Admin</option>
                    </Select>
                    {inviteForm.error && <p className="text-sm text-red-600" aria-live="polite">{inviteForm.error}</p>}
                    {inviteForm.success && <p className="text-sm text-green-600" aria-live="polite">Invite sent!</p>}
                    <button
                      type="submit"
                      disabled={inviteForm.loading || !inviteForm.values.email.trim()}
                      className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {inviteForm.loading ? 'Sending…' : 'Send invite'}
                    </button>
                  </form>
                </div>
              </Card>
            ),
          },
          {
            id: 'integrations',
            label: 'Integrations',
            content: (
              <div className="space-y-6">
                {/* GitHub */}
                <Card className="space-y-6">
                  <SectionHeader>GitHub</SectionHeader>

                  {linkErr && <p className="text-sm text-red-600">{linkErr}</p>}
                  {linkSuccess && <p className="text-sm text-green-600">GitHub App linked successfully!</p>}

                  {loadingInstallations ? (
                    <p className="text-sm text-slate-500">Loading…</p>
                  ) : installations.length > 0 ? (
                    <div>
                      <SectionHeader>Installations</SectionHeader>
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {installations.map((inst) => (
                          <li key={inst.installationId} className="py-2 flex items-center justify-between text-sm">
                            <div>
                              <span className="text-slate-800 dark:text-slate-200 font-medium">{inst.accountLogin}</span>
                              <span className="ml-2 text-slate-500">{inst.accountType}</span>
                            </div>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              Connected
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No GitHub App installed.</p>
                  )}

                  {linkingInstallation && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-brand-green rounded-full animate-spin" />
                      Linking installation…
                    </div>
                  )}

                  {GITHUB_APP_SLUG && (
                    <button
                      type="button"
                      onClick={handleInstallGitHubApp}
                      disabled={linkingInstallation}
                      className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50 text-sm"
                    >
                      {installations.length > 0 ? 'Add another installation' : 'Install GitHub App'}
                    </button>
                  )}
                </Card>

                {/* Slack (premium) */}
                {hasFeature('slack') && (
                  <Card className="space-y-6">
                    <SectionHeader>Slack</SectionHeader>
                    <SlackSettings />
                  </Card>
                )}
              </div>
            ),
          },
          {
            id: 'webhooks',
            label: 'Webhooks',
            content: (
              <Card className="space-y-6">
                <WebhookSettings />
              </Card>
            ),
          },
          {
            id: 'capacity',
            label: 'Capacity',
            content: (
              <Card className="space-y-6">
                <SectionHeader>Team Capacity</SectionHeader>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Set default working hours per week for each team member and manage time-off entries.
                  This data is used by AI sprint planning for more accurate task distribution.
                </p>
                <TeamCapacityPanel orgUsers={orgUsers} />
              </Card>
            ),
          },
          {
            id: 'ai',
            label: 'AI',
            content: (
              <div className="space-y-6">
                <Card className="space-y-6">
                  <SectionHeader>AI Settings</SectionHeader>

                  {/* Prompt Logging Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Prompt Logging</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        When enabled, AI prompts and responses are stored for auditing and debugging.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={org.promptLoggingEnabled !== false}
                      onClick={async () => {
                        const newValue = org.promptLoggingEnabled === false;
                        setOrg({ ...org, promptLoggingEnabled: newValue });
                        try {
                          await gql<{ setAIBudget: Org }>(
                            SET_PROMPT_LOGGING_MUTATION,
                            { promptLoggingEnabled: newValue }
                          );
                        } catch (error) {
                          setOrg({ ...org, promptLoggingEnabled: !newValue });
                          setLoadErr(error instanceof Error ? error.message : 'Failed to update prompt logging');
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 ${
                        org.promptLoggingEnabled !== false ? 'bg-brand-green' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          org.promptLoggingEnabled !== false ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </Card>

                <Card className="space-y-6">
                  <SectionHeader>AI Usage</SectionHeader>
                  <AIUsageDashboard />
                </Card>
              </div>
            ),
          },
          {
            id: 'knowledge',
            label: 'Knowledge Base',
            content: <OrgKnowledgeBaseTab />,
          },
          // Billing tab hidden — all features free (open source pivot)
          // Stripe code preserved in BillingTab component for portfolio reference
        ]}
      />
    </div>
  );
}

const PREMIUM_FEATURE_LIST = [
  { key: 'slack', label: 'Slack integration' },
  { key: 'initiatives', label: 'Initiatives' },
  { key: 'sla', label: 'SLA tracking' },
  { key: 'approvals', label: 'Approval workflows' },
  { key: 'cron_automations', label: 'Scheduled automations' },
  { key: 'workflow_restrictions', label: 'Workflow restrictions' },
  { key: 'field_permissions', label: 'Field permissions' },
  { key: 'project_roles', label: 'Project member roles' },
];

// Billing tab hidden (open source pivot) — component preserved for portfolio reference
export function BillingTab({ org }: { org: OrgBilling }) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPaid = org.plan === 'paid';
  const hasSubscription = !!org.stripeSubscriptionId;
  const trialEndsAt = org.trialEndsAt ? new Date(org.trialEndsAt) : null;
  const trialExpired = trialEndsAt ? new Date() > trialEndsAt : false;
  const trialDaysRemaining = trialEndsAt && !trialExpired
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60_000)))
    : 0;
  const isOnTrial = isPaid && trialEndsAt && !trialExpired && !hasSubscription;
  const effectivePlan = isPaid && !trialExpired ? 'paid' : (hasSubscription ? 'paid' : 'free');

  const handleCheckout = async () => {
    const priceId = billingCycle === 'annual' ? STRIPE_PRO_ANNUAL_PRICE_ID : STRIPE_PRO_MONTHLY_PRICE_ID;
    if (!priceId) {
      setError('Stripe price IDs not configured');
      return;
    }
    setCheckoutLoading(true);
    setError(null);
    try {
      const data = await restPost<{ url: string }>('/stripe/checkout', { priceId });
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const data = await restPost<{ url: string }>('/stripe/portal');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current plan status */}
      <Card className="space-y-4">
        <SectionHeader>Current Plan</SectionHeader>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              effectivePlan === 'paid'
                ? 'bg-brand-green/10 text-brand-green'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {effectivePlan === 'paid' ? 'Pro' : 'Free'}
          </span>
          {isOnTrial && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Trial: {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining
            </span>
          )}
          {trialExpired && !hasSubscription && (
            <span className="text-xs text-red-600 dark:text-red-400">Trial expired</span>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Paid org with active subscription */}
        {hasSubscription && (
          <div>
            <button
              onClick={() => void handlePortal()}
              disabled={portalLoading}
              className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50 text-sm"
            >
              {portalLoading ? 'Loading...' : 'Manage Subscription'}
            </button>
          </div>
        )}
      </Card>

      {/* Upgrade section — show for free orgs or trial orgs without subscription */}
      {!hasSubscription && (
        <Card className="space-y-4">
          <SectionHeader>Upgrade to Pro</SectionHeader>

          {/* Billing cycle toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                billingCycle === 'monthly'
                  ? 'border-brand-green bg-brand-green/10 text-brand-green font-medium'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              Monthly — $19/mo
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                billingCycle === 'annual'
                  ? 'border-brand-green bg-brand-green/10 text-brand-green font-medium'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              Annual — $190/yr
              <span className="ml-1 text-xs text-green-600 dark:text-green-400">(save $38)</span>
            </button>
          </div>

          <button
            onClick={() => void handleCheckout()}
            disabled={checkoutLoading}
            className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50 text-sm font-medium"
          >
            {checkoutLoading ? 'Redirecting...' : 'Upgrade Now'}
          </button>
        </Card>
      )}

      {/* Feature comparison */}
      <Card className="space-y-4">
        <SectionHeader>Feature Comparison</SectionHeader>
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800">
                <th className="text-left px-4 py-2 font-medium text-slate-600 dark:text-slate-300">Feature</th>
                <th className="text-center px-4 py-2 font-medium text-slate-600 dark:text-slate-300">Free</th>
                <th className="text-center px-4 py-2 font-medium text-slate-600 dark:text-slate-300">Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              <tr>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-300">Projects</td>
                <td className="text-center px-4 py-2 text-slate-600 dark:text-slate-400">3</td>
                <td className="text-center px-4 py-2 text-green-600">Unlimited</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-300">Team members</td>
                <td className="text-center px-4 py-2 text-slate-600 dark:text-slate-400">3</td>
                <td className="text-center px-4 py-2 text-green-600">Unlimited</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-300">Concurrent task execution</td>
                <td className="text-center px-4 py-2 text-slate-600 dark:text-slate-400">1</td>
                <td className="text-center px-4 py-2 text-green-600">3 parallel</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-300">AI task planning &amp; code generation</td>
                <td className="text-center px-4 py-2 text-green-600">&#10003;</td>
                <td className="text-center px-4 py-2 text-green-600">&#10003;</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-300">GitHub integration</td>
                <td className="text-center px-4 py-2 text-green-600">&#10003;</td>
                <td className="text-center px-4 py-2 text-green-600">&#10003;</td>
              </tr>
              {PREMIUM_FEATURE_LIST.map((f) => (
                <tr key={f.key}>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{f.label}</td>
                  <td className="text-center px-4 py-2 text-slate-300 dark:text-slate-600">&mdash;</td>
                  <td className="text-center px-4 py-2 text-green-600">&#10003;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// --- GraphQL queries/mutations for org KB ---
const ORG_KB_ENTRIES_QUERY = `query OrgKBEntries {
  knowledgeEntries(orgOnly: true) {
    knowledgeEntryId title content source category createdAt updatedAt
  }
}`;

const CREATE_ORG_KB_ENTRY = `mutation CreateOrgKBEntry($title: String!, $content: String!, $category: String) {
  createKnowledgeEntry(title: $title, content: $content, source: "upload", category: $category) {
    knowledgeEntryId title content source category createdAt updatedAt
  }
}`;

const UPDATE_ORG_KB_ENTRY = `mutation UpdateOrgKBEntry($knowledgeEntryId: ID!, $title: String, $content: String, $category: String) {
  updateKnowledgeEntry(knowledgeEntryId: $knowledgeEntryId, title: $title, content: $content, category: $category) {
    knowledgeEntryId title content source category createdAt updatedAt
  }
}`;

const DELETE_ORG_KB_ENTRY = `mutation DeleteOrgKBEntry($knowledgeEntryId: ID!) {
  deleteKnowledgeEntry(knowledgeEntryId: $knowledgeEntryId)
}`;

type KBCategory = 'standard' | 'pattern' | 'business' | 'integration';

const KB_CATEGORIES: { value: KBCategory; label: string; color: string }[] = [
  { value: 'standard', label: 'Standard', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  { value: 'pattern', label: 'Pattern', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  { value: 'business', label: 'Business', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  { value: 'integration', label: 'Integration', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
];

interface KBEntry {
  knowledgeEntryId: string;
  title: string;
  content: string;
  source: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

function OrgKnowledgeBaseTab() {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KBEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<KBCategory>('standard');
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gql<{ knowledgeEntries: KBEntry[] }>(ORG_KB_ENTRIES_QUERY);
      setEntries(data.knowledgeEntries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormCategory('standard');
    setEditingEntry(null);
    setShowForm(false);
  };

  const openEditForm = (entry: KBEntry) => {
    setFormTitle(entry.title);
    setFormContent(entry.content);
    setFormCategory(entry.category as KBCategory);
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingEntry) {
        const data = await gql<{ updateKnowledgeEntry: KBEntry }>(
          UPDATE_ORG_KB_ENTRY,
          {
            knowledgeEntryId: editingEntry.knowledgeEntryId,
            title: formTitle.trim(),
            content: formContent,
            category: formCategory,
          }
        );
        setEntries((prev) =>
          prev.map((e) =>
            e.knowledgeEntryId === editingEntry.knowledgeEntryId
              ? data.updateKnowledgeEntry
              : e
          )
        );
      } else {
        const data = await gql<{ createKnowledgeEntry: KBEntry }>(
          CREATE_ORG_KB_ENTRY,
          { title: formTitle.trim(), content: formContent, category: formCategory }
        );
        setEntries((prev) => [data.createKnowledgeEntry, ...prev]);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (knowledgeEntryId: string) => {
    setError(null);
    try {
      await gql<{ deleteKnowledgeEntry: boolean }>(DELETE_ORG_KB_ENTRY, { knowledgeEntryId });
      setEntries((prev) => prev.filter((e) => e.knowledgeEntryId !== knowledgeEntryId));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    }
  };

  const getCategoryBadge = (category: string) => {
    const cat = KB_CATEGORIES.find((c) => c.value === category);
    if (!cat) return null;
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${cat.color}`}>
        {cat.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <SectionHeader>Organization Knowledge Base</SectionHeader>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Org-level entries are included in AI prompts for all projects in this organization.
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-3 py-1.5 text-xs text-white bg-slate-700 dark:bg-slate-600 rounded-lg hover:bg-slate-600 dark:hover:bg-slate-500"
          >
            + Add Entry
          </button>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {/* Create/Edit Form */}
        {showForm && (
          <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              {editingEntry ? 'Edit Entry' : 'New Entry'}
            </h3>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Title"
              className="w-full mb-2 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green"
            />
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Content — coding standards, conventions, architectural decisions..."
              rows={6}
              className="w-full mb-2 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green resize-y"
            />
            <div className="flex items-center justify-between">
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as KBCategory)}
                className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-green"
              >
                {KB_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={resetForm}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formTitle.trim() || !formContent.trim()}
                  className="px-3 py-1.5 text-xs text-white bg-slate-700 dark:bg-slate-600 rounded-lg hover:bg-slate-600 dark:hover:bg-slate-500 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingEntry ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Entry List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-slate-100 dark:bg-slate-700 animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              No org-level knowledge entries yet
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Add entries to give AI context that applies across all projects.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.knowledgeEntryId}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
                        {entry.title}
                      </span>
                      {getCategoryBadge(entry.category)}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {entry.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditForm(entry)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {deleteConfirm === entry.knowledgeEntryId ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(entry.knowledgeEntryId)}
                          className="px-2 py-0.5 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-0.5 text-xs text-slate-500 border border-slate-300 rounded hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(entry.knowledgeEntryId)}
                        className="p-1 text-slate-400 hover:text-red-500"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
