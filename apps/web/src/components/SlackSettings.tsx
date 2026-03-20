import { useState, useEffect } from 'react';
import { gql } from '../api/client';
import {
  SLACK_INTEGRATIONS_QUERY,
  CONNECT_SLACK_MUTATION,
  SLACK_ORG_USERS_QUERY,
  SLACK_USER_MAPPINGS_QUERY,
  MAP_SLACK_USER_MUTATION,
  UNMAP_SLACK_USER_MUTATION,
  UPDATE_SLACK_INTEGRATION_MUTATION,
  TEST_SLACK_INTEGRATION_MUTATION,
  DISCONNECT_SLACK_MUTATION,
} from '../api/queries';
import { useFormState } from '../hooks/useFormState';
import { useConfirmDialog } from './shared/ConfirmDialog';
import Badge from './shared/Badge';

interface SlackIntegration {
  id: string;
  teamId: string;
  teamName: string;
  channelId: string;
  channelName: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
}

interface SlackUserMapping {
  id: string;
  slackUserId: string;
  slackTeamId: string;
  userId: string;
  orgId: string;
  createdAt: string;
  user: { userId: string; email: string; displayName: string | null } | null;
}

interface OrgUser {
  userId: string;
  email: string;
  displayName: string | null;
}

const SUPPORTED_EVENTS = [
  'task.created',
  'task.updated',
  'task.deleted',
  'sprint.created',
  'sprint.closed',
  'comment.created',
];

