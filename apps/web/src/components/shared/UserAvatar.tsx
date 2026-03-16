interface UserAvatarProps {
  email: string;
  avatarUrl?: string | null;
  displayName?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = { sm: 24, md: 32, lg: 40 } as const;
const SIZE_CLASSES = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
} as const;

const COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-rose-500',
];

function hashEmail(email: string): number {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash << 5) - hash + email.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitial(displayName: string | null | undefined, email: string): string {
  if (displayName?.trim()) return displayName.trim()[0].toUpperCase();
  return email[0].toUpperCase();
}

export default function UserAvatar({ email, avatarUrl, displayName, size = 'md', className = '' }: UserAvatarProps) {
  const sizeClass = SIZE_CLASSES[size];
  const sizePx = SIZE_MAP[size];
  const tooltip = displayName?.trim() || email;
  const colorClass = COLORS[hashEmail(email) % COLORS.length];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={tooltip}
        title={tooltip}
        width={sizePx}
        height={sizePx}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <span
      title={tooltip}
      className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}
    >
      {getInitial(displayName, email)}
    </span>
  );
}
