import { useState, useRef, useCallback, memo } from 'react';
import type { Comment, OrgUser } from '../types';
import MentionAutocomplete from './MentionAutocomplete';
import MarkdownRenderer from './shared/MarkdownRenderer';

const INITIAL_COMMENT_LIMIT = 30;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface CommentSectionProps {
  comments: Comment[];
  currentUserId: string;
  isAdmin: boolean;
  orgUsers: OrgUser[];
  onCreateComment: (content: string, parentCommentId?: string) => Promise<void>;
  onUpdateComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
}

const CommentItem = memo(function CommentItem({
  comment,
  currentUserId,
  isAdmin,
  isReply,
  onReply,
  onUpdate,
  onDelete,
}: {
  comment: Comment;
  currentUserId: string;
  isAdmin: boolean;
  isReply?: boolean;
  onReply: (commentId: string) => void;
  onUpdate: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const isOwner = comment.userId === currentUserId;
  const canDelete = isOwner || isAdmin;

  const handleSave = async () => {
    if (!editContent.trim()) return;
    await onUpdate(comment.commentId, editContent);
    setEditing(false);
  };

  return (
    <div className={`${isReply ? 'ml-8 border-l-2 border-slate-100 dark:border-slate-700 pl-3' : ''}`}>
      <div className="flex items-start gap-2 py-2">
        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-medium flex-shrink-0">
          {comment.userEmail.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{comment.userEmail}</span>
            <span className="text-xs text-slate-500">{timeAgo(comment.createdAt)}</span>
            {comment.createdAt !== comment.updatedAt && (
              <span className="text-xs text-slate-500">(edited)</span>
            )}
          </div>
          {editing ? (
            <div className="mt-1">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-green resize-none dark:bg-slate-700 dark:text-slate-200"
                rows={2}
                autoFocus
              />
              <div className="flex gap-1 mt-1">
                <button onClick={handleSave} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-0.5">Save</button>
                <button onClick={() => { setEditing(false); setEditContent(comment.content); }} className="text-xs text-slate-500 hover:text-slate-600 px-2 py-0.5">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-0.5">
                <MarkdownRenderer content={comment.content} />
              </div>
              <div className="flex gap-2 mt-1">
                {!isReply && (
                  <button onClick={() => onReply(comment.commentId)} className="text-xs text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">Reply</button>
                )}
                {isOwner && (
                  <button onClick={() => setEditing(true)} className="text-xs text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">Edit</button>
                )}
                {canDelete && (
                  <button onClick={() => onDelete(comment.commentId)} className="text-xs text-slate-500 hover:text-red-600">Delete</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default function CommentSection({
  comments,
  currentUserId,
  isAdmin,
  orgUsers,
  onCreateComment,
  onUpdateComment,
  onDeleteComment,
}: CommentSectionProps) {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState<{ top: number; left: number } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const newCommentRef = useRef<HTMLTextAreaElement>(null);

  const visibleComments = showAll || comments.length <= INITIAL_COMMENT_LIMIT
    ? comments
    : comments.slice(0, INITIAL_COMMENT_LIMIT);

  const handleReply = useCallback((id: string) => { setReplyingTo(id); setReplyContent(''); }, []);
  const handleUpdate = useCallback((commentId: string, content: string) => onUpdateComment(commentId, content), [onUpdateComment]);
  const handleDelete = useCallback((commentId: string) => onDeleteComment(commentId), [onDeleteComment]);
  const handleNoReply = useCallback(() => {}, []);

  const handleCommentInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewComment(val);

    // Detect @ for mention autocomplete
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const atMatch = textBefore.match(/@([^\s]*)$/);

    if (atMatch) {
      setMentionQuery(atMatch[1]);
      // Position the autocomplete
      const rect = e.target.getBoundingClientRect();
      setMentionAnchor({
        top: rect.top - 10,  // Above the textarea
        left: rect.left + 20,
      });
    } else {
      setMentionQuery(null);
      setMentionAnchor(null);
    }
  };

  const handleMentionSelect = (email: string) => {
    if (!email) {
      setMentionQuery(null);
      setMentionAnchor(null);
      return;
    }
    const textarea = newCommentRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBefore = newComment.slice(0, cursorPos);
    const textAfter = newComment.slice(cursorPos);
    const atIdx = textBefore.lastIndexOf('@');

    const newText = textBefore.slice(0, atIdx) + '@' + email + ' ' + textAfter;
    setNewComment(newText);
    setMentionQuery(null);
    setMentionAnchor(null);

    // Refocus textarea
    setTimeout(() => {
      textarea.focus();
      const newPos = atIdx + email.length + 2;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    await onCreateComment(newComment);
    setNewComment('');
    setSubmitting(false);
  };

  const handleReplySubmit = async () => {
    if (!replyContent.trim() || !replyingTo || submitting) return;
    setSubmitting(true);
    await onCreateComment(replyContent, replyingTo);
    setReplyContent('');
    setReplyingTo(null);
    setSubmitting(false);
  };

  return (
    <div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Comments</p>

      {/* New comment input */}
      <div className="flex gap-2 mb-3">
        <textarea
          ref={newCommentRef}
          value={newComment}
          onChange={handleCommentInput}
          placeholder="Add a comment... (use @ to mention)"
          className="flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-green resize-none dark:bg-slate-700 dark:text-slate-200"
          rows={2}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
        />
        {mentionQuery !== null && (
          <MentionAutocomplete
            query={mentionQuery}
            users={orgUsers}
            onSelect={handleMentionSelect}
            anchorRect={mentionAnchor}
          />
        )}
        <button
          onClick={handleSubmit}
          disabled={!newComment.trim() || submitting}
          className="self-end px-3 py-1.5 text-sm bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50"
        >
          Post
        </button>
      </div>
      <p className="text-[10px] text-slate-500 -mt-2 mb-2">Supports markdown</p>

      {/* Comment list */}
      <div className="space-y-1">
        {visibleComments.map((comment) => (
          <div key={comment.commentId}>
            <CommentItem
              comment={comment}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onReply={handleReply}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
            {/* Replies */}
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.commentId}
                comment={reply}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                isReply
                onReply={handleNoReply}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
            {/* Reply form */}
            {replyingTo === comment.commentId && (
              <div className="ml-8 pl-3 border-l-2 border-slate-100 dark:border-slate-700 py-1">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply…"
                  className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-green resize-none dark:bg-slate-700 dark:text-slate-200"
                  rows={2}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReplySubmit(); }}
                />
                <div className="flex gap-1 mt-1">
                  <button onClick={handleReplySubmit} disabled={!replyContent.trim() || submitting} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-0.5 disabled:opacity-50">Reply</button>
                  <button onClick={() => setReplyingTo(null)} className="text-xs text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-0.5">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!showAll && comments.length > INITIAL_COMMENT_LIMIT && (
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 py-2"
          >
            Show {comments.length - INITIAL_COMMENT_LIMIT} more comments
          </button>
        )}
        {comments.length === 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-1">No comments yet.</p>
        )}
      </div>
    </div>
  );
}
