import { cn } from '@/lib/utils';

interface MemberAvatarProps {
  emoji: string;
  color: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isActive?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-lg',
  lg: 'w-12 h-12 text-xl',
  xl: 'w-16 h-16 text-2xl',
};

const dotSizeClasses = {
  sm: 'w-2.5 h-2.5 border-[1.5px]',
  md: 'w-3 h-3 border-2',
  lg: 'w-3.5 h-3.5 border-2',
  xl: 'w-4 h-4 border-2',
};

function StatusDot({ size }: { size: 'sm' | 'md' | 'lg' | 'xl' }) {
  return (
    <span
      className={cn(
        'absolute -bottom-0.5 -right-0.5 rounded-full bg-emerald-500 border-card',
        'ring-1 ring-emerald-400/30',
        dotSizeClasses[size],
      )}
    >
      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
    </span>
  );
}

export function MemberAvatar({ emoji, color, avatarUrl, size = 'md', className, isActive }: MemberAvatarProps) {
  const wrapper = 'relative';

  if (avatarUrl) {
    return (
      <div className={cn(wrapper, className)}>
        <div className={cn('rounded-xl overflow-hidden shrink-0 shadow-sm', sizeClasses[size])}>
          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
        </div>
        {isActive && <StatusDot size={size} />}
      </div>
    );
  }

  return (
    <div className={cn(wrapper, className)}>
      <div className={cn('rounded-xl flex items-center justify-center shrink-0 shadow-sm', color, sizeClasses[size])}>
        {emoji}
      </div>
      {isActive && <StatusDot size={size} />}
    </div>
  );
}
