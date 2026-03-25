import { useState, useEffect, useCallback } from 'react';
import { AddActivityForm } from '@/components/AddActivityForm';
import { ActivityCard } from '@/components/ActivityCard';
import { getActivities, addActivity, deleteActivity, type Activity, type ActivityType } from '@/lib/activities';
import { Users, Loader2 } from 'lucide-react';
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
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Users className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-foreground leading-tight">Family Board</h1>
            <p className="text-xs text-muted-foreground">What's everyone up to?</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <AddActivityForm onAdd={handleAdd} />

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">👨‍👩‍👧‍👦</p>
            <p className="text-muted-foreground font-semibold">No activities yet</p>
            <p className="text-sm text-muted-foreground mt-1">Post what you're up to so the family knows!</p>
          </div>
        ) : (
          activities.map(activity => (
            <ActivityCard key={activity.id} activity={activity} onDelete={handleDelete} />
          ))
        )}
      </main>
    </div>
  );
}
