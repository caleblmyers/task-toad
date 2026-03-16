import React, { Suspense } from 'react';

const LazyMarkdownContent = React.lazy(() => import('./MarkdownContent'));

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <Suspense fallback={<span className="text-gray-400 text-sm">Loading...</span>}>
      <LazyMarkdownContent content={content} className={className} />
    </Suspense>
  );
}
