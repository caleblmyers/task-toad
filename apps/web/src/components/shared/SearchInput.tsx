import { forwardRef, useState, useRef, useEffect } from 'react';
import { IconSearch, IconClose } from './Icons';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  tqlError?: string | null;
}

const TQL_HELP_CONTENT = [
  { syntax: 'status:done', desc: 'Filter by field value' },
  { syntax: 'priority:high,critical', desc: 'Multiple values (OR)' },
  { syntax: '-status:done', desc: 'Negation (exclude)' },
  { syntax: 'storyPoints>5', desc: 'Comparison (>, <, >=, <=)' },
  { syntax: 'assignee:"John Smith"', desc: 'Quoted values' },
  { syntax: '(a OR b) AND c', desc: 'Grouping with AND/OR' },
  { syntax: 'fix login bug', desc: 'Free text search' },
];

const VALID_FIELDS = ['status', 'priority', 'assignee', 'label', 'taskType', 'dueDate', 'estimatedHours', 'storyPoints', 'sprintId'];

function TQLHelpPopover({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg p-3 text-xs"
    >
      <div className="font-semibold text-slate-700 dark:text-slate-200 mb-2">TQL Syntax Reference</div>
      <table className="w-full">
        <tbody>
          {TQL_HELP_CONTENT.map((item) => (
            <tr key={item.syntax}>
              <td className="py-0.5 pr-2 font-mono text-brand-green dark:text-green-400 whitespace-nowrap">{item.syntax}</td>
              <td className="py-0.5 text-slate-500 dark:text-slate-400">{item.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500">
        Fields: {VALID_FIELDS.join(', ')}
      </div>
    </div>
  );
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, placeholder = 'Search...', className = '', tqlError }, ref) => {
    const [showHelp, setShowHelp] = useState(false);
    const isTQL = /(?:^|\s)(?:NOT\s+)?-?[a-zA-Z]+[:><=]/.test(value);

    return (
      <div className={`relative ${className}`}>
        <IconSearch className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full pl-8 pr-14 py-1.5 text-sm border rounded-md bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-green focus:border-brand-green ${
            tqlError
              ? 'border-red-400 dark:border-red-500'
              : 'border-slate-200 dark:border-slate-600'
          } ${isTQL ? 'font-mono text-xs' : ''}`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label="Clear search"
            >
              <IconClose className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold text-xs w-4 h-4 flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-500"
            aria-label="TQL syntax help"
          >
            ?
          </button>
        </div>
        {showHelp && <TQLHelpPopover onClose={() => setShowHelp(false)} />}
        {tqlError && (
          <div className="absolute top-full left-0 mt-0.5 text-xs text-red-500 dark:text-red-400 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 rounded px-2 py-1 shadow-sm z-40 max-w-full truncate">
            {tqlError}
          </div>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export default SearchInput;
