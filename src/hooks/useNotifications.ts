import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AppNotification {
  id: string;
  log_id: string;
  member_name: string;
  is_read: boolean;
  created_at: string;
  activity_log?: {
    member_name: string;
    action: string;
    description: string | null;
    created_at: string;
  };
}

export function useNotifications(currentUser: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from('notifications')
      .select('*, activity_log(*)')
      .eq('member_name', currentUser)
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) {
      const mapped = (data as any[]).map((n) => ({
        ...n,
        activity_log: n.activity_log ?? undefined,
      }));
      setNotifications(mapped);
      setUnreadCount(mapped.filter((n) => !n.is_read).length);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    fetchNotifications();

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `member_name=eq.${currentUser}`,
        },
        async (payload) => {
          // Fetch the full notification with joined log
          const { data } = await supabase
            .from('notifications')
            .select('*, activity_log(*)')
            .eq('id', (payload.new as any).id)
            .single();
          if (data) {
            const mapped = { ...(data as any), activity_log: (data as any).activity_log ?? undefined };
            setNotifications((prev) => [mapped, ...prev].slice(0, 30));
            setUnreadCount((c) => c + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, fetchNotifications]);

  const markAllRead = useCallback(async () => {
    if (!currentUser) return;
    await supabase
      .from('notifications')
      .update({ is_read: true } as any)
      .eq('member_name', currentUser)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [currentUser]);

  const markRead = useCallback(async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true } as any)
      .eq('id', id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  return { notifications, unreadCount, markAllRead, markRead, refetch: fetchNotifications };
}
