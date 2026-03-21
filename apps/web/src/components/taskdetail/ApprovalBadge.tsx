import { useState, useEffect, useCallback } from 'react';
import { gql } from '../../api/client';
import { statusLabel } from '../../utils/taskHelpers';

interface ApprovalUser {
  userId: string;
  email: string;
  displayName: string | null;
}

interface Approval {
  approvalId: string;
  fromStatus: string;
  toStatus: string;
  status: string;
  createdAt: string;
  requestedBy: ApprovalUser;
}

const TASK_APPROVALS_QUERY = `
  query TaskApprovals($taskId: ID!) {
    taskApprovals(taskId: $taskId) {
      approvalId
      fromStatus
      toStatus
      status
      createdAt
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

interface ApprovalBadgeProps {
  taskId: string;
  canManage: boolean;
}

export default function ApprovalBadge({ taskId, canManage }: ApprovalBadgeProps) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadApprovals = useCallback(async () => {
    try {
      const data = await gql<{ taskApprovals: Approval[] }>(TASK_APPROVALS_QUERY, { taskId });
      setApprovals(data.taskApprovals.filter(a => a.status === 'pending'));
    } catch {
      // ignore
    }
  }, [taskId]);

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

  if (approvals.length === 0) return null;

  return (
    <div className="mb-4">
      {approvals.map(a => (
        <div
          key={a.approvalId}
          className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-2"
        >
          <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
            Pending approval: {statusLabel(a.fromStatus)} → {statusLabel(a.toStatus)}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            Requested by {a.requestedBy.displayName || a.requestedBy.email.split('@')[0]}
          </p>

          {canManage && (
            rejectingId === a.approvalId ? (
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
            )
          )}
        </div>
      ))}
    </div>
  );
}
