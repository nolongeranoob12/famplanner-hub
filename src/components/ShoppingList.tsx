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
import { getDisplayAvatar, type Profile } from '@/lib/profiles';
import { MemberAvatar } from '@/components/MemberAvatar';
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
  const [syncPulse, setSyncPulse] = useState(false);
  const [floatingEditor, setFloatingEditor] = useState<{ id: number; userId: string } | null>(null);

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

  useEffect(() => {
    let pulseTimer: ReturnType<typeof setTimeout> | null = null;
    let floatTimer: ReturnType<typeof setTimeout> | null = null;
    const triggerPulse = (editorId?: string | null) => {
      setSyncPulse(true);
      if (pulseTimer) clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => setSyncPulse(false), 1400);
      if (editorId) {
        setFloatingEditor({ id: Date.now(), userId: editorId });
        if (floatTimer) clearTimeout(floatTimer);
        floatTimer = setTimeout(() => setFloatingEditor(null), 2200);
      }
    };
    const channel = supabase
      .channel('shopping-items-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_items' },
        (payload) => {
          const newRow = payload.new as ShoppingItem | null;
          const oldRow = payload.old as ShoppingItem | null;
          // Identify the editor: for toggle updates use done_by, otherwise the row's user_id
          const editorId =
            (payload.eventType === 'UPDATE' && newRow?.done_by) ||
            newRow?.user_id ||
            oldRow?.user_id ||
            null;
          const fromOther = editorId && editorId !== currentUserId;

          if (fromOther) {
            triggerPulse(editorId);
            const editorName = profiles[editorId]?.display_name?.split(' ')[0] || 'Someone';
            if (payload.eventType === 'INSERT' && newRow) {
              toast(`${editorName} added ${newRow.name}`, { icon: '🛒', duration: 2800 });
            } else if (payload.eventType === 'UPDATE' && newRow) {
              if (newRow.is_done && !oldRow?.is_done) {
                toast(`${editorName} ticked off ${newRow.name}`, { icon: '✅', duration: 2800 });
              } else if (!newRow.is_done && oldRow?.is_done) {
                toast(`${editorName} unticked ${newRow.name}`, { icon: '↩️', duration: 2800 });
              }
            } else if (payload.eventType === 'DELETE' && oldRow) {
              toast(`${editorName} removed ${oldRow.name}`, { icon: '🗑️', duration: 2800 });
            }
          }

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
      if (pulseTimer) clearTimeout(pulseTimer);
      if (floatTimer) clearTimeout(floatTimer);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, profiles]);

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
      <div className="relative">
        <SheetTrigger asChild>
          <button
            className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            title="Shopping list"
          >
            {/* Conic gradient ring sweep — appears when another family member changes the list */}
            <AnimatePresence>
              {syncPulse && (
                <motion.span
                  key="sweep"
                  className="absolute -inset-0.5 rounded-full pointer-events-none"
                  style={{
                    background:
                      'conic-gradient(from 0deg, transparent 0deg, hsl(var(--primary)) 90deg, hsl(var(--accent)) 180deg, hsl(var(--primary)) 270deg, transparent 360deg)',
                    WebkitMask:
                      'radial-gradient(circle, transparent 55%, #000 58%, #000 100%)',
                    mask: 'radial-gradient(circle, transparent 55%, #000 58%, #000 100%)',
                  }}
                  initial={{ rotate: 0, opacity: 0 }}
                  animate={{ rotate: 360, opacity: [0, 1, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.3, ease: 'easeInOut', times: [0, 0.15, 0.7, 1] }}
                />
              )}
            </AnimatePresence>

            {/* Soft outward pulse for extra emphasis */}
            <AnimatePresence>
              {syncPulse && (
                <motion.span
                  key="ring"
                  className="absolute inset-0 rounded-full border border-primary/60"
                  initial={{ scale: 0.85, opacity: 0.6 }}
                  animate={{ scale: 1.7, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              )}
            </AnimatePresence>

            <motion.span
              animate={syncPulse ? { rotate: [0, -12, 10, -6, 0], scale: [1, 1.12, 1] } : { rotate: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className="relative flex items-center justify-center"
            >
              <ShoppingCart className={`w-[18px] h-[18px] transition-colors ${syncPulse ? 'text-primary' : 'text-foreground'}`} />
            </motion.span>

            <AnimatePresence>
              {pending.length > 0 && (
                <motion.span
                  key={pending.length}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-sm ring-2 ring-card"
                >
                  {pending.length}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </SheetTrigger>

        {/* Floating avatar of the family member who just changed something */}
        <AnimatePresence>
          {floatingEditor && (() => {
            const av = getDisplayAvatar(floatingEditor.userId, profiles);
            return (
              <motion.div
                key={floatingEditor.id}
                initial={{ opacity: 0, y: 4, scale: 0.6 }}
                animate={{ opacity: 1, y: -22, scale: 1 }}
                exit={{ opacity: 0, y: -34, scale: 0.7 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                className="absolute left-1/2 -translate-x-1/2 -top-1 pointer-events-none z-10"
              >
                <div className="rounded-full ring-2 ring-card shadow-md">
                  <MemberAvatar
                    emoji={av.emoji}
                    color={av.color}
                    avatarUrl={av.avatarUrl}
                    size="sm"
                  />
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-gradient-to-b from-background to-muted/30">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/60 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm shadow-primary/20">
                <ShoppingCart className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="text-left">
                <SheetTitle className="text-base leading-tight">Shopping List</SheetTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
                    <span className="relative rounded-full bg-emerald-500 w-1.5 h-1.5" />
                  </span>
                  Live · synced with family
                </p>
              </div>
            </div>
            {items.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                <span className="text-foreground">{pending.length}</span>
                <span>left</span>
              </div>
            )}
          </div>
        </SheetHeader>

        <form onSubmit={handleAdd} className="px-5 py-3.5 border-b border-border/60 bg-card/40">
          <div className="flex gap-2">
            <Input
              placeholder="Add item (e.g. Milk)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 h-10 rounded-xl bg-background border-border/70 focus-visible:ring-primary/30"
              autoFocus
            />
            <Input
              placeholder="Qty"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-16 h-10 rounded-xl bg-background border-border/70 text-center focus-visible:ring-primary/30"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!name.trim() || adding}
              className="h-10 w-10 rounded-xl shadow-sm shadow-primary/20 disabled:opacity-40 disabled:shadow-none"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </form>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading && items.length === 0 ? (
            <div className="space-y-2 px-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-12 rounded-xl bg-muted/60 animate-pulse"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mx-auto mb-4 ring-1 ring-primary/10">
                <ShoppingCart className="w-7 h-7 text-primary/70" />
              </div>
              <p className="font-semibold text-foreground">Your list is empty</p>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-[240px] mx-auto">
                Add the first item — your family will see it instantly.
              </p>
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <div className="space-y-1.5">
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
                <div className="mt-5">
                  <div className="flex items-center gap-3 px-2 mb-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">
                      Done · {done.length}
                    </span>
                    <div className="flex-1 h-px bg-border/60" />
                    <button
                      onClick={handleClearDone}
                      className="text-[11px] font-semibold text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Clear
                    </button>
                  </div>
                  <div className="space-y-1.5 opacity-90">
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
      exit={{ opacity: 0, x: 24, height: 0, marginTop: 0 }}
      transition={{ duration: 0.2 }}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
        item.is_done
          ? 'bg-muted/40 border-transparent'
          : 'bg-card border-border/50 hover:border-primary/30 hover:shadow-sm'
      }`}
    >
      <button
        onClick={() => onToggle(item)}
        className={`relative w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all active:scale-90 ${
          item.is_done
            ? 'bg-primary border-primary shadow-sm shadow-primary/30'
            : 'border-muted-foreground/30 hover:border-primary hover:bg-primary/5'
        }`}
        aria-label={item.is_done ? 'Mark as not done' : 'Mark as done'}
      >
        {item.is_done && <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0 flex items-center gap-2.5">
        <div className="flex-1 min-w-0">
          <span
            className={`block text-sm font-medium truncate transition-all ${
              item.is_done ? 'line-through text-muted-foreground' : 'text-foreground'
            }`}
          >
            {item.name}
          </span>
          {item.is_done && doneByName && item.done_at && (
            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Check className="w-2.5 h-2.5" strokeWidth={3} />
              {doneByName} · {formatDistanceToNow(new Date(item.done_at), { addSuffix: true })}
            </p>
          )}
        </div>
        {item.quantity && (
          <div
            className={`shrink-0 flex items-center gap-1 pl-2.5 border-l ${
              item.is_done ? 'border-border/60' : 'border-border'
            }`}
          >
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Qty
            </span>
            <span
              className={`min-w-[26px] text-center text-xs font-bold px-2 py-0.5 rounded-md tabular-nums ${
                item.is_done
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
              }`}
            >
              {item.quantity}
            </span>
          </div>
        )}
      </div>
      <button
        onClick={() => onDelete(item.id)}
        className="opacity-60 sm:opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-all active:scale-90"
        title="Remove"
        aria-label="Remove item"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" />
      </button>
    </motion.div>
  );
}
