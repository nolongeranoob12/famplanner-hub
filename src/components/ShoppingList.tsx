import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, X, Trash2, Check } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import {
  getShoppingItems,
  addShoppingItem,
  toggleShoppingItem,
  deleteShoppingItem,
  clearCompletedItems,
  type ShoppingItem,
} from '@/lib/shopping';
import { type Profile } from '@/lib/profiles';
import { haptic } from '@/lib/haptics';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface ShoppingListProps {
  currentUserId: string;
  profiles: Record<string, Profile>;
}

export function ShoppingList({ currentUserId, profiles }: ShoppingListProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getShoppingItems());
    } catch {
      toast.error('Failed to load shopping list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  // Realtime sync
  useEffect(() => {
    const channel = supabase
      .channel('shopping-items-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_items' },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === 'INSERT') {
              const next = payload.new as ShoppingItem;
              if (prev.find((i) => i.id === next.id)) return prev;
              return [next, ...prev];
            }
            if (payload.eventType === 'UPDATE') {
              const next = payload.new as ShoppingItem;
              return prev.map((i) => (i.id === next.id ? next : i));
            }
            if (payload.eventType === 'DELETE') {
              const oldId = (payload.old as ShoppingItem).id;
              return prev.filter((i) => i.id !== oldId);
            }
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || adding) return;
    setAdding(true);
    haptic('light');
    try {
      await addShoppingItem(name, qty);
      setName('');
      setQty('');
    } catch {
      toast.error('Failed to add item');
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (item: ShoppingItem) => {
    haptic('light');
    // Optimistic
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, is_done: !item.is_done, done_by: !item.is_done ? currentUserId : null, done_at: !item.is_done ? new Date().toISOString() : null }
          : i,
      ),
    );
    try {
      await toggleShoppingItem(item.id, !item.is_done, currentUserId);
    } catch {
      toast.error('Failed to update');
      load();
    }
  };

  const handleDelete = async (id: string) => {
    haptic('medium');
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteShoppingItem(id);
    } catch {
      toast.error('Failed to delete');
      load();
    }
  };

  const handleClearDone = async () => {
    haptic('medium');
    try {
      const n = await clearCompletedItems();
      if (n > 0) toast.success(`Cleared ${n} item${n === 1 ? '' : 's'}`);
    } catch {
      toast.error('Failed to clear');
    }
  };

  const pending = items.filter((i) => !i.is_done);
  const done = items.filter((i) => i.is_done);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          title="Shopping list"
        >
          <ShoppingCart className="w-[18px] h-[18px] text-foreground" />
          {pending.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {pending.length}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Shopping List
          </SheetTitle>
          <p className="text-xs text-muted-foreground text-left">
            Shared with the whole family · syncs in real time
          </p>
        </SheetHeader>

        <form onSubmit={handleAdd} className="px-5 py-3 border-b border-border bg-muted/30">
          <div className="flex gap-2">
            <Input
              placeholder="Add item (e.g. Milk)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1"
              autoFocus
            />
            <Input
              placeholder="Qty"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-20"
            />
            <Button type="submit" size="icon" disabled={!name.trim() || adding}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </form>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading && items.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <ShoppingCart className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">List is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add the first item — your family will see it instantly.
              </p>
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <div className="space-y-1 py-1">
                  <AnimatePresence initial={false}>
                    {pending.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        profiles={profiles}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {done.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between px-2 py-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Done · {done.length}
                    </span>
                    <button
                      onClick={handleClearDone}
                      className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Clear
                    </button>
                  </div>
                  <div className="space-y-1">
                    <AnimatePresence initial={false}>
                      {done.map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          profiles={profiles}
                          onToggle={handleToggle}
                          onDelete={handleDelete}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ItemRow({
  item,
  profiles,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem;
  profiles: Record<string, Profile>;
  onToggle: (i: ShoppingItem) => void;
  onDelete: (id: string) => void;
}) {
  const doneByName = item.done_by ? profiles[item.done_by]?.display_name : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.18 }}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors"
    >
      <button
        onClick={() => onToggle(item)}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
          item.is_done
            ? 'bg-primary border-primary'
            : 'border-muted-foreground/40 hover:border-primary'
        }`}
      >
        {item.is_done && <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className={`text-sm font-medium truncate ${
              item.is_done ? 'line-through text-muted-foreground' : 'text-foreground'
            }`}
          >
            {item.name}
          </span>
          {item.quantity && (
            <span className="text-xs text-muted-foreground shrink-0">{item.quantity}</span>
          )}
        </div>
        {item.is_done && doneByName && item.done_at && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            ✓ {doneByName} · {formatDistanceToNow(new Date(item.done_at), { addSuffix: true })}
          </p>
        )}
      </div>
      <button
        onClick={() => onDelete(item.id)}
        className="opacity-0 group-hover:opacity-100 sm:opacity-0 w-7 h-7 rounded-full hover:bg-destructive/10 flex items-center justify-center transition-opacity"
        title="Remove"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
      </button>
    </motion.div>
  );
}
