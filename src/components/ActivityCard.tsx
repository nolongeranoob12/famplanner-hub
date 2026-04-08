import { useState, useEffect } from 'react';
import { activityConfig, memberAvatars, getMemberPhone, type Activity } from '@/lib/activities';
import { Trash2, CalendarDays, Clock, Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';
import { motion } from 'framer-motion';

interface ActivityCardProps {
  activity: Activity;
  onDelete: (id: string) => void;
  currentUser?: string;
}

export function ActivityCard({ activity, onDelete, currentUser }: ActivityCardProps) {
  const config = activityConfig[activity.type];
  const avatar = memberAvatars[activity.member_name] ?? { color: 'bg-primary', emoji: '👤' };
  const wasEdited = activity.updated_at !== activity.created_at;
  const isOwner = currentUser === activity.member_name;
  const [phone, setPhone] = useState('');

  useEffect(() => {
    getMemberPhone(activity.member_name).then(setPhone);
  }, [activity.member_name]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-card rounded-xl border border-border hover:border-border/80 hover:shadow-md transition-shadow duration-200 overflow-hidden group"
    >
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
