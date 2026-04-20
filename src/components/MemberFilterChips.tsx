import { getDisplayAvatar, type Profile } from '@/lib/profiles';
import { MemberAvatar } from '@/components/MemberAvatar';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface MemberFilterChipsProps {
  profiles: Record<string, Profile>;
  selectedUserId: string | null;
  onSelect: (userId: string | null) => void;
  lastActive?: Record<string, string>;
  isRecentlyActive?: (ts: string | undefined) => boolean;
}

export function MemberFilterChips({ profiles, selectedUserId, onSelect, lastActive = {}, isRecentlyActive }: MemberFilterChipsProps) {
  const handleTap = (uid: string) => {
    haptic('light');
    onSelect(selectedUserId === uid ? null : uid);
  };

  const members = Object.values(profiles).filter((p) => p.family_id);
  if (members.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {members.map((p) => {
        const avatar = getDisplayAvatar(p.id, profiles);
        const active = selectedUserId === p.id;
        const online = isRecentlyActive?.(lastActive[p.id]);

        return (
          <motion.button
            key={p.id}
            onClick={() => handleTap(p.id)}
            whileTap={{ scale: 0.92 }}
            className={cn(
              'flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all min-w-[56px] shrink-0',
              active ? 'bg-primary/10 ring-2 ring-primary/40' : 'hover:bg-muted/60'
            )}
          >
            <MemberAvatar
              emoji={avatar.emoji}
              color={avatar.color}
              avatarUrl={avatar.avatarUrl}
              size="sm"
              isActive={online}
            />
            <span className={cn(
              'text-[10px] font-medium leading-tight truncate max-w-[60px]',
              active ? 'text-primary' : 'text-muted-foreground'
            )}>
              {avatar.displayName}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
