import { supabase } from '@/integrations/supabase/client';

export type ActivityType = 'dinner' | 'sports' | 'errands' | 'travel' | 'movie' | 'hangout' | 'cooking' | 'work' | 'other';

export interface Activity {
  id: string;
  user_id: string | null;
  family_id: string | null;
  member_name: string; // legacy column, kept as fallback display name
  type: ActivityType;
  description: string;
  image_url: string | null;
  activity_date: string | null;
  time_start: string | null;
  time_end: string | null;
  created_at: string;
  updated_at: string;
  pinned_at: string | null;
}

export async function setActivityPinned(id: string, pinned: boolean) {
  const { error } = await supabase
    .from('activities')
    .update({ pinned_at: pinned ? new Date().toISOString() : null } as any)
    .eq('id', id);
  if (error) throw error;
}

export const activityConfig: Record<ActivityType, { emoji: string; label: string; bgClass: string; textClass: string }> = {
  dinner:  { emoji: '🍽️', label: 'Dinner Out', bgClass: 'bg-gradient-to-r from-orange-100/80 to-amber-50/60 backdrop-blur-sm border border-orange-200/40',  textClass: 'text-orange-700' },
  sports:  { emoji: '🏃', label: 'Sports',     bgClass: 'bg-gradient-to-r from-emerald-100/80 to-green-50/60 backdrop-blur-sm border border-emerald-200/40', textClass: 'text-emerald-700' },
  errands: { emoji: '🛒', label: 'Errands',    bgClass: 'bg-gradient-to-r from-sky-100/80 to-blue-50/60 backdrop-blur-sm border border-sky-200/40',     textClass: 'text-sky-700' },
  travel:  { emoji: '✈️', label: 'Travel',      bgClass: 'bg-gradient-to-r from-violet-100/80 to-purple-50/60 backdrop-blur-sm border border-violet-200/40',  textClass: 'text-violet-700' },
  movie:   { emoji: '🎬', label: 'Movie',       bgClass: 'bg-gradient-to-r from-pink-100/80 to-rose-50/60 backdrop-blur-sm border border-pink-200/40',    textClass: 'text-pink-700' },
  hangout: { emoji: '☕', label: 'Hangout',     bgClass: 'bg-gradient-to-r from-amber-100/80 to-yellow-50/60 backdrop-blur-sm border border-amber-200/40',   textClass: 'text-amber-700' },
  cooking: { emoji: '🍳', label: 'Cooking',     bgClass: 'bg-gradient-to-r from-red-100/80 to-orange-50/60 backdrop-blur-sm border border-red-200/40',     textClass: 'text-red-700' },
  work:    { emoji: '💼', label: 'Work',        bgClass: 'bg-gradient-to-r from-slate-100/80 to-gray-50/60 backdrop-blur-sm border border-slate-200/40',   textClass: 'text-slate-700' },
  other:   { emoji: '📌', label: 'Other',       bgClass: 'bg-gradient-to-r from-muted/80 to-muted/40 backdrop-blur-sm border border-border/40',      textClass: 'text-muted-foreground' },
};

export async function getActivities(): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Activity[];
}

export async function addActivity(activity: { type: ActivityType; description: string; activity_date?: string; time_start?: string; time_end?: string; image_url?: string; member_name: string }): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    .insert(activity as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Activity;
}

export async function uploadActivityPhoto(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('activity-photos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('activity-photos').getPublicUrl(path);
  return urlData.publicUrl;
}

export async function deleteActivity(id: string) {
  const { error } = await supabase.from('activities').delete().eq('id', id);
  if (error) throw error;
}

// ── Member activity status ─────────────────────────────────────────

export async function getMemberLastActive(): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('activities')
    .select('user_id, created_at')
    .order('created_at', { ascending: false });
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as any[]) {
    if (row.user_id && !map[row.user_id]) {
      map[row.user_id] = row.created_at;
    }
  }
  return map;
}

export function isRecentlyActive(lastActive: string | undefined, withinMinutes = 60): boolean {
  if (!lastActive) return false;
  const diff = Date.now() - new Date(lastActive).getTime();
  return diff < withinMinutes * 60 * 1000;
}
