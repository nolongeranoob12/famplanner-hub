import { familyMembers, getDisplayAvatar, type MemberProfile } from '@/lib/activities';
import { MemberAvatar } from '@/components/MemberAvatar';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface MemberFilterChipsProps {
  profiles: Record<string, MemberProfile>;
  selectedMember: string | null;
  onSelect: (member: string | null) => void;
  lastActive?: Record<string, string>;
  isRecentlyActive?: (ts: string | undefined) => boolean;
}

export function MemberFilterChips({ profiles, selectedMember, onSelect, lastActive = {}, isRecentlyActive }: MemberFilterChipsProps) {
  const handleTap = (name: string) => {
    haptic('light');
    onSelect(selectedMember === name ? null : name);
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {familyMembers.map((name) => {
        const avatar = getDisplayAvatar(name, profiles);
        const active = selectedMember === name;
        const online = isRecentlyActive?.(lastActive[name]);

        return (
          <motion.button
            key={name}
            onClick={() => handleTap(name)}
            whileTap={{ scale: 0.92 }}
            className={cn(
              'flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all min-w-[56px] shrink-0',
              active
                ? 'bg-primary/10 ring-2 ring-primary/40'
                : 'hover:bg-muted/60'
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
              'text-[10px] font-medium leading-tight truncate max-w-[52px]',
              active ? 'text-primary' : 'text-muted-foreground'
            )}>
              {name}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
