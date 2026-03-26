import { useState, useEffect, useCallback } from 'react';
import { AddActivityForm } from '@/components/AddActivityForm';
import { ActivityCard } from '@/components/ActivityCard';
import { getActivities, addActivity, deleteActivity, type Activity, type ActivityType } from '@/lib/activities';
import { Loader2, Home } from 'lucide-react';
import { toast } from 'sonner';

export default function Index() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

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
    fetchActivities();
  }, [fetchActivities]);

  const handleAdd = useCallback(async (data: { member_name: string; type: ActivityType; description: string; activity_date?: string }) => {
    try {
      const newActivity = await addActivity(data);
      setActivities(prev => [newActivity, ...prev]);
      toast.success('Activity posted!');
    } catch {
      toast.error('Failed to post activity');
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteActivity(id);
      setActivities(prev => prev.filter(a => a.id !== id));
      toast.success('Activity removed');
    } catch {
      toast.error('Failed to delete activity');
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/60">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center shadow-md">
            <Home className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-foreground leading-tight tracking-tight">Chau Family</h1>
            <p className="text-xs text-muted-foreground mt-0.5">What's everyone up to today?</p>
          </div>
          <div className="ml-auto flex -space-x-2">
            {['👨', '👩', '😎', '🦊', '🐻', '🌸'].map((emoji, i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-sm">
                {emoji}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-xl mx-auto px-5 py-6 space-y-4">
        <AddActivityForm onAdd={handleAdd} />

        {/* Activities count */}
        {!loading && activities.length > 0 && (
          <div className="flex items-center gap-2 pt-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {activities.length} {activities.length === 1 ? 'Activity' : 'Activities'}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading activities…</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">👨‍👩‍👧‍👦</span>
            </div>
            <p className="text-foreground font-bold text-lg">No activities yet</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-[250px] mx-auto">
              Post what you're up to so the family knows!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map(activity => (
              <ActivityCard key={activity.id} activity={activity} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
