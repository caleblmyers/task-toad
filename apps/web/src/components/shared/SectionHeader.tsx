import type { ReactNode } from 'react';

interface SectionHeaderProps {
  children: ReactNode;
  action?: ReactNode;
}

export default function SectionHeader({ children, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-2">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {children}
      </p>
      {action}
    </div>
  );
}
