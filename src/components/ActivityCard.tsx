import { activityConfig, type Activity } from '@/lib/activities';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';

interface ActivityCardProps {
  activity: Activity;
  onDelete: (id: string) => void;
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['bg-primary', 'bg-accent', 'bg-orange-500', 'bg-rose-500', 'bg-teal-500', 'bg-violet-500'];
  return colors[Math.abs(hash) % colors.length];
}

export function ActivityCard({ activity, onDelete }: ActivityCardProps) {
  const config = activityConfig[activity.type];
  const initial = activity.member_name.charAt(0).toUpperCase();
  const avatarBg = getAvatarColor(activity.member_name);
  const wasEdited = activity.updated_at !== activity.created_at;

  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarBg} text-primary-foreground`}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-foreground">{activity.member_name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${config.color}`}>
              {config.emoji} {config.label}
            </span>
          </div>
          <p className="mt-1 text-foreground/80 text-sm leading-relaxed">{activity.description}</p>
          {activity.activity_date && (
            <div className="mt-1.5 text-xs font-semibold text-primary">
              📅 {format(new Date(activity.activity_date + 'T00:00:00'), 'EEEE, MMM d, yyyy')}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</span>
            {wasEdited && (
              <span className="italic">
                · edited {format(new Date(activity.updated_at), 'MMM d, h:mm a')}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(activity.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
