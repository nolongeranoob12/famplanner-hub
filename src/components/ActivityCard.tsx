import { useState, useEffect } from 'react';
import { activityConfig, memberAvatars, getMemberPhone, reactionEmojis, toggleReaction, type Activity, type Reaction } from '@/lib/activities';
import { Trash2, CalendarDays, Clock, Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ActivityCardProps {
  activity: Activity;
  onDelete: (id: string) => void;
  currentUser?: string;
  reactions?: Reaction[];
  onReactionChange?: () => void;
}

export function ActivityCard({ activity, onDelete, currentUser, reactions = [], onReactionChange }: ActivityCardProps) {
  const config = activityConfig[activity.type];
  const avatar = memberAvatars[activity.member_name] ?? { color: 'bg-primary', emoji: '👤' };
  const wasEdited = activity.updated_at !== activity.created_at;
  const isOwner = currentUser === activity.member_name;
  const [phone, setPhone] = useState('');
  const [imageExpanded, setImageExpanded] = useState(false);
  const [reacting, setReacting] = useState(false);

  useEffect(() => {
    getMemberPhone(activity.member_name).then(setPhone);
  }, [activity.member_name]);

  const handleReaction = async (emoji: string) => {
    if (!currentUser || reacting) return;
    setReacting(true);
    try {
      await toggleReaction(activity.id, currentUser, emoji);
      onReactionChange?.();
    } finally {
      setReacting(false);
    }
  };

  // Group reactions by emoji
  const reactionCounts: Record<string, { count: number; members: string[]; userReacted: boolean }> = {};
  for (const r of reactions) {
    if (!reactionCounts[r.emoji]) reactionCounts[r.emoji] = { count: 0, members: [], userReacted: false };
    reactionCounts[r.emoji].count++;
    reactionCounts[r.emoji].members.push(r.member_name);
    if (r.member_name === currentUser) reactionCounts[r.emoji].userReacted = true;
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-card rounded-xl border border-border hover:border-border/80 hover:shadow-md transition-shadow duration-200 overflow-hidden group"
    >
      {/* Photo */}
      {activity.image_url && (
        <button
          type="button"
          onClick={() => setImageExpanded(!imageExpanded)}
          className="w-full overflow-hidden"
        >
          <img
            src={activity.image_url}
            alt="Activity photo"
            className={`w-full object-cover transition-all duration-300 ${imageExpanded ? 'max-h-96' : 'max-h-48'}`}
            loading="lazy"
          />
        </button>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${avatar.color} shadow-sm`}>
            {avatar.emoji}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-semibold text-foreground text-sm">{activity.member_name}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${config.bgClass} ${config.textClass}`}>
                {config.emoji} {config.label}
              </span>
              {phone && (
                <span className="flex items-center gap-1 ml-auto">
                  <a
                    href={`tel:${phone}`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-secondary text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title={`Call ${activity.member_name}`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-secondary text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
                    title={`WhatsApp ${activity.member_name}`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-foreground/80 text-sm leading-relaxed mt-1">{activity.description}</p>

            {/* Date & timestamp row */}
            <div className="mt-2.5 flex items-center gap-3 flex-wrap">
              {activity.activity_date && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {format(new Date(activity.activity_date + 'T00:00:00'), 'EEE, MMM d')}
                  {activity.time_start && (
                    <span className="ml-0.5 text-muted-foreground">
                      {activity.time_start}{activity.time_end ? ` – ${activity.time_end}` : ''}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</span>
                {wasEdited && <span className="italic">· edited</span>}
              </div>
            </div>

            {/* Reactions */}
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              {reactionEmojis.map((emoji) => {
                const info = reactionCounts[emoji];
                const hasCount = info && info.count > 0;
                const userReacted = info?.userReacted ?? false;
                return (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    disabled={reacting}
                    title={info?.members.join(', ')}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all duration-150',
                      'border hover:scale-105 active:scale-95',
                      userReacted
                        ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                        : 'border-border bg-secondary/50 text-muted-foreground hover:bg-secondary'
                    )}
                  >
                    <span className="text-sm">{emoji}</span>
                    {hasCount && <span>{info.count}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Delete button */}
          {isOwner && (
            <Button
              variant="ghost"
              size="icon"
              className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive rounded-lg h-8 w-8"
              onClick={() => onDelete(activity.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