export default function SlackSettings() {
  const { confirm, ConfirmDialogPortal } = useConfirmDialog();
  const [integrations, setIntegrations] = useState<SlackIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Connect Slack form
  const [showForm, setShowForm] = useState(false);
  const connectForm = useFormState(
    { webhookUrl: '', teamId: '', teamName: '', channelId: '', channelName: '', events: ['task.created', 'task.updated'] as string[] },
    async (values) => {
      if (!values.webhookUrl.trim() || values.events.length === 0) return;
      const data = await gql<{ connectSlack: SlackIntegration }>(
        CONNECT_SLACK_MUTATION,
        {
          webhookUrl: values.webhookUrl.trim(),
          teamId: values.teamId.trim(),
          teamName: values.teamName.trim(),
          channelId: values.channelId.trim(),
          channelName: values.channelName.trim(),
          events: values.events,
        }
      );
      setIntegrations((prev) => [data.connectSlack, ...prev]);
      setShowForm(false);
    },
    { resetOnSuccess: true }
  );

  // Testing state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean } | null>(null);

  // User mapping state
  const [mappings, setMappings] = useState<SlackUserMapping[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const mappingForm = useFormState(
    { slackUserId: '', userId: '' },
    async (values) => {
      if (!selectedIntegrationId || !values.slackUserId.trim() || !values.userId) return;
      const integration = integrations.find((i) => i.id === selectedIntegrationId);
      if (!integration) return;
      const data = await gql<{ mapSlackUser: SlackUserMapping }>(
        MAP_SLACK_USER_MUTATION,
        { slackUserId: values.slackUserId.trim(), slackTeamId: integration.teamId, userId: values.userId }
      );
      setMappings((prev) => [data.mapSlackUser, ...prev.filter((m) => m.id !== data.mapSlackUser.id)]);
    },
    { resetOnSuccess: true }
  );

  const fetchIntegrations = () => {
    setLoading(true);
    gql<{ slackIntegrations: SlackIntegration[] }>(SLACK_INTEGRATIONS_QUERY)
      .then((data) => setIntegrations(data.slackIntegrations))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load Slack integrations'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchIntegrations();
    // Fetch org users for the mapping dropdown
    gql<{ orgUsers: OrgUser[] }>(SLACK_ORG_USERS_QUERY)
      .then((data) => setOrgUsers(data.orgUsers))
      .catch(() => { /* non-critical */ });
  }, []);

  // Auto-select single integration for user mappings
  useEffect(() => {
    if (integrations.length === 1 && !selectedIntegrationId) {
      fetchMappings(integrations[0].id);
    }
  }, [integrations, selectedIntegrationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMappings = (integrationId: string) => {
    setSelectedIntegrationId(integrationId);
    gql<{ slackUserMappings: SlackUserMapping[] }>(
      SLACK_USER_MAPPINGS_QUERY,
      { integrationId }
    )
      .then((data) => setMappings(data.slackUserMappings))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load mappings'));
  };

  const handleUnmapUser = async (mappingId: string) => {
    try {
      await gql<{ unmapSlackUser: boolean }>(
        UNMAP_SLACK_USER_MUTATION,
        { mappingId }
      );
      setMappings((prev) => prev.filter((m) => m.id !== mappingId));
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to remove mapping');
    }
  };

  const handleToggleConnectEvent = (event: string) => {
    const current = connectForm.values.events;
    connectForm.setValue('events',
      current.includes(event) ? current.filter((e) => e !== event) : [...current, event]
    );
  };

  const handleToggleEnabled = async (integration: SlackIntegration) => {
    try {
      await gql<{ updateSlackIntegration: SlackIntegration }>(
        UPDATE_SLACK_INTEGRATION_MUTATION,
        { id: integration.id, enabled: !integration.enabled }
      );
      setIntegrations((prev) =>
        prev.map((i) => (i.id === integration.id ? { ...i, enabled: !i.enabled } : i))
      );
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to update integration');
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const data = await gql<{ testSlackIntegration: boolean }>(
        TEST_SLACK_INTEGRATION_MUTATION,
        { id }
      );
      setTestResult({ id, success: data.testSlackIntegration });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Test failed');
      setTestResult({ id, success: false });
    } finally {
      setTestingId(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!await confirm({ title: 'Disconnect Slack', message: 'Disconnect this Slack integration?', confirmLabel: 'Disconnect', variant: 'danger' })) return;
    try {
      await gql<{ disconnectSlack: boolean }>(
        DISCONNECT_SLACK_MUTATION,
        { id }
      );
      setIntegrations((prev) => prev.filter((i) => i.id !== id));
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to disconnect');
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading Slack integrations...</p>;
  }

  return (
    <div className="space-y-4">
      {err && <p className="text-sm text-red-600">{err}</p>}

      {/* Integration list */}
      {integrations.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {integrations.map((int) => (
            <li key={int.id} className="py-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 font-medium">
                    {int.teamName} <span className="text-slate-400 font-normal">#{int.channelName}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleEnabled(int)}
                    className="cursor-pointer"
                  >
                    <Badge variant={int.enabled ? 'success' : 'neutral'}>
                      {int.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </button>
                  <button
                    onClick={() => handleTest(int.id)}
                    disabled={testingId === int.id}
                    className="text-xs text-slate-600 hover:text-slate-800 disabled:opacity-50"
                  >
                    {testingId === int.id ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    onClick={() => handleDisconnect(int.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {int.events.map((ev) => (
                  <Badge key={ev} size="sm" variant="neutral">
                    {ev}
                  </Badge>
                ))}
              </div>
              {testResult?.id === int.id && (
                <p className={`text-xs ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.success ? 'Test message sent successfully!' : 'Test failed — check your webhook URL.'}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No Slack integrations configured.</p>
      )}

      {/* User Mappings */}
      {integrations.length > 0 && (
        <div className="border border-slate-200 rounded p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">User Mappings</h3>
          <p className="text-xs text-slate-500">
            Link Slack users to TaskToad accounts for personalized slash command results.
          </p>

          {integrations.length > 1 && (
            <div>
              <label htmlFor="mapping-integration" className="block text-xs font-medium text-slate-600 mb-1">
                Integration
              </label>
              <select
                id="mapping-integration"
                value={selectedIntegrationId ?? ''}
                onChange={(e) => e.target.value && fetchMappings(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
              >
                <option value="">Select integration...</option>
                {integrations.map((int) => (
                  <option key={int.id} value={int.id}>
                    {int.teamName} — #{int.channelName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedIntegrationId && (
            <>
              {mappings.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      <th className="pb-1 font-medium">Slack User ID</th>
                      <th className="pb-1 font-medium">TaskToad User</th>
                      <th className="pb-1 font-medium sr-only">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {mappings.map((m) => (
                      <tr key={m.id}>
                        <td className="py-1.5 text-slate-700 font-mono text-xs">{m.slackUserId}</td>
                        <td className="py-1.5 text-slate-700">{m.user?.displayName ?? m.user?.email ?? m.userId}</td>
                        <td className="py-1.5 text-right">
                          <button
                            onClick={() => handleUnmapUser(m.id)}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {mappingForm.error && <p className="text-sm text-red-600">{mappingForm.error}</p>}
              <form onSubmit={mappingForm.handleSubmit} className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="map-slack-user-id" className="block text-xs font-medium text-slate-600 mb-1">Slack User ID</label>
                  <input
                    id="map-slack-user-id"
                    type="text"
                    placeholder="U01234567"
                    value={mappingForm.values.slackUserId}
                    onChange={(e) => mappingForm.setValue('slackUserId', e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                    required
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="map-target-user" className="block text-xs font-medium text-slate-600 mb-1">TaskToad User</label>
                  <select
                    id="map-target-user"
                    value={mappingForm.values.userId}
                    onChange={(e) => mappingForm.setValue('userId', e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                    required
                  >
                    <option value="">Select user...</option>
                    {orgUsers.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.displayName ? `${u.displayName} (${u.email})` : u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={mappingForm.loading || !mappingForm.values.slackUserId.trim() || !mappingForm.values.userId}
                  className="px-3 py-1.5 bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  {mappingForm.loading ? 'Adding...' : 'Add Mapping'}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Connect form */}
      {showForm ? (
        <form onSubmit={connectForm.handleSubmit} className="space-y-3 border border-slate-200 rounded p-4">
          {connectForm.error && <p className="text-sm text-red-600">{connectForm.error}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL</label>
            <input
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={connectForm.values.webhookUrl}
              onChange={(e) => connectForm.setValue('webhookUrl', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono"
              required
            />
            <p className="text-xs text-slate-400 mt-1">
              Create an incoming webhook in your Slack workspace settings.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Team ID</label>
              <input
                type="text"
                placeholder="T01234567"
                value={connectForm.values.teamId}
                onChange={(e) => connectForm.setValue('teamId', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Team Name</label>
              <input
                type="text"
                placeholder="My Workspace"
                value={connectForm.values.teamName}
                onChange={(e) => connectForm.setValue('teamName', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Channel ID</label>
              <input
                type="text"
                placeholder="C01234567"
                value={connectForm.values.channelId}
                onChange={(e) => connectForm.setValue('channelId', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Channel Name</label>
              <input
                type="text"
                placeholder="general"
                value={connectForm.values.channelName}
                onChange={(e) => connectForm.setValue('channelName', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Events</label>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={connectForm.values.events.includes(event)}
                    onChange={() => handleToggleConnectEvent(event)}
                    className="rounded border-slate-300"
                  />
                  {event}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={connectForm.loading || !connectForm.values.webhookUrl.trim() || connectForm.values.events.length === 0}
              className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50 text-sm"
            >
              {connectForm.loading ? 'Connecting...' : 'Connect Slack'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green-hover text-sm"
        >
          Connect Slack
        </button>
      )}
      <ConfirmDialogPortal />
    </div>
  );
}
