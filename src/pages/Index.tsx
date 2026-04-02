import { useState, useEffect, useCallback } from 'react';
import { isSameDay } from 'date-fns';
import { AddActivityForm } from '@/components/AddActivityForm';
import { ActivityCard } from '@/components/ActivityCard';
import { ActivityCalendar } from '@/components/ActivityCalendar';
import { NamePicker } from '@/components/NamePicker';
import { PhoneSettings } from '@/components/PhoneSettings';
import { getActivities, addActivity, deleteActivity, type Activity, type ActivityType, memberAvatars } from '@/lib/activities';
import { useActivityNotifications } from '@/hooks/useActivityNotifications';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { NotificationBell } from '@/components/NotificationBell';
import { Loader2, LogOut, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Index() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(() => localStorage.getItem('chau_family_user'));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useActivityNotifications(currentUser);
  const pushSubscription = usePushSubscription(currentUser);

  const fetchActivities = useCallback(async () => {
    try {
      const data = await getActivities();
      setActivities(data);
    } catch {
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchActivities();
    }
  }, [currentUser, fetchActivities]);

  const handleSelectUser = (name: string) => {
    localStorage.setItem('chau_family_user', name);
    setCurrentUser(name);
  };

  const handleLogout = () => {
    localStorage.removeItem('chau_family_user');
    setCurrentUser(null);
  };

  const handleAdd = useCallback(async (data: { member_name: string; type: ActivityType; description: string; activity_date?: string; time_start?: string; time_end?: string }) => {
    try {
      const newActivity = await addActivity(data);
      setActivities((prev) => [newActivity, ...prev]);
      toast.success('Activity posted!');
    } catch {
      toast.error('Failed to post activity');
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteActivity(id);
      setActivities((prev) => prev.filter((a) => a.id !== id));
      toast.success('Activity removed');
    } catch {
      toast.error('Failed to delete activity');
    }
  }, []);

  if (!currentUser) {
    return <NamePicker onSelect={handleSelectUser} />;
  }

  const avatar = memberAvatars[currentUser] ?? { color: 'bg-primary', emoji: '👤' };

  const filteredActivities = selectedDate
    ? activities.filter((a) => a.activity_date && isSameDay(new Date(a.activity_date + 'T00:00:00'), selectedDate))
    : activities;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <Users className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground leading-tight tracking-tight">Chau Family</h1>
            <p className="text-[11px] text-muted-foreground">Family activity board</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${avatar.color} shadow-sm`}>
              {avatar.emoji}
            </div>
            <span className="text-xs font-semibold text-foreground hidden sm:inline">{currentUser}</span>
            <PhoneSettings currentUser={currentUser} />
            <NotificationBell
              currentUser={currentUser}
              pushSubscribed={pushSubscription.subscribed}
              onEnablePush={pushSubscription.subscribe}
            />
            <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-xl mx-auto px-4 py-5 space-y-4">
        <AddActivityForm onAdd={handleAdd} currentUser={currentUser} />

        {!loading && <ActivityCalendar activities={activities} selectedDate={selectedDate} onSelectDate={setSelectedDate} />}

        {!loading && filteredActivities.length > 0 && (
          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
              {filteredActivities.length} {filteredActivities.length === 1 ? 'Activity' : 'Activities'}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">📅</span>
            </div>
            <p className="text-foreground font-semibold text-base">
              {selectedDate ? 'No activities on this day' : 'No activities yet'}
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-[240px] mx-auto">
              {selectedDate ? 'Try selecting a different date or post a new activity.' : 'Post what you\'re up to so the family knows!'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActivities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} onDelete={handleDelete} currentUser={currentUser} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
