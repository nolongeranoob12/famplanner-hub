import { supabase } from '@/integrations/supabase/client';

export const reactionEmojis = ['❤️', '👍', '😂'] as const;
export type ReactionEmoji = (typeof reactionEmojis)[number];

export interface Reaction {
  id: string;
  activity_id: string;
  user_id: string | null;
  member_name: string; // legacy fallback
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
  for (const r of ((data ?? []) as unknown as Reaction[])) {
    (map[r.activity_id] ??= []).push(r);
  }
  return map;
}

export async function toggleReaction(activityId: string, userId: string, displayName: string, emoji: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('activity_reactions')
    .select('id')
    .eq('activity_id', activityId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle();

  if (existing) {
    await supabase.from('activity_reactions').delete().eq('id', existing.id);
    return false;
  }
  await supabase.from('activity_reactions').insert({
    activity_id: activityId,
    emoji,
    member_name: displayName, // satisfies legacy NOT NULL column
  } as any);
  return true;
}
