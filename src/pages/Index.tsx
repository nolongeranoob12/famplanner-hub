import { useState, useEffect, useCallback } from 'react';
import { isSameDay, format } from 'date-fns';
import { AddActivityForm } from '@/components/AddActivityForm';
import { ActivityCard } from '@/components/ActivityCard';
import { ActivityCalendar } from '@/components/ActivityCalendar';
import { ActivityFeedSkeleton } from '@/components/ActivityCardSkeleton';
import { MemberAvatar } from '@/components/MemberAvatar';
import { FamilySettings } from '@/components/FamilySettings';
import { AvatarEditor } from '@/components/AvatarEditor';
import { getActivities, addActivity, deleteActivity, getMemberLastActive, isRecentlyActive, type Activity, type ActivityType } from '@/lib/activities';
import { getReactions, type Reaction } from '@/lib/reactions';
import { getFamilyProfiles, getDisplayAvatar, type Profile } from '@/lib/profiles';
import { getMyFamily, type Family } from '@/lib/families';
import { useActivityNotifications } from '@/hooks/useActivityNotifications';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { useNativePush } from '@/hooks/useNativePush';
import { NotificationBell } from '@/components/NotificationBell';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Pencil } from 'lucide-react';
import { PullToRefresh } from '@/components/PullToRefresh';
import { MemberFilterChips } from '@/components/MemberFilterChips';
import { ShoppingList } from '@/components/ShoppingList';
import { haptic } from '@/lib/haptics';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function Index() {
  const { user, profile, refreshProfile } = useAuth();
  const currentUserId = user!.id;
  const displayName = profile?.display_name ?? '';

  const [activities, setActivities] = useState<Activity[]>([]);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [family, setFamily] = useState<Family | null>(null);
  const [lastActive, setLastActive] = useState<Record<string, string>>({});
  const [editingAvatar, setEditingAvatar] = useState(false);

  useActivityNotifications(currentUserId);
  const pushSubscription = usePushSubscription(currentUserId, displayName);
  useNativePush(currentUserId, displayName);

  const fetchProfiles = useCallback(async () => {
    try {
      const p = await getFamilyProfiles();
      setProfiles(p);
    } catch { /* non-critical */ }
  }, []);

  const fetchReactions = useCallback(async (acts: Activity[]) => {
    try {
      const ids = acts.map((a) => a.id);
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

  const handleRefresh = useCallback(async () => {
    haptic('medium');
    const data = await getActivities();
    setActivities(data);
    await Promise.all([
      fetchReactions(data),
      fetchProfiles(),
      getMemberLastActive().then(setLastActive).catch(() => {}),
    ]);
    toast.success('Refreshed!');
  }, [fetchReactions, fetchProfiles]);

  useEffect(() => {
    fetchActivities();
    fetchProfiles();
    getMyFamily().then(setFamily);
    getMemberLastActive().then(setLastActive).catch(() => {});
  }, [fetchActivities, fetchProfiles]);

  const handleAdd = useCallback(async (data: { type: ActivityType; description: string; activity_date?: string; time_start?: string; time_end?: string; image_url?: string; member_name: string }) => {
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

  const avatar = getDisplayAvatar(currentUserId, profiles);
  const userIsActive = isRecentlyActive(lastActive[currentUserId]);

  const filteredActivities = activities
    .filter((a) => {
      if (selectedDate && !(a.activity_date && isSameDay(new Date(a.activity_date + 'T00:00:00'), selectedDate))) return false;
      if (selectedUserId && a.user_id !== selectedUserId) return false;
      return true;
    })
    .sort((a, b) => {
      if (!!a.pinned_at !== !!b.pinned_at) return a.pinned_at ? -1 : 1;
      if (a.pinned_at && b.pinned_at) return new Date(b.pinned_at).getTime() - new Date(a.pinned_at).getTime();
      return 0;
    });

  return (
    <div className="min-h-screen bg-background">
      <motion.header
        className="sticky top-0 z-10 bg-card/80 backdrop-blur-xl border-b border-border safe-px"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
        initial={{ y: -60 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm shrink-0">
            <Users className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground leading-tight tracking-tight truncate">{family?.name ?? 'Family'}</h1>
            <p className="text-[11px] text-muted-foreground">Family activity board</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setEditingAvatar(true)} className="relative" title="Edit avatar">
              <MemberAvatar emoji={avatar.emoji} color={avatar.color} avatarUrl={avatar.avatarUrl} size="sm" isActive={userIsActive} />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Pencil className="w-2 h-2" />
              </span>
            </button>
            <ShoppingList currentUserId={currentUserId} profiles={profiles} />
            <NotificationBell
              currentUserId={currentUserId}
              pushSubscribed={pushSubscription.subscribed}
              onEnablePush={pushSubscription.subscribe}
              profiles={profiles}
            />
            <FamilySettings />
          </div>
        </div>
      </motion.header>

      <PullToRefresh onRefresh={handleRefresh}>
        <motion.main
          className="max-w-2xl mx-auto px-4 py-5 space-y-4 safe-px pb-safe-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <AddActivityForm onAdd={handleAdd} currentUserId={currentUserId} profiles={profiles} />

          <MemberFilterChips
            profiles={profiles}
            selectedUserId={selectedUserId}
            onSelect={setSelectedUserId}
            lastActive={lastActive}
            isRecentlyActive={isRecentlyActive}
          />

          {!loading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.35 }}>
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
            <motion.div className="text-center py-20" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
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
                {filteredActivities.map((activity, idx) => {
                  const actDate = activity.activity_date
                    ? new Date(activity.activity_date + 'T00:00:00')
                    : new Date(activity.created_at);
                  const monthKey = format(actDate, 'yyyy-MM');
                  const prevActivity = filteredActivities[idx - 1];
                  const prevDate = prevActivity
                    ? (prevActivity.activity_date
                        ? new Date(prevActivity.activity_date + 'T00:00:00')
                        : new Date(prevActivity.created_at))
                    : null;
                  const prevMonthKey = prevDate ? format(prevDate, 'yyyy-MM') : null;
                  const showMonthHeader = monthKey !== prevMonthKey;

                  return (
                    <div key={activity.id}>
                      {showMonthHeader && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 py-2">
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-xs font-semibold text-primary tracking-wide">📅 {format(actDate, 'MMMM yyyy')}</span>
                          <div className="h-px flex-1 bg-border" />
                        </motion.div>
                      )}
                      <ActivityCard
                        activity={activity}
                        onDelete={handleDelete}
                        currentUserId={currentUserId}
                        reactions={reactions[activity.id] ?? []}
                        onReactionChange={() => { fetchReactions(activities); fetchActivities(); }}
                        profiles={profiles}
                        isActive={isRecentlyActive(lastActive[activity.user_id ?? ''])}
                      />
                    </div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.main>
      </PullToRefresh>

      {editingAvatar && (
        <AvatarEditor
          open
          onClose={() => setEditingAvatar(false)}
          currentEmoji={avatar.emoji}
          currentColor={avatar.color}
          currentAvatarUrl={avatar.avatarUrl}
          onSaved={() => { fetchProfiles(); refreshProfile(); }}
        />
      )}
    </div>
  );
}
