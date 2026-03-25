import InsightPanel from './InsightPanel';
import type { TaskInsight } from './InsightPanel';

export interface InsightsTabProps {
  projectId: string;
  taskId: string;
  fetchedInsights: TaskInsight[];
  onApplyInsight?: (insight: TaskInsight) => void;
}

export default function InsightsTab({
  projectId, taskId, fetchedInsights, onApplyInsight,
}: InsightsTabProps) {
  return (
    <section className="space-y-4">
      <InsightPanel
        projectId={projectId}
        taskId={taskId}
        initialInsights={fetchedInsights}
        onApplyInsight={onApplyInsight}
      />
    </section>
  );
}
