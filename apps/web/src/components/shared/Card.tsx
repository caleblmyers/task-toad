import type { ReactNode } from 'react';

interface CardProps {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  children: ReactNode;
}

const PADDING_MAP: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export default function Card({ padding = 'md', className = '', children }: CardProps) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 ${PADDING_MAP[padding]} ${className}`}>
      {children}
    </div>
  );
}
