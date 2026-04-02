import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { activityConfig, memberAvatars, type ActivityType } from '@/lib/activities';
import { Plus, CalendarIcon, X, Camera, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddActivityFormProps {
  onAdd: (data: { member_name: string; type: ActivityType; description: string; activity_date?: string; time_start?: string; time_end?: string; image?: File }) => void;
  currentUser: string;
}

export function AddActivityForm({ onAdd, currentUser }: AddActivityFormProps) {
  const [type, setType] = useState<ActivityType>('dinner');
  const [description, setDescription] = useState('');
  const [activityDate, setActivityDate] = useState<Date>();
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    onAdd({
      member_name: currentUser,
      type,
      description: description.trim(),
      activity_date: activityDate ? `${activityDate.getFullYear()}-${String(activityDate.getMonth() + 1).padStart(2, '0')}-${String(activityDate.getDate()).padStart(2, '0')}` : undefined,
      time_start: timeStart || undefined,
      time_end: timeEnd || undefined,
      image: imageFile || undefined,
    });
    setDescription('');
    setType('dinner');
    setActivityDate(undefined);
    setTimeStart('');
    setTimeEnd('');
    removeImage();
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl bg-primary p-3.5 text-primary-foreground shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-foreground/15 flex items-center justify-center">
            <Plus className="w-4.5 h-4.5" />
          </div>
          <div className="text-left">
            <span className="font-semibold block text-sm">Post an Activity</span>
            <span className="text-xs opacity-75">Let the family know what you're up to</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border">
        <h3 className="font-semibold text-sm text-foreground">New Activity</h3>
        <Button type="button" variant="ghost" size="icon" className="rounded-lg h-7 w-7 text-muted-foreground" onClick={() => setOpen(false)}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="p-4 space-y-3.5">
        {/* Posting as */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary">
          <span className="text-base">{memberAvatars[currentUser]?.emoji ?? '👤'}</span>
          <span className="font-medium text-secondary-foreground text-sm">{currentUser}</span>
        </div>

        {/* Activity type */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Activity type</label>
          <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
            <SelectTrigger className="rounded-lg h-10 border-border text-sm">
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

        {/* Date & Time */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Date & Time</label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn('w-full rounded-lg h-10 justify-start text-left font-normal text-sm', !activityDate && 'text-muted-foreground')}
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {activityDate ? format(activityDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={activityDate} onSelect={(d) => { setActivityDate(d); setCalendarOpen(false); }} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2">
            <Input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="flex-1 rounded-lg h-10 text-sm" />
            <span className="text-muted-foreground text-xs">to</span>
            <Input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="flex-1 rounded-lg h-10 text-sm" />
          </div>
        </div>

        {/* Photo */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Photo</label>
          {imagePreview ? (
            <div className="relative rounded-lg overflow-hidden">
              <img src={imagePreview} alt="Preview" className="w-full max-h-48 object-cover rounded-lg" />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-lg h-10 text-sm gap-2"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="w-4 h-4" />
                Camera
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-lg h-10 text-sm gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="w-4 h-4" />
                Gallery
              </Button>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Details</label>
          <Textarea
            placeholder="What's the plan?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-lg min-h-[72px] resize-none text-sm"
            maxLength={300}
            required
          />
          <div className="text-right text-[11px] text-muted-foreground">{description.length}/300</div>
        </div>

        <Button type="submit" disabled={!description.trim()} className="w-full rounded-lg h-10 font-semibold text-sm">
          Post Activity
        </Button>
      </div>
    </form>
  );
}
