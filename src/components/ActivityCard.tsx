import { useState, useEffect, useRef } from 'react';
import { activityConfig, memberAvatars, getMemberPhone, uploadActivityPhoto, updateActivityPhoto, type Activity } from '@/lib/activities';
import { Trash2, CalendarDays, Clock, Phone, MessageCircle, Camera, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

interface ActivityCardProps {
  activity: Activity;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, imageUrl: string) => void;
  currentUser?: string;
}

export function ActivityCard({ activity, onDelete, onUpdate, currentUser }: ActivityCardProps) {
  const config = activityConfig[activity.type];
  const avatar = memberAvatars[activity.member_name] ?? { color: 'bg-primary', emoji: '👤' };
  const wasEdited = activity.updated_at !== activity.created_at;
  const isOwner = currentUser === activity.member_name;
  const [phone, setPhone] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMemberPhone(activity.member_name).then(setPhone);
  }, [activity.member_name]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadActivityPhoto(file);
      await updateActivityPhoto(activity.id, url);
      onUpdate?.(activity.id, url);
      toast.success('Photo added!');
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border hover:border-border/80 hover:shadow-md transition-all duration-200 overflow-hidden group">
      <div className="p-4">
        <div className="flex items-start gap-3.5">
          {/* Avatar */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${avatar.color}`}>
            {avatar.emoji}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
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
            <p className="text-foreground/80 text-sm leading-relaxed mt-1.5">{activity.description}</p>

            {/* Photo */}
            {activity.image_url && (
              <div className="mt-2 rounded-lg overflow-hidden border border-border">
                <img src={activity.image_url} alt="Activity photo" className="w-full max-h-64 object-cover" loading="lazy" />
              </div>
            )}

            {/* Add photo buttons for owner when no photo yet */}
            {isOwner && !activity.image_url && (
              <div className="mt-2">
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                {uploading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Uploading…
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary/10 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary/10 transition-colors"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      Add Photo
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Meta */}
            <div className="mt-2.5 flex items-center gap-3 flex-wrap">
              {activity.activity_date && (
                <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {format(new Date(activity.activity_date + 'T00:00:00'), 'EEE, MMM d')}
                  {activity.time_start && (
                    <span className="text-muted-foreground">
                      · {activity.time_start}{activity.time_end ? `–${activity.time_end}` : ''}
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

          {/* Delete */}
          {isOwner && (
            <Button
              variant="ghost"
              size="icon"
              className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive rounded-lg h-8 w-8"
              onClick={() => onDelete(activity.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
