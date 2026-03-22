import { useRef, useEffect } from 'react';
import type { OrgUser } from '../types';

interface MentionAutocompleteProps {
  query: string;
  users: OrgUser[];
  onSelect: (email: string) => void;
  anchorRect: { top: number; left: number } | null;
}

export default function MentionAutocomplete({ query, users, onSelect, anchorRect }: MentionAutocompleteProps) {
  const ref = useRef<HTMLDivElement>(null);
  const q = query.toLowerCase();
  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(q) ||
    (u.displayName && u.displayName.toLowerCase().includes(q))
  ).slice(0, 6);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSelect('');
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onSelect]);

  if (!anchorRect || filtered.length === 0) return null;

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-56 max-h-48 overflow-y-auto"
      style={{ top: anchorRect.top, left: anchorRect.left }}
    >
      {filtered.map((user) => (
        <button
          key={user.userId}
          onClick={() => onSelect(user.email)}
          className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
        >
          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-medium flex-shrink-0">
            {(user.displayName ?? user.email).charAt(0).toUpperCase()}
          </span>
          <span className="truncate">{user.displayName ? `${user.displayName} (${user.email})` : user.email}</span>
        </button>
      ))}
    </div>
  );
}
