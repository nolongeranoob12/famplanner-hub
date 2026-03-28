import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { activityConfig, memberAvatars, type ActivityType } from '@/lib/activities';
import { Plus, CalendarIcon, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddActivityFormProps {
  onAdd: (data: {member_name: string;type: ActivityType;description: string;activity_date?: string;}) => void;
  currentUser: string;
}

export function AddActivityForm({ onAdd, currentUser }: AddActivityFormProps) {
  const memberName = currentUser;
  const [type, setType] = useState<ActivityType>('dinner');
  const [description, setDescription] = useState('');
  const [activityDate, setActivityDate] = useState<Date>();
  const [activityTime, setActivityTime] = useState('');
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || !description.trim()) return;
    onAdd({
      member_name: memberName.trim(),
      type,
      description: description.trim(),
      activity_date: activityDate ? `${activityDate.getFullYear()}-${String(activityDate.getMonth() + 1).padStart(2, '0')}-${String(activityDate.getDate()).padStart(2, '0')}` : undefined,
      activity_time: activityTime || undefined
    });
    setDescription('');
    setType('dinner');
    setActivityDate(undefined);
    setActivityTime('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full group relative overflow-hidden rounded-2xl bg-primary p-4 text-primary-foreground shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]">
        
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
            <Plus className="w-5 h-5" />
          </div>
          <div className="text-left">
            <span className="font-bold block text-lg">Post an Activity</span>
            <span className="text-xs opacity-80">Let the family know what you're up to</span>
          </div>
          <Sparkles className="w-5 h-5 ml-auto opacity-60" />
        </div>
      </button>);

  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
      {/* Form header */}
      <div className="bg-primary/5 border-b border-border px-5 py-3.5 flex items-center justify-between">
        <h3 className="font-bold text-base text-foreground">What's happening? 🎉</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(false)}>
          
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-5 space-y-4">
        {/* Current user display */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Posting as</label>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary bg-primary/10">
            <span className="text-base">{memberAvatars[currentUser]?.emoji ?? '👤'}</span>
            <span className="font-bold text-foreground text-sm">{currentUser}</span>
          </div>
        </div>

        {/* Activity type */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity</label>
          <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
            <SelectTrigger className="rounded-xl h-11 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(activityConfig).map(([key, cfg]) =>
              <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    <span>{cfg.emoji}</span>
                    <span>{cfg.label}</span>
                  </span>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Date picker */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full rounded-xl h-11 justify-start text-left font-normal border-border",
                  !activityDate && "text-muted-foreground"
                )}>
                
                <CalendarIcon className="mr-2 h-4 w-4" />
                {activityDate ? format(activityDate, "PPP") : "Pick a date (optional)"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={activityDate}
                onSelect={(date) => {
                  setActivityDate(date);
                  setCalendarOpen(false);
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")} />
              
            </PopoverContent>
          </Popover>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</label>
          <Textarea
            placeholder="What's the plan? Where are you going?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-xl min-h-[80px] border-border resize-none"
            maxLength={300}
            required />
          
          <div className="text-right text-xs text-muted-foreground">{description.length}/300</div>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={!memberName || !description.trim()}
          className="w-full rounded-xl h-12 font-bold text-base shadow-md hover:shadow-lg transition-all">
          
          Post Activity
        </Button>
      </div>
    </form>);

}