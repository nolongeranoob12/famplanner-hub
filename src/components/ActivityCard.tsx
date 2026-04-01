import { useState, useEffect } from 'react';
import { activityConfig, memberAvatars, getMemberPhone, type Activity } from '@/lib/activities';
import { Trash2, CalendarDays, Clock, Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';

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
    <div className="bg-card rounded-2xl border border-border shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
      {/* Activity type accent bar */}
      <div className={`h-1 ${config.bgClass}`} />

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${avatar.color} shadow-md`}>
            {avatar.emoji}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-foreground text-base">{activity.member_name}</span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${config.bgClass} ${config.textClass}`}>
                {config.emoji} {config.label}
              </span>
              {/* Call & WhatsApp buttons */}
              {phone && (
                <span className="flex items-center gap-1 ml-auto">
                  <a
                    href={`tel:${phone}`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-600 hover:bg-sky-200 transition-colors"
                    title={`Call ${activity.member_name}`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors"
                    title={`WhatsApp ${activity.member_name}`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-foreground/75 text-sm leading-relaxed mt-1.5">{activity.description}</p>

            {/* Date & timestamp row */}
            <div className="mt-3 flex items-center gap-4 flex-wrap">
              {activity.activity_date && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {format(new Date(activity.activity_date + 'T00:00:00'), 'EEE, MMM d, yyyy')}
                  {activity.time_start && (
                    <span className="ml-1">
                      {activity.time_start}{activity.time_end ? ` – ${activity.time_end}` : ''}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</span>
                {wasEdited && (
                  <span className="italic">· edited</span>
                )}
              </div>
            </div>
          </div>

          {/* Delete button - only visible to owner */}
          {isOwner && (
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive rounded-xl h-9 w-9"
              onClick={() => onDelete(activity.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
