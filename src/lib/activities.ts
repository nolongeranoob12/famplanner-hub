import { supabase } from '@/integrations/supabase/client';

export type ActivityType = 'dinner' | 'sports' | 'errands' | 'travel' | 'movie' | 'hangout' | 'cooking' | 'work' | 'other';

export interface Activity {
  id: string;
  member_name: string;
  type: ActivityType;
  description: string;
  activity_date: string | null;
  
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
  cooking: { emoji: '🍳', label: 'Cooking',     bgClass: 'bg-red-50',     textClass: 'text-red-600' },
  work:    { emoji: '💼', label: 'Work',        bgClass: 'bg-slate-50',   textClass: 'text-slate-600' },
  other:   { emoji: '📌', label: 'Other',       bgClass: 'bg-muted',      textClass: 'text-muted-foreground' },
};

export const familyMembers = ['Dad', 'Mom', 'Jitsoon', 'Jityi', 'Jitbao', 'Ruimin'] as const;

export const memberAvatars: Record<string, { color: string; emoji: string; phone?: string }> = {
  Dad:     { color: 'bg-sky-500',    emoji: '👨', phone: '' },
  Mom:     { color: 'bg-rose-400',   emoji: '👩', phone: '' },
  Jitsoon: { color: 'bg-amber-500',  emoji: '😎', phone: '' },
  Jityi:   { color: 'bg-violet-500', emoji: '🦊', phone: '' },
  Jitbao:  { color: 'bg-emerald-500',emoji: '🐻', phone: '' },
  Ruimin:  { color: 'bg-pink-400',   emoji: '🌸', phone: '' },
};

export async function getActivities(): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Activity[];
}

async function sendPush(title: string, body: string, excludeMember?: string) {
  try {
    await supabase.functions.invoke('send-push', {
      body: { title, body, exclude_member: excludeMember },
    });
  } catch (e) {
    console.warn('Push send failed (non-critical):', e);
  }
}

export async function addActivity(activity: { member_name: string; type: ActivityType; description: string; activity_date?: string; time_start?: string; time_end?: string; image?: File }): Promise<Activity> {
  let image_url: string | null = null;

  if (activity.image) {
    const ext = activity.image.name.split('.').pop() || 'jpg';
    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('activity-photos')
      .upload(filePath, activity.image, { contentType: activity.image.type });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('activity-photos').getPublicUrl(filePath);
    image_url = urlData.publicUrl;
  }

  const { image, ...rest } = activity;
  const { data, error } = await supabase
    .from('activities')
    .insert({ ...rest, image_url })
    .select()
    .single();
  if (error) throw error;
  return data as Activity;
}

export async function deleteActivity(id: string) {
  const { error } = await supabase.from('activities').delete().eq('id', id);
  if (error) throw error;
}

// ── Member profiles (phone numbers) ────────────────────────────────

export async function getMemberPhone(memberName: string): Promise<string> {
  const { data } = await (supabase as any).from('member_profiles').select('phone').eq('member_name', memberName).maybeSingle();
  return data?.phone ?? '';
}

export async function setMemberPhone(memberName: string, phone: string): Promise<void> {
  await (supabase as any).from('member_profiles').upsert(
    { member_name: memberName, phone },
    { onConflict: 'member_name' }
  );
}
