import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { memberAvatars } from '@/lib/activities';

export function useActivityNotifications(currentUser: string | null) {
  const permissionGranted = useRef(false);

  useEffect(() => {
    if (!currentUser) return;

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((p) => {
        permissionGranted.current = p === 'granted';
      });
    } else if ('Notification' in window) {
      permissionGranted.current = Notification.permission === 'granted';
    }

    const channel = supabase
      .channel('activity-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activities' },
        (payload) => {
          if (!('Notification' in window) || Notification.permission !== 'granted') return;

          const record = payload.new as Record<string, unknown> | undefined;
          if (!record) return;

          const memberName = record.member_name as string;
          const description = record.description as string;
          const emoji = memberAvatars[memberName]?.emoji ?? '👤';

          let title = '';
          if (payload.eventType === 'INSERT') {
            title = `${emoji} ${memberName} posted an activity`;
          } else if (payload.eventType === 'UPDATE') {
            title = `${emoji} ${memberName} edited an activity`;
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as Record<string, unknown>;
            const oldName = old.member_name as string;
            const oldEmoji = memberAvatars[oldName]?.emoji ?? '👤';
            title = `${oldEmoji} ${oldName} removed an activity`;
          }

          if (title) {
            try {
              new Notification(title, {
                body: description || undefined,
                icon: '/pwa-192.png',
                tag: `activity-${record.id ?? 'deleted'}`,
              });
            } catch {
              // Notification constructor may fail in some contexts
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);
}
