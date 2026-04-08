import { cn } from '@/lib/utils';

interface MemberAvatarProps {
  emoji: string;
  color: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-lg',
  lg: 'w-12 h-12 text-xl',
  xl: 'w-16 h-16 text-2xl',
};

export function MemberAvatar({ emoji, color, avatarUrl, size = 'md', className }: MemberAvatarProps) {
  if (avatarUrl) {
    return (
      <div className={cn('rounded-xl overflow-hidden shrink-0 shadow-sm', sizeClasses[size], className)}>
        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl flex items-center justify-center shrink-0 shadow-sm', color, sizeClasses[size], className)}>
      {emoji}
    </div>
  );
}
