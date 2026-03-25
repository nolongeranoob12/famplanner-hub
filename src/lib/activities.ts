import { supabase } from '@/integrations/supabase/client';

export type ActivityType = 'dinner' | 'sports' | 'errands' | 'travel' | 'movie' | 'hangout' | 'other';

export interface Activity {
  id: string;
  member_name: string;
  type: ActivityType;
  description: string;
  activity_date: string | null;
  created_at: string;
  updated_at: string;
}

export const activityConfig: Record<ActivityType, { emoji: string; label: string; color: string }> = {
  dinner: { emoji: '🍽️', label: 'Dinner Out', color: 'bg-orange-100 text-orange-700' },
  sports: { emoji: '🏃', label: 'Sports', color: 'bg-green-100 text-green-700' },
  errands: { emoji: '🛒', label: 'Errands', color: 'bg-blue-100 text-blue-700' },
  travel: { emoji: '✈️', label: 'Travel', color: 'bg-purple-100 text-purple-700' },
  movie: { emoji: '🎬', label: 'Movie', color: 'bg-pink-100 text-pink-700' },
  hangout: { emoji: '☕', label: 'Hangout', color: 'bg-yellow-100 text-yellow-700' },
  other: { emoji: '📌', label: 'Other', color: 'bg-muted text-muted-foreground' },
};

export async function getActivities(): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Activity[];
}

export async function addActivity(activity: { member_name: string; type: ActivityType; description: string; activity_date?: string }): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    .insert(activity)
    .select()
    .single();
  if (error) throw error;
  return data as Activity;
}

export async function deleteActivity(id: string) {
  const { error } = await supabase.from('activities').delete().eq('id', id);
  if (error) throw error;
}
