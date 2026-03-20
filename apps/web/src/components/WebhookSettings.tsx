import { useState, useEffect } from 'react';
import { gql } from '../api/client';
import {
  WEBHOOK_DELIVERIES_QUERY,
  REPLAY_WEBHOOK_DELIVERY_MUTATION,
  WEBHOOK_ENDPOINTS_QUERY,
  CREATE_WEBHOOK_ENDPOINT_MUTATION,
  UPDATE_WEBHOOK_ENDPOINT_MUTATION,
  TEST_WEBHOOK_ENDPOINT_MUTATION,
  DELETE_WEBHOOK_ENDPOINT_MUTATION,
} from '../api/queries';
import { useFormState } from '../hooks/useFormState';
import { useConfirmDialog } from './shared/ConfirmDialog';
import Badge from './shared/Badge';

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string;
  enabled: boolean;
  description: string | null;
  lastError: string | null;
  lastFiredAt: string | null;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  status: string;
  statusCode: number | null;
  attemptCount: number;
  nextRetryAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

const SUPPORTED_EVENTS = [
  'task.created',
  'task.updated',
  'task.deleted',
  'sprint.created',
  'sprint.closed',
  'comment.created',
];

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  success: 'success',
  retrying: 'warning',
  failed: 'danger',
  pending: 'neutral',
};

