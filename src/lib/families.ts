import { supabase } from '@/integrations/supabase/client';

export interface Family {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function getMyFamily(): Promise<Family | null> {
  const { data, error } = await supabase.from('families').select('*').limit(1).maybeSingle();
  if (error) {
    console.warn('getMyFamily error', error);
    return null;
  }
  return data as Family | null;
}

export async function createFamily(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_family' as any, { _name: name });
  if (error) throw error;
  return data as string;
}

export async function joinFamilyByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_family_by_code' as any, { _code: code });
  if (error) throw error;
  return data as string;
}

export async function regenerateInviteCode(familyId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_invite_code' as any, { _family_id: familyId });
  if (error) throw error;
  return data as string;
}

export async function renameFamily(familyId: string, name: string): Promise<void> {
  const { error } = await supabase.from('families').update({ name }).eq('id', familyId);
  if (error) throw error;
}

export async function isFamilyOwner(familyId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_roles' as any)
    .select('role')
    .eq('family_id', familyId)
    .eq('user_id', userId)
    .eq('role', 'owner')
    .maybeSingle();
  return !!data;
}
