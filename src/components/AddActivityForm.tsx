import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { activityConfig, uploadActivityPhoto, type ActivityType } from '@/lib/activities';
import { getDisplayAvatar, type Profile } from '@/lib/profiles';
import { MemberAvatar } from '@/components/MemberAvatar';
import { Plus, CalendarIcon, X, ImagePlus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface AddActivityFormProps {
  onAdd: (data: { type: ActivityType; description: string; activity_date?: string; time_start?: string; time_end?: string; image_url?: string; member_name: string }) => void;
  currentUserId: string;
  profiles: Record<string, Profile>;
}

export function AddActivityForm({ onAdd, currentUserId, profiles }: AddActivityFormProps) {
  const [type, setType] = useState<ActivityType>('dinner');
  const [description, setDescription] = useState('');
  const [activityDate, setActivityDate] = useState<Date>();
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const me = getDisplayAvatar(currentUserId, profiles);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    let image_url: string | undefined;
    if (imageFile) {
      setUploading(true);
      try {
        image_url = await uploadActivityPhoto(imageFile);
      } catch {
        toast.error('Failed to upload photo');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onAdd({
      type,
      description: description.trim(),
      activity_date: activityDate ? `${activityDate.getFullYear()}-${String(activityDate.getMonth() + 1).padStart(2, '0')}-${String(activityDate.getDate()).padStart(2, '0')}` : undefined,
      time_start: timeStart || undefined,
      time_end: timeEnd || undefined,
      image_url,
      member_name: me.displayName,
    });
    setDescription('');
    setType('dinner');
    setActivityDate(undefined);
    setTimeStart('');
    setTimeEnd('');
    removeImage();
    setOpen(false);
  };

  return (
    <AnimatePresence mode="wait">
      {!open ? (
        <motion.button
          key="trigger"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 rounded-xl bg-card border border-border p-3.5 text-left hover:border-primary/40 hover:shadow-sm transition-all duration-200 active:scale-[0.99]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Plus className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-foreground text-sm block">Post an Activity</span>
            <span className="text-xs text-muted-foreground">Let the family know what you're up to</span>
          </div>
        </motion.button>
      ) : (
        <motion.form
          key="form"
          onSubmit={handleSubmit}
          className="bg-card rounded-xl border border-border overflow-hidden"
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-foreground">New Activity</h3>
            <Button type="button" variant="ghost" size="icon" className="rounded-lg h-7 w-7 text-muted-foreground" onClick={() => setOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-4 space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Posting as</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
                <MemberAvatar emoji={me.emoji} color={me.color} avatarUrl={me.avatarUrl} size="sm" />
                <span className="font-medium text-foreground text-sm">{me.displayName}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Type</label>
              <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
                <SelectTrigger className="rounded-lg h-10 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(activityConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <span>{cfg.emoji}</span>
                        <span>{cfg.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Date & Time</label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full rounded-lg h-10 justify-start text-left font-normal border-border', !activityDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {activityDate ? format(activityDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={activityDate} onSelect={(date) => { setActivityDate(date); setCalendarOpen(false); }} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-2 mt-1.5">
                <Input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="flex-1 rounded-lg h-10 border-border text-sm" />
                <span className="text-muted-foreground text-xs">to</span>
                <Input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="flex-1 rounded-lg h-10 border-border text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Photo</label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              {imagePreview ? (
                <div className="relative rounded-lg overflow-hidden">
                  <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                  <button type="button" onClick={removeImage} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2 justify-center py-3 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors text-sm">
                  <ImagePlus className="w-4 h-4" />
                  Add a photo
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Details</label>
              <Textarea placeholder="What's the plan?" value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-lg min-h-[72px] border-border resize-none text-sm" maxLength={300} required />
              <div className="text-right text-[11px] text-muted-foreground">{description.length}/300</div>
            </div>

            <Button type="submit" disabled={!description.trim() || uploading} className="w-full rounded-lg h-10 font-semibold text-sm">
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading…
                </>
              ) : (
                'Post Activity'
              )}
            </Button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
