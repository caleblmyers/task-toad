import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export default function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <div className={`prose prose-sm prose-slate dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => <a {...props} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" />,
          code: ({ children, className: codeClassName, ...props }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return <code className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1 py-0.5 rounded text-xs" {...props}>{children}</code>;
            }
            return <code className={`block bg-slate-900 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto ${codeClassName ?? ''}`} {...props}>{children}</code>;
          },
          pre: ({ children }) => <>{children}</>,
          ul: ({ children }) => <ul className="list-disc pl-4 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="text-sm text-slate-700 dark:text-slate-300">{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-bold text-slate-800 dark:text-slate-200 mt-3 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-3 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-2 mb-1">{children}</h3>,
          p: ({ children }) => <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-1.5">{children}</p>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-slate-300 dark:border-slate-600 pl-3 text-slate-500 dark:text-slate-400 italic">{children}</blockquote>,
          table: ({ children }) => <table className="border-collapse text-xs w-full">{children}</table>,
          th: ({ children }) => <th className="border border-slate-200 dark:border-slate-600 px-2 py-1 bg-slate-50 dark:bg-slate-800 text-left font-medium">{children}</th>,
          td: ({ children }) => <td className="border border-slate-200 dark:border-slate-600 px-2 py-1">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
