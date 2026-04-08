import { supabase } from '@/integrations/supabase/client';

export type ActivityType = 'dinner' | 'sports' | 'errands' | 'travel' | 'movie' | 'hangout' | 'cooking' | 'work' | 'other';

export interface Activity {
  id: string;
  member_name: string;
  type: ActivityType;
  description: string;
  image_url: string | null;
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

export async function addActivity(activity: { member_name: string; type: ActivityType; description: string; activity_date?: string; time_start?: string; time_end?: string; image_url?: string }): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    .insert(activity)
    .select()
    .single();
  if (error) throw error;
  return data as Activity;
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

// ── Reactions ──────────────────────────────────────────────────────

export const reactionEmojis = ['❤️', '👍', '😂'] as const;
export type ReactionEmoji = (typeof reactionEmojis)[number];

export interface Reaction {
  id: string;
  activity_id: string;
  member_name: string;
  emoji: string;
  created_at: string;
}

export async function getReactions(activityIds: string[]): Promise<Record<string, Reaction[]>> {
  if (activityIds.length === 0) return {};
  const { data, error } = await supabase
    .from('activity_reactions')
    .select('*')
    .in('activity_id', activityIds);
  if (error) throw error;
  const map: Record<string, Reaction[]> = {};
  for (const r of (data ?? []) as Reaction[]) {
    (map[r.activity_id] ??= []).push(r);
  }
  return map;
}

export async function toggleReaction(activityId: string, memberName: string, emoji: string): Promise<boolean> {
  // Check if already reacted
  const { data: existing } = await supabase
    .from('activity_reactions')
    .select('id')
    .eq('activity_id', activityId)
    .eq('member_name', memberName)
    .eq('emoji', emoji)
    .maybeSingle();

  if (existing) {
    await supabase.from('activity_reactions').delete().eq('id', existing.id);
    return false; // removed
  } else {
    await supabase.from('activity_reactions').insert({ activity_id: activityId, member_name: memberName, emoji });
    return true; // added
  }
}

// ── Member profiles (phone numbers & avatars) ─────────────────────

export interface MemberProfile {
  member_name: string;
  phone: string | null;
  avatar_emoji: string | null;
  avatar_url: string | null;
}

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

export async function getAllMemberProfiles(): Promise<Record<string, MemberProfile>> {
  const { data } = await (supabase as any).from('member_profiles').select('member_name, phone, avatar_emoji, avatar_url');
  const map: Record<string, MemberProfile> = {};
  for (const row of data ?? []) {
    map[row.member_name] = row;
  }
  return map;
}

export async function setMemberAvatar(memberName: string, avatar_emoji?: string, avatar_url?: string): Promise<void> {
  await (supabase as any).from('member_profiles').upsert(
    { member_name: memberName, avatar_emoji: avatar_emoji ?? null, avatar_url: avatar_url ?? null },
    { onConflict: 'member_name' }
  );
}

export async function uploadMemberAvatar(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('member-avatars').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('member-avatars').getPublicUrl(path);
  return urlData.publicUrl;
}

// ── Member activity status ─────────────────────────────────────────

export async function getMemberLastActive(): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('activities')
    .select('member_name, created_at')
    .order('created_at', { ascending: false });
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (!map[row.member_name]) {
      map[row.member_name] = row.created_at;
    }
  }
  return map;
}

export function isRecentlyActive(lastActive: string | undefined, withinMinutes = 60): boolean {
  if (!lastActive) return false;
  const diff = Date.now() - new Date(lastActive).getTime();
  return diff < withinMinutes * 60 * 1000;
}

// Helper to get display avatar (custom overrides default)
export function getDisplayAvatar(memberName: string, profiles: Record<string, MemberProfile>): { emoji: string; color: string; avatarUrl?: string } {
  const defaults = memberAvatars[memberName] ?? { color: 'bg-primary', emoji: '👤' };
  const profile = profiles[memberName];
  if (profile?.avatar_url) {
    return { ...defaults, avatarUrl: profile.avatar_url };
  }
  if (profile?.avatar_emoji) {
    return { ...defaults, emoji: profile.avatar_emoji };
  }
  return defaults;
}
