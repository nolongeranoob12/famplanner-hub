import { useState, useEffect, useCallback } from 'react';
import { isSameDay } from 'date-fns';
import { AddActivityForm } from '@/components/AddActivityForm';
import { ActivityCard } from '@/components/ActivityCard';
import { ActivityCalendar } from '@/components/ActivityCalendar';
import { ActivityFeedSkeleton } from '@/components/ActivityCardSkeleton';
import { NamePicker } from '@/components/NamePicker';
import { PhoneSettings } from '@/components/PhoneSettings';
import { MemberAvatar } from '@/components/MemberAvatar';
import { getActivities, addActivity, deleteActivity, getReactions, getAllMemberProfiles, getDisplayAvatar, getMemberLastActive, isRecentlyActive, type Activity, type ActivityType, type Reaction, type MemberProfile } from '@/lib/activities';
import { useActivityNotifications } from '@/hooks/useActivityNotifications';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { NotificationBell } from '@/components/NotificationBell';
import { LogOut, Users } from 'lucide-react';
import { PullToRefresh } from '@/components/PullToRefresh';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function Index() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(() => localStorage.getItem('chau_family_user'));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});
  const [lastActive, setLastActive] = useState<Record<string, string>>({});

  useActivityNotifications(currentUser);
  const pushSubscription = usePushSubscription(currentUser);

  const fetchProfiles = useCallback(async () => {
    try {
      const p = await getAllMemberProfiles();
      setProfiles(p);
    } catch { /* non-critical */ }
  }, []);

  const fetchReactions = useCallback(async (acts: Activity[]) => {
    try {
      const ids = acts.map(a => a.id);
      const r = await getReactions(ids);
      setReactions(r);
    } catch { /* non-critical */ }
  }, []);

  const fetchActivities = useCallback(async () => {
    try {
      const data = await getActivities();
      setActivities(data);
      fetchReactions(data);
    } catch {
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, [fetchReactions]);

  useEffect(() => {
    if (currentUser) {
      fetchActivities();
      fetchProfiles();
      getMemberLastActive().then(setLastActive).catch(() => {});
    }
  }, [currentUser, fetchActivities, fetchProfiles]);

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

  const avatar = getDisplayAvatar(currentUser, profiles);
  const userIsActive = isRecentlyActive(lastActive[currentUser]);

  const filteredActivities = selectedDate
    ? activities.filter((a) => a.activity_date && isSameDay(new Date(a.activity_date + 'T00:00:00'), selectedDate))
    : activities;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        className="sticky top-0 z-10 bg-card/80 backdrop-blur-xl border-b border-border"
        initial={{ y: -60 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <Users className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground leading-tight tracking-tight">Chau Family</h1>
            <p className="text-[11px] text-muted-foreground">Family activity board</p>
          </div>
          <div className="flex items-center gap-1.5">
            <MemberAvatar emoji={avatar.emoji} color={avatar.color} avatarUrl={avatar.avatarUrl} size="sm" isActive={userIsActive} />
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
      </motion.header>

      {/* Main */}
      <motion.main
        className="max-w-xl mx-auto px-4 py-5 space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <AddActivityForm onAdd={handleAdd} currentUser={currentUser} profiles={profiles} />

        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
          >
            <ActivityCalendar activities={activities} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          </motion.div>
        )}

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
          <ActivityFeedSkeleton count={4} />
        ) : filteredActivities.length === 0 ? (
          <motion.div
            className="text-center py-20"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">📅</span>
            </div>
            <p className="text-foreground font-semibold text-base">
              {selectedDate ? 'No activities on this day' : 'No activities yet'}
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-[240px] mx-auto">
              {selectedDate ? 'Try selecting a different date or post a new activity.' : 'Post what you\'re up to so the family knows!'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredActivities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onDelete={handleDelete}
                  currentUser={currentUser}
                  reactions={reactions[activity.id] ?? []}
                  onReactionChange={() => fetchReactions(activities)}
                  profiles={profiles}
                  isActive={isRecentlyActive(lastActive[activity.member_name])}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.main>
    </div>
  );
}
