import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { activityConfig, memberAvatars, type ActivityType } from '@/lib/activities';
import { Plus, CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddActivityFormProps {
  onAdd: (data: { member_name: string; type: ActivityType; description: string; activity_date?: string; time_start?: string; time_end?: string }) => void;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser.trim() || !description.trim()) return;
    onAdd({
      member_name: currentUser.trim(),
      type,
      description: description.trim(),
      activity_date: activityDate ? `${activityDate.getFullYear()}-${String(activityDate.getMonth() + 1).padStart(2, '0')}-${String(activityDate.getDate()).padStart(2, '0')}` : undefined,
      time_start: timeStart || undefined,
      time_end: timeEnd || undefined,
    });
    setDescription('');
    setType('dinner');
    setActivityDate(undefined);
    setTimeStart('');
    setTimeEnd('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 rounded-xl bg-card border border-border p-3.5 text-left hover:border-primary/40 hover:shadow-sm transition-all duration-200 active:scale-[0.99]"
      >
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Plus className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-foreground text-sm block">Post an Activity</span>
          <span className="text-xs text-muted-foreground">Let the family know what you're up to</span>
        </div>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">New Activity</h3>
        <Button type="button" variant="ghost" size="icon" className="rounded-lg h-7 w-7 text-muted-foreground" onClick={() => setOpen(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 space-y-3.5">
        {/* Current user */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Posting as</label>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
            <span className="text-sm">{memberAvatars[currentUser]?.emoji ?? '👤'}</span>
            <span className="font-medium text-foreground text-sm">{currentUser}</span>
          </div>
        </div>

        {/* Activity type */}
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

        {/* Date & Time */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Date & Time</label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn('w-full rounded-lg h-10 justify-start text-left font-normal border-border', !activityDate && 'text-muted-foreground')}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {activityDate ? format(activityDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={activityDate}
                onSelect={(date) => { setActivityDate(date); setCalendarOpen(false); }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2 mt-1.5">
            <Input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="flex-1 rounded-lg h-10 border-border text-sm" />
            <span className="text-muted-foreground text-xs">to</span>
            <Input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="flex-1 rounded-lg h-10 border-border text-sm" />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Details</label>
          <Textarea
            placeholder="What's the plan?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-lg min-h-[72px] border-border resize-none text-sm"
            maxLength={300}
            required
          />
          <div className="text-right text-[11px] text-muted-foreground">{description.length}/300</div>
        </div>

        <Button type="submit" disabled={!currentUser || !description.trim()} className="w-full rounded-lg h-10 font-semibold text-sm">
          Post Activity
        </Button>
      </div>
    </form>
  );
}
