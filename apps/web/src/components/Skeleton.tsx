import Card from './shared/Card';

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`}
    />
  );
}

export function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg">
      <Skeleton className="w-4 h-4 rounded-sm flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

export function TaskListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <TaskRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function KanbanColumnSkeleton() {
  return (
    <div className="flex flex-col w-72 min-w-[18rem] flex-shrink-0 bg-slate-100 dark:bg-slate-800 rounded-xl border-t-4 border-t-slate-300">
      <div className="flex items-center justify-between px-3 py-2.5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-8 rounded-full" />
      </div>
      <div className="px-2 pb-2 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} padding="none" className="p-3 shadow-sm space-y-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-5 w-16 rounded" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function KanbanBoardSkeleton() {
  return (
    <div className="flex gap-4 h-full px-6 py-4">
      <KanbanColumnSkeleton />
      <KanbanColumnSkeleton />
      <KanbanColumnSkeleton />
    </div>
  );
}

export function TaskDetailSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-7 w-3/4" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default Skeleton;
