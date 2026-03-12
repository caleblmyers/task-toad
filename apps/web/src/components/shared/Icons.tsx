// Inline SVG icon components — replaces Unicode emoji throughout the app
// All icons are 16x16 by default, accepting className for overrides

interface IconProps {
  className?: string;
}

export function IconSearch({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" strokeLinecap="round" />
    </svg>
  );
}

export function IconClose({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlus({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
    </svg>
  );
}

export function IconChevronDown({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChevronRight({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconList({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4h10M3 8h10M3 12h10" strokeLinecap="round" />
    </svg>
  );
}

export function IconBoard({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="4" height="12" rx="1" />
      <rect x="8" y="2" width="4" height="8" rx="1" />
    </svg>
  );
}

export function IconFilter({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 3h12M4 8h8M6 13h4" strokeLinecap="round" />
    </svg>
  );
}

export function IconArrowLeft({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSparkle({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5z" />
    </svg>
  );
}

export function IconRefresh({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M13 8a5 5 0 11-1.5-3.5M13 3v2h-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSummary({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}

export function IconDashboard({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="3" rx="1" />
      <rect x="2" y="9" width="5" height="3" rx="1" />
      <rect x="9" y="7" width="5" height="5" rx="1" />
    </svg>
  );
}

export function IconTable({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="12" height="12" rx="1" />
      <path d="M2 6h12M2 10h12M6 2v12" />
    </svg>
  );
}

export function IconCalendar({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="12" height="11" rx="1" />
      <path d="M2 7h12M5 1v4M11 1v4" strokeLinecap="round" />
    </svg>
  );
}

export function IconUser({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="5" r="3" />
      <path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" />
    </svg>
  );
}

export function IconFlag({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 2v12M3 2l9 3.5L3 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClock({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4v4l3 2" strokeLinecap="round" />
    </svg>
  );
}

export function IconKeyboard({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="3" width="14" height="10" rx="1.5" />
      <path d="M4 6h1M7 6h2M11 6h1M4 9h8" strokeLinecap="round" />
    </svg>
  );
}

export function IconGroup({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4h12M2 8h8M2 12h10" strokeLinecap="round" />
      <circle cx="14" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}
