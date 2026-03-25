import type { Comment, Activity, OrgUser } from '../../types';
import CommentSection from '../CommentSection';
import TaskAIHistory from './TaskAIHistory';
import ActivityFeed from '../ActivityFeed';

export interface ActivityTabProps {
  taskId: string;
  comments: Comment[];
  activities: Activity[];
  currentUserId: string;
  isAdmin: boolean;
  orgUsers: OrgUser[];
  onCreateComment: (content: string, parentCommentId?: string) => Promise<void>;
  onUpdateComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  commentsDisabled: boolean;
}

export default function ActivityTab({
  taskId, comments, activities, currentUserId, isAdmin, orgUsers,
  onCreateComment, onUpdateComment, onDeleteComment, commentsDisabled,
}: ActivityTabProps) {
  return (
    <section aria-labelledby="task-tab-activity-heading">
      <h3 id="task-tab-activity-heading" className="sr-only">Activity</h3>

      <div className="mb-4">
        <CommentSection
          comments={comments}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          orgUsers={orgUsers}
          onCreateComment={onCreateComment}
          onUpdateComment={onUpdateComment}
          onDeleteComment={onDeleteComment}
          disabled={commentsDisabled}
        />
      </div>

      <TaskAIHistory taskId={taskId} />

      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2">Activity</p>
        <ActivityFeed activities={activities} />
      </div>
    </section>
  );
}