export default function WebhookSettings() {
  const { confirm, ConfirmDialogPortal } = useConfirmDialog();
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Create webhook form
  const [showForm, setShowForm] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const fetchEndpoints = () => {
    setLoading(true);
    gql<{ webhookEndpoints: WebhookEndpoint[] }>(WEBHOOK_ENDPOINTS_QUERY)
      .then((data) => setEndpoints(data.webhookEndpoints))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load webhooks'))
      .finally(() => setLoading(false));
  };

  const createForm = useFormState(
    { url: '', events: ['task.created', 'task.updated'] as string[], description: '' },
    async (values) => {
      if (!values.url.trim() || values.events.length === 0) return;
      const data = await gql<{ createWebhookEndpoint: WebhookEndpoint & { secret: string } }>(
        CREATE_WEBHOOK_ENDPOINT_MUTATION,
        { url: values.url.trim(), events: values.events, description: values.description.trim() || null }
      );
      setCreatedSecret(null);
      setEndpoints((prev) => [data.createWebhookEndpoint, ...prev]);
      setShowForm(false);
      fetchEndpoints();
    },
    { resetOnSuccess: true }
  );

  // Testing state
  const [testingId, setTestingId] = useState<string | null>(null);

  // Delivery history state
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  useEffect(() => {
    fetchEndpoints();
  }, []);

  const fetchDeliveries = (endpointId: string) => {
    setDeliveriesLoading(true);
    gql<{ webhookDeliveries: WebhookDelivery[] }>(WEBHOOK_DELIVERIES_QUERY, { endpointId, limit: 20 })
      .then((data) => setDeliveries(data.webhookDeliveries))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load deliveries'))
      .finally(() => setDeliveriesLoading(false));
  };

  const handleToggleDeliveries = (endpointId: string) => {
    if (expandedEndpoint === endpointId) {
      setExpandedEndpoint(null);
      setDeliveries([]);
    } else {
      setExpandedEndpoint(endpointId);
      fetchDeliveries(endpointId);
    }
  };

  const handleReplay = async (deliveryId: string) => {
    setReplayingId(deliveryId);
    try {
      const data = await gql<{ replayWebhookDelivery: WebhookDelivery }>(REPLAY_WEBHOOK_DELIVERY_MUTATION, { deliveryId });
      setDeliveries((prev) =>
        prev.map((d) => (d.id === deliveryId ? data.replayWebhookDelivery : d))
      );
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Replay failed');
    } finally {
      setReplayingId(null);
    }
  };

  const handleToggleCreateEvent = (event: string) => {
    const current = createForm.values.events;
    createForm.setValue('events',
      current.includes(event) ? current.filter((e) => e !== event) : [...current, event]
    );
  };

  const handleToggleEnabled = async (endpoint: WebhookEndpoint) => {
    try {
      await gql<{ updateWebhookEndpoint: WebhookEndpoint }>(
        UPDATE_WEBHOOK_ENDPOINT_MUTATION,
        { id: endpoint.id, enabled: !endpoint.enabled }
      );
      setEndpoints((prev) =>
        prev.map((ep) => (ep.id === endpoint.id ? { ...ep, enabled: !ep.enabled } : ep))
      );
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to update webhook');
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const data = await gql<{ testWebhookEndpoint: boolean }>(
        TEST_WEBHOOK_ENDPOINT_MUTATION,
        { id }
      );
      if (data.testWebhookEndpoint) {
        setEndpoints((prev) =>
          prev.map((ep) =>
            ep.id === id ? { ...ep, lastError: null, lastFiredAt: new Date().toISOString() } : ep
          )
        );
      } else {
        fetchEndpoints();
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Test failed');
      fetchEndpoints();
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm({ title: 'Delete webhook', message: 'Delete this webhook endpoint?', confirmLabel: 'Delete', variant: 'danger' })) return;
    try {
      await gql<{ deleteWebhookEndpoint: boolean }>(
        DELETE_WEBHOOK_ENDPOINT_MUTATION,
        { id }
      );
      setEndpoints((prev) => prev.filter((ep) => ep.id !== id));
      if (expandedEndpoint === id) {
        setExpandedEndpoint(null);
        setDeliveries([]);
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to delete webhook');
    }
  };

  // Compute delivery summary stats for expanded endpoint
  const deliverySummary = expandedEndpoint
    ? {
        success: deliveries.filter((d) => d.status === 'success').length,
        failed: deliveries.filter((d) => d.status === 'failed').length,
        lastDelivery: deliveries[0]?.createdAt ?? null,
      }
    : null;

  if (loading) {
    return <p className="text-sm text-slate-500">Loading webhooks…</p>;
  }

  return (
    <div className="space-y-4">
      {err && <p className="text-sm text-red-600">{err}</p>}

      {createdSecret && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
          <p className="text-sm font-medium text-amber-800">
            Webhook secret (shown once — copy it now):
          </p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-white px-2 py-1 rounded border border-amber-200 font-mono flex-1 break-all">
              {createdSecret}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdSecret);
              }}
              className="px-2 py-1 text-xs bg-amber-100 hover:bg-amber-200 rounded text-amber-800"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setCreatedSecret(null)}
            className="text-xs text-amber-600 hover:text-amber-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Endpoint list */}
      {endpoints.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {endpoints.map((ep) => {
            const events = JSON.parse(ep.events) as string[];
            const isExpanded = expandedEndpoint === ep.id;
            return (
              <li key={ep.id} className="py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 font-mono truncate">{ep.url}</p>
                    {ep.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{ep.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleEnabled(ep)}
                      className={`text-xs px-2 py-0.5 rounded ${
                        ep.enabled
                          ? 'bg-green-50 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {ep.enabled ? 'Active' : 'Disabled'}
                    </button>
                    <button
                      onClick={() => handleToggleDeliveries(ep.id)}
                      className={`text-xs px-2 py-0.5 rounded ${
                        isExpanded
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      Deliveries
                    </button>
                    <button
                      onClick={() => handleTest(ep.id)}
                      disabled={testingId === ep.id}
                      className="text-xs text-slate-600 hover:text-slate-800 disabled:opacity-50"
                    >
                      {testingId === ep.id ? 'Testing…' : 'Test'}
                    </button>
                    <button
                      onClick={() => handleDelete(ep.id)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {events.map((ev) => (
                    <span
                      key={ev}
                      className="inline-block text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
                    >
                      {ev}
                    </span>
                  ))}
                </div>
                {ep.lastError && (
                  <p className="text-xs text-red-600">Last error: {ep.lastError}</p>
                )}
                {ep.lastFiredAt && (
                  <p className="text-xs text-slate-400">
                    Last fired: {new Date(ep.lastFiredAt).toLocaleString()}
                  </p>
                )}

                {/* Delivery history panel */}
                {isExpanded && (
                  <div className="mt-3 border border-slate-200 rounded p-3 space-y-3">
                    {deliverySummary && (
                      <div className="flex gap-4 text-xs text-slate-600">
                        <span className="text-green-700">
                          {deliverySummary.success} succeeded
                        </span>
                        <span className="text-red-700">
                          {deliverySummary.failed} failed
                        </span>
                        {deliverySummary.lastDelivery && (
                          <span>
                            Last: {new Date(deliverySummary.lastDelivery).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}

                    {deliveriesLoading ? (
                      <p className="text-xs text-slate-500">Loading deliveries…</p>
                    ) : deliveries.length === 0 ? (
                      <p className="text-xs text-slate-500">No deliveries yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {deliveries.map((d) => {
                          const variant = STATUS_VARIANT[d.status] ?? 'neutral';
                          return (
                            <li
                              key={d.id}
                              className="flex items-center gap-2 text-xs"
                            >
                              <Badge variant={variant} size="sm">
                                {d.status}
                              </Badge>
                              <span className="text-slate-700">{d.event}</span>
                              {d.statusCode && (
                                <span className="text-slate-400">{d.statusCode}</span>
                              )}
                              <span className="text-slate-400">
                                ×{d.attemptCount}
                              </span>
                              <span className="text-slate-400 flex-1 text-right">
                                {new Date(d.createdAt).toLocaleString()}
                              </span>
                              {d.status === 'failed' && (
                                <button
                                  onClick={() => handleReplay(d.id)}
                                  disabled={replayingId === d.id}
                                  className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                >
                                  {replayingId === d.id ? 'Replaying…' : 'Replay'}
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No webhook endpoints configured.</p>
      )}

      {/* Add form */}
      {showForm ? (
        <form onSubmit={createForm.handleSubmit} className="space-y-3 border border-slate-200 rounded p-4">
          {createForm.error && <p className="text-sm text-red-600">{createForm.error}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL</label>
            <input
              type="url"
              placeholder="https://example.com/webhook"
              value={createForm.values.url}
              onChange={(e) => createForm.setValue('url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Events</label>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={createForm.values.events.includes(event)}
                    onChange={() => handleToggleCreateEvent(event)}
                    className="rounded border-slate-300"
                  />
                  {event}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Slack notifications"
              value={createForm.values.description}
              onChange={(e) => createForm.setValue('description', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createForm.loading || !createForm.values.url.trim() || createForm.values.events.length === 0}
              className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50 text-sm"
            >
              {createForm.loading ? 'Creating…' : 'Create Webhook'}
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
          Add Webhook
        </button>
      )}
      <ConfirmDialogPortal />
    </div>
  );
}
