import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { memberAvatars } from '@/lib/activities';

export function useActivityNotifications(currentUser: string | null) {
  const permissionGranted = useRef(false);

  useEffect(() => {
    if (!currentUser) return;

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
        async (payload) => {
          const record = payload.new as Record<string, unknown> | undefined;
          const oldRecord = payload.old as Record<string, unknown> | undefined;

          let memberName = '';
          let description = '';
          let title = '';

          if (payload.eventType === 'INSERT' && record) {
            memberName = record.member_name as string;
            description = record.description as string;
            const emoji = memberAvatars[memberName]?.emoji ?? '👤';
            title = `${emoji} ${memberName} posted an activity`;
          } else if (payload.eventType === 'UPDATE' && record) {
            memberName = record.member_name as string;
            description = record.description as string;
            const emoji = memberAvatars[memberName]?.emoji ?? '👤';
            title = `${emoji} ${memberName} edited an activity`;
          } else if (payload.eventType === 'DELETE' && oldRecord) {
            memberName = oldRecord.member_name as string;
            const oldEmoji = memberAvatars[memberName]?.emoji ?? '👤';
            title = `${oldEmoji} ${memberName} removed an activity`;
          }

          if (!title) return;

          // Show in-app notification if tab is visible
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(title, {
                body: description || undefined,
                icon: '/pwa-192.png',
                tag: `activity-${(record?.id as string) ?? 'deleted'}`,
              });
            } catch {
              // may fail in some contexts
            }
          }

          // Also trigger push notifications for offline users via edge function
          try {
            await supabase.functions.invoke('send-push', {
              body: {
                title,
                body: description || 'Check the family board!',
                exclude_member: currentUser,
              },
            });
          } catch (err) {
            console.error('Failed to send push notifications:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);
}
