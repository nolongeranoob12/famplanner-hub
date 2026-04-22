import { supabase } from '@/integrations/supabase/client';

export type ShoppingItem = {
  id: string;
  family_id: string | null;
  user_id: string | null;
  name: string;
  quantity: string | null;
  is_done: boolean;
  done_by: string | null;
  done_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getShoppingItems(): Promise<ShoppingItem[]> {
  const { data, error } = await supabase
    .from('shopping_items')
    .select('*')
    .order('is_done', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ShoppingItem[];
}

export async function addShoppingItem(name: string, quantity?: string): Promise<ShoppingItem> {
  const { data, error } = await supabase
    .from('shopping_items')
    .insert({ name: name.trim(), quantity: quantity?.trim() || null })
    .select()
    .single();
  if (error) throw error;
  return data as ShoppingItem;
}

export async function toggleShoppingItem(id: string, isDone: boolean, userId: string) {
  const { error } = await supabase
    .from('shopping_items')
    .update({
      is_done: isDone,
      done_by: isDone ? userId : null,
      done_at: isDone ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteShoppingItem(id: string) {
  const { error } = await supabase.from('shopping_items').delete().eq('id', id);
  if (error) throw error;
}

export async function clearCompletedItems(): Promise<number> {
  const { data, error } = await supabase
    .from('shopping_items')
    .delete()
    .eq('is_done', true)
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}
