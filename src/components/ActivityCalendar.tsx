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
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h3 className="font-bold text-foreground text-sm">{format(currentMonth, 'MMMM yyyy')}</h3>
        <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 px-3 pt-3">
        {weekdays.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 px-3 pb-3 gap-y-1">
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
                'relative flex flex-col items-center justify-center py-1.5 rounded-xl text-sm transition-all',
                !isCurrentMonth && 'opacity-30',
                isSelected && 'bg-primary text-primary-foreground',
                !isSelected && isToday && 'bg-primary/10 text-primary font-bold',
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
                        'w-1.5 h-1.5 rounded-full',
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

      {/* Selected date label */}
      {selectedDate && (
        <div className="px-5 py-2 border-t border-border bg-primary/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </span>
            <button onClick={() => onSelectDate(null)} className="text-xs text-muted-foreground hover:text-foreground">
              Show all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
