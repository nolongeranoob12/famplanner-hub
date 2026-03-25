import { activityConfig, type Activity } from '@/lib/activities';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface ActivityCardProps {
  activity: Activity;
  onDelete: (id: string) => void;
}

const memberColors = [
  'bg-primary text-primary-foreground',
  'bg-accent text-accent-foreground',
  'bg-destructive text-destructive-foreground',
  'hsl(270 60% 55%)',
  'hsl(200 70% 50%)',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['bg-primary', 'bg-accent', 'bg-orange-500', 'bg-rose-500', 'bg-teal-500', 'bg-violet-500'];
  return colors[Math.abs(hash) % colors.length];
}

export function ActivityCard({ activity, onDelete }: ActivityCardProps) {
  const config = activityConfig[activity.type];
  const initial = activity.memberName.charAt(0).toUpperCase();
  const avatarBg = getAvatarColor(activity.memberName);

  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarBg} text-primary-foreground`}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-foreground">{activity.memberName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${config.color}`}>
              {config.emoji} {config.label}
            </span>
          </div>
          <p className="mt-1 text-foreground/80 text-sm leading-relaxed">{activity.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
          </p>
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
