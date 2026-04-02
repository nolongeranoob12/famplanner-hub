import { useState } from 'react';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type Activity, activityConfig } from '@/lib/activities';
import { cn } from '@/lib/utils';

interface ActivityCalendarProps {
  activities: Activity[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
}

export function ActivityCalendar({ activities, selectedDate, onSelectDate }: ActivityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getActivitiesForDay = (day: Date) =>
    activities.filter((a) => a.activity_date && isSameDay(new Date(a.activity_date + 'T00:00:00'), day));

  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <Button variant="ghost" size="icon" className="rounded-lg h-7 w-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <h3 className="font-semibold text-foreground text-sm">{format(currentMonth, 'MMMM yyyy')}</h3>
        <Button variant="ghost" size="icon" className="rounded-lg h-7 w-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 px-3 pt-2.5">
        {weekdays.map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 px-3 pb-2.5 gap-y-0.5">
        {days.map((day) => {
          const dayActivities = getActivitiesForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(isSelected ? null : day)}
              className={cn(
                'relative flex flex-col items-center justify-center py-1.5 rounded-lg text-sm transition-colors',
                !isCurrentMonth && 'opacity-25',
                isSelected && 'bg-primary text-primary-foreground',
                !isSelected && isToday && 'bg-primary/8 text-primary font-semibold',
                !isSelected && !isToday && 'hover:bg-muted text-foreground'
              )}
            >
              <span className="text-xs font-medium">{format(day, 'd')}</span>
              {dayActivities.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayActivities.slice(0, 3).map((a, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-1 h-1 rounded-full',
                        isSelected ? 'bg-primary-foreground/70' : activityConfig[a.type]?.textClass?.replace('text-', 'bg-') || 'bg-muted-foreground'
                      )}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date */}
      {selectedDate && (
        <div className="px-4 py-2 border-t border-border bg-secondary/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-primary">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
            <button onClick={() => onSelectDate(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Show all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}