import { supabase } from '@/integrations/supabase/client';

export type ActivityType = 'dinner' | 'sports' | 'errands' | 'travel' | 'movie' | 'hangout' | 'other';

export interface Activity {
  id: string;
  member_name: string;
  type: ActivityType;
  description: string;
  activity_date: string | null;
  activity_time: string | null;
  time_start: string | null;
  time_end: string | null;
  created_at: string;
  updated_at: string;
}

export const activityConfig: Record<ActivityType, { emoji: string; label: string; bgClass: string; textClass: string }> = {
  dinner:  { emoji: '🍽️', label: 'Dinner Out', bgClass: 'bg-orange-50',  textClass: 'text-orange-600' },
  sports:  { emoji: '🏃', label: 'Sports',     bgClass: 'bg-emerald-50', textClass: 'text-emerald-600' },
  errands: { emoji: '🛒', label: 'Errands',    bgClass: 'bg-sky-50',     textClass: 'text-sky-600' },
  travel:  { emoji: '✈️', label: 'Travel',      bgClass: 'bg-violet-50',  textClass: 'text-violet-600' },
  movie:   { emoji: '🎬', label: 'Movie',       bgClass: 'bg-pink-50',    textClass: 'text-pink-600' },
  hangout: { emoji: '☕', label: 'Hangout',     bgClass: 'bg-amber-50',   textClass: 'text-amber-600' },
  other:   { emoji: '📌', label: 'Other',       bgClass: 'bg-muted',      textClass: 'text-muted-foreground' },
};

export const familyMembers = ['Dad', 'Mom', 'Jitsoon', 'Jityi', 'Jitbao', 'Ruimin'] as const;

export const memberAvatars: Record<string, { color: string; emoji: string }> = {
  Dad:     { color: 'bg-sky-500',    emoji: '👨' },
  Mom:     { color: 'bg-rose-400',   emoji: '👩' },
  Jitsoon: { color: 'bg-amber-500',  emoji: '😎' },
  Jityi:   { color: 'bg-violet-500', emoji: '🦊' },
  Jitbao:  { color: 'bg-emerald-500',emoji: '🐻' },
  Ruimin:  { color: 'bg-pink-400',   emoji: '🌸' },
};

export async function getActivities(): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Activity[];
}

export async function addActivity(activity: { member_name: string; type: ActivityType; description: string; activity_date?: string; activity_time?: string }): Promise<Activity> {
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
