import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Badge } from '@capawesome/capacitor-badge';

export interface AppNotification {
  id: string;
  log_id: string;
  user_id: string | null;
  member_name: string;
  is_read: boolean;
  created_at: string;
  activity_log?: {
    member_name: string;
    action: string;
    description: string | null;
    created_at: string;
    user_id?: string | null;
  };
}

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function useNotifications(currentUserId: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from('notifications')
      .select('*, activity_log(*)')
      .eq('user_id', currentUserId)
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
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    fetchNotifications();

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUserId}`,
        },
        async (payload) => {
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

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, fetchNotifications]);

  useEffect(() => {
    const badgeNavigator = navigator as BadgeNavigator;
    if (Capacitor.isNativePlatform()) {
      if (unreadCount > 0) {
        Badge.set({ count: unreadCount }).catch(() => undefined);
      } else {
        Badge.clear().catch(() => undefined);
      }
      return;
    }
    navigator.serviceWorker?.ready
      .then((reg) => { reg.active?.postMessage({ type: 'set-badge-count', count: unreadCount }); })
      .catch(() => undefined);
    if (unreadCount > 0) {
      badgeNavigator.setAppBadge?.(unreadCount).catch(() => undefined);
      return;
    }
    badgeNavigator.clearAppBadge?.().catch(() => undefined);
  }, [unreadCount]);

  useEffect(() => {
    if (!currentUserId || !Capacitor.isNativePlatform()) return;
    const onNativePush = () => fetchNotifications();
    window.addEventListener('native-push-received', onNativePush);
    const appHandle = App.addListener('resume', () => fetchNotifications());

    return () => {
      window.removeEventListener('native-push-received', onNativePush);
      appHandle.then((h) => h.remove());
    };
  }, [currentUserId, fetchNotifications]);

  const markAllRead = useCallback(async () => {
    if (!currentUserId) return;
    await supabase
      .from('notifications')
      .update({ is_read: true } as any)
      .eq('user_id', currentUserId)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [currentUserId]);

  const markRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ is_read: true } as any).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  return { notifications, unreadCount, markAllRead, markRead, refetch: fetchNotifications };
}
