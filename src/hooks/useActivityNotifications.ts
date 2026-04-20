import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useActivityNotifications(currentUserId: string | null) {
  const permissionGranted = useRef(false);

  useEffect(() => {
    if (!currentUserId) return;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((p) => { permissionGranted.current = p === 'granted'; });
    } else if ('Notification' in window) {
      permissionGranted.current = Notification.permission === 'granted';
    }

    const channel = supabase
      .channel('activity-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activities' },
        async (payload) => {
          const record = payload.new as Record<string, unknown> | undefined;
          const oldRecord = payload.old as Record<string, unknown> | undefined;
          let actorName = '';
          let description = '';
          let title = '';

          if (payload.eventType === 'INSERT' && record) {
            actorName = (record.member_name as string) || 'Someone';
            description = record.description as string;
            title = `${actorName} posted an activity`;
          } else if (payload.eventType === 'UPDATE' && record) {
            actorName = (record.member_name as string) || 'Someone';
            description = record.description as string;
            title = `${actorName} edited an activity`;
          } else if (payload.eventType === 'DELETE' && oldRecord) {
            actorName = (oldRecord.member_name as string) || 'Someone';
            title = `${actorName} removed an activity`;
          }

          if (!title) return;

          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(title, {
                body: description || undefined,
                icon: '/pwa-192.png',
                tag: `activity-${(record?.id as string) ?? 'deleted'}`,
              });
            } catch { /* ignore */ }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);
}
