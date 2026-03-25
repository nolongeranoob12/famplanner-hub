import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { activityConfig, type ActivityType } from '@/lib/activities';
import { Plus, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddActivityFormProps {
  onAdd: (data: { member_name: string; type: ActivityType; description: string; activity_date?: string }) => void;
}

export function AddActivityForm({ onAdd }: AddActivityFormProps) {
  const [memberName, setMemberName] = useState('');
  const [type, setType] = useState<ActivityType>('dinner');
  const [description, setDescription] = useState('');
  const [activityDate, setActivityDate] = useState<Date>();
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || !description.trim()) return;
    onAdd({
      member_name: memberName.trim(),
      type,
      description: description.trim(),
      activity_date: activityDate ? activityDate.toISOString() : undefined,
    });
    setMemberName('');
    setDescription('');
    setType('dinner');
    setActivityDate(undefined);
    setOpen(false);
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="w-full gap-2 h-12 text-base font-semibold rounded-xl">
        <Plus className="w-5 h-5" />
        Post an Activity
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-5 space-y-4 border border-border shadow-sm">
      <h3 className="font-bold text-lg">What's happening? 🎉</h3>
      <Input
        placeholder="Who? (e.g. Mom, Dad, Sarah...)"
        value={memberName}
        onChange={e => setMemberName(e.target.value)}
        className="rounded-xl h-11"
        maxLength={50}
        required
      />
      <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
        <SelectTrigger className="rounded-xl h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(activityConfig).map(([key, cfg]) => (
            <SelectItem key={key} value={key}>
              {cfg.emoji} {cfg.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full rounded-xl h-11 justify-start text-left font-normal",
              !activityDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {activityDate ? format(activityDate, "PPP") : "Pick a date (optional)"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={activityDate}
            onSelect={setActivityDate}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      <Textarea
        placeholder="What's the plan? Where are you going?"
        value={description}
        onChange={e => setDescription(e.target.value)}
        className="rounded-xl min-h-[80px]"
        maxLength={300}
        required
      />
      <div className="flex gap-3">
        <Button type="submit" className="flex-1 rounded-xl h-11 font-semibold">Post</Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl h-11">Cancel</Button>
      </div>
    </form>
  );
}
