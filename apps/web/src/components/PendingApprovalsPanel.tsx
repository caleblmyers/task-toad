import { useState, useEffect, useCallback } from 'react';
import { gql } from '../api/client';
import { statusLabel } from '../utils/taskHelpers';

interface ApprovalUser {
  userId: string;
  email: string;
  displayName: string | null;
}

interface Approval {
  approvalId: string;
  taskId: string;
  fromStatus: string;
  toStatus: string;
  status: string;
  comment: string | null;
  createdAt: string;
  task: { taskId: string; title: string };
  requestedBy: ApprovalUser;
  approver: ApprovalUser | null;
}

const PENDING_APPROVALS_QUERY = `
  query PendingApprovals($projectId: ID!) {
    pendingApprovals(projectId: $projectId) {
      approvalId
      taskId
      fromStatus
      toStatus
      status
      comment
      createdAt
      task { taskId title }
      requestedBy { userId email displayName }
    }
  }
`;

const APPROVE_MUTATION = `
  mutation ApproveTransition($approvalId: ID!, $comment: String) {
    approveTransition(approvalId: $approvalId, comment: $comment) {
      approvalId
      status
    }
  }
`;

const REJECT_MUTATION = `
  mutation RejectTransition($approvalId: ID!, $comment: String!) {
    rejectTransition(approvalId: $approvalId, comment: $comment) {
      approvalId
      status
    }
  }
`;

interface PendingApprovalsPanelProps {
  projectId: string;
  onClose: () => void;
}

export default function PendingApprovalsPanel({ projectId, onClose }: PendingApprovalsPanelProps) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadApprovals = useCallback(async () => {
    try {
      const data = await gql<{ pendingApprovals: Approval[] }>(PENDING_APPROVALS_QUERY, { projectId });
      setApprovals(data.pendingApprovals);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  const handleApprove = async (approvalId: string) => {
    setActionLoading(approvalId);
    try {
      await gql(APPROVE_MUTATION, { approvalId });
      setApprovals(prev => prev.filter(a => a.approvalId !== approvalId));
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (approvalId: string) => {
    if (!rejectComment.trim()) return;
    setActionLoading(approvalId);
    try {
      await gql(REJECT_MUTATION, { approvalId, comment: rejectComment.trim() });
      setApprovals(prev => prev.filter(a => a.approvalId !== approvalId));
      setRejectingId(null);
      setRejectComment('');
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const displayName = (u: ApprovalUser) => u.displayName || u.email.split('@')[0];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg w-96 max-h-[500px] overflow-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pending Approvals</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {loading ? (
        <div className="p-4 text-sm text-slate-500">Loading…</div>
      ) : approvals.length === 0 ? (
        <div className="p-4 text-sm text-slate-500">No pending approvals</div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {approvals.map(a => (
            <li key={a.approvalId} className="px-4 py-3">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                {a.task.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {statusLabel(a.fromStatus)} → {statusLabel(a.toStatus)}
                <span className="ml-1">· by {displayName(a.requestedBy)}</span>
              </p>

              {rejectingId === a.approvalId ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    placeholder="Reason for rejection…"
                    className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800 dark:text-slate-200"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleReject(a.approvalId)}
                      disabled={!rejectComment.trim() || actionLoading === a.approvalId}
                      className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirm Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRejectingId(null); setRejectComment(''); }}
                      className="text-xs px-2 py-1 text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => handleApprove(a.approvalId)}
                    disabled={actionLoading === a.approvalId}
                    className="text-xs px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectingId(a.approvalId)}
                    disabled={actionLoading === a.approvalId}
                    className="text-xs px-2.5 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
