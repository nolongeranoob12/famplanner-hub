import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  family_id: string | null;
  display_name: string;
  avatar_emoji: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

const fallbackColors = [
  'bg-sky-500', 'bg-rose-400', 'bg-amber-500', 'bg-violet-500',
  'bg-emerald-500', 'bg-pink-400', 'bg-orange-500', 'bg-cyan-500',
  'bg-lime-500', 'bg-fuchsia-500',
];

const fallbackEmojis = ['👨', '👩', '😎', '🦊', '🐻', '🌸', '🐱', '🐶', '🦁', '🐼'];

export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return fallbackColors[Math.abs(hash) % fallbackColors.length];
}

export function emojiForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 17 + userId.charCodeAt(i)) | 0;
  return fallbackEmojis[Math.abs(hash) % fallbackEmojis.length];
}

export interface DisplayAvatar {
  emoji: string;
  color: string;
  avatarUrl?: string;
  displayName: string;
}

export function getDisplayAvatar(userId: string, profiles: Record<string, Profile>): DisplayAvatar {
  const p = profiles[userId];
  return {
    emoji: p?.avatar_emoji || emojiForUser(userId),
    color: colorForUser(userId),
    avatarUrl: p?.avatar_url ?? undefined,
    displayName: p?.display_name?.trim() || 'Unknown',
  };
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data } = await supabase.from('profiles' as any).select('*').eq('id', uid).maybeSingle();
  return (data as unknown as Profile) ?? null;
}

export async function getFamilyProfiles(): Promise<Record<string, Profile>> {
  const { data, error } = await supabase.from('profiles' as any).select('*');
  if (error) {
    console.warn('getFamilyProfiles error', error);
    return {};
  }
  const map: Record<string, Profile> = {};
  for (const row of (data ?? []) as unknown as Profile[]) {
    map[row.id] = row;
  }
  return map;
}

export async function updateMyProfile(updates: Partial<Pick<Profile, 'display_name' | 'avatar_emoji' | 'avatar_url' | 'phone'>>): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('Not authenticated');
  const { error } = await supabase.from('profiles' as any).update(updates).eq('id', uid);
  if (error) throw error;
}

export async function uploadMyAvatar(file: File): Promise<string> {
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
