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
import { Loader2, Home, LogOut, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Index() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(() => localStorage.getItem('chau_family_user'));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Enable browser notifications for activity changes
  useActivityNotifications(currentUser);
  // Subscribe to push notifications for background alerts
  const { subscribed, subscribe: subscribePush } = usePushSubscription(currentUser);

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
      // Clear app badge when user opens the app
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage('clear-badge');
      }
      if ('clearAppBadge' in navigator) {
        (navigator as any).clearAppBadge();
      }
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
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/60">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center shadow-md">
            <Home className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold text-foreground leading-tight tracking-tight">Chau Family</h1>
            <p className="text-xs text-muted-foreground mt-0.5">What's everyone up to today?</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${avatar.color} shadow-sm`}>
              {avatar.emoji}
            </div>
            <PhoneSettings currentUser={currentUser} />
            <span className="text-sm font-bold text-foreground hidden sm:inline">{currentUser}</span>
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-xl h-8 w-8 ${subscribed ? 'text-primary' : 'text-muted-foreground'}`}
              onClick={async () => {
                const result = await subscribePush();
                if (result.ok) {
                  toast.success('🔔 Notifications enabled!');
                  return;
                }

                if (!('reason' in result)) {
                  toast('This device/browser does not support push notifications yet.');
                  return;
                }

                if (result.reason === 'preview') {
                  toast('Notifications only work on the published app, not the preview.');
                  return;
                }

                if (result.reason === 'ios-home-screen') {
                  toast('On iPhone, add the published app to Home Screen and open it from the app icon first.');
                  return;
                }

                if (result.reason === 'blocked') {
                  toast('Notifications are blocked for this app. Please enable them in your phone settings.');
                  return;
                }

                if (result.reason === 'save-failed') {
                  toast('Permission was allowed, but your device could not be saved. Please try again.');
                  return;
                }

                toast('This device/browser does not support push notifications yet.');
              }}
            >
              <Bell className={`w-4 h-4 ${subscribed ? 'fill-primary' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 text-muted-foreground" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-xl mx-auto px-5 py-6 space-y-4">
        <AddActivityForm onAdd={handleAdd} currentUser={currentUser} />

        {/* Calendar */}
        {!loading && <ActivityCalendar activities={activities} selectedDate={selectedDate} onSelectDate={setSelectedDate} />}

        {/* Activities count */}
        {!loading && filteredActivities.length > 0 && (
          <div className="flex items-center gap-2 pt-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {filteredActivities.length} {filteredActivities.length === 1 ? 'Activity' : 'Activities'}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading activities…</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">📅</span>
            </div>
            <p className="text-foreground font-bold text-lg">
              {selectedDate ? 'No activities on this day' : 'No activities yet'}
            </p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-[250px] mx-auto">
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
