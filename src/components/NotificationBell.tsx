import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import type { SubscribeResult } from '@/hooks/usePushSubscription';
import { memberAvatars } from '@/lib/activities';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface NotificationBellProps {
  currentUser: string;
  pushSubscribed: boolean | null;
  onEnablePush: () => Promise<SubscribeResult>;
}

const subscribeErrorMessage: Record<Exclude<SubscribeResult, { ok: true }>['reason'], string> = {
  'no-user': 'Please choose your name first.',
  'preview': 'Open the published app to turn on phone notifications.',
  'ios-home-screen': 'Open the Home Screen app to turn on phone notifications.',
  'unsupported': 'This device/browser does not support background notifications here.',
  'blocked': 'Notifications are blocked for this app. Please allow them in your browser settings.',
  'save-failed': 'Notifications were allowed, but saving this phone failed. Please try again.',
  'subscribe-failed': 'Could not register this phone for notifications. Please try again.',
};

export function NotificationBell({ currentUser, pushSubscribed, onEnablePush }: NotificationBellProps) {
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications(currentUser);

  const actionEmoji: Record<string, string> = {
    created: '🆕',
    updated: '✏️',
    deleted: '🗑️',
  };

  const handleEnablePush = async () => {
    const result = await onEnablePush();

    if (result.ok) {
      toast.success('Phone notifications are now on.');
      return;
    }

    toast.error(subscribeErrorMessage[(result as { ok: false; reason: keyof typeof subscribeErrorMessage }).reason]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-xl h-9 w-9">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] font-bold flex items-center justify-center bg-destructive text-destructive-foreground border-2 border-background">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 text-primary" onClick={markAllRead}>
              <Check className="w-3 h-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        {pushSubscribed !== true && (
          <div className="border-b border-border bg-muted/40 px-4 py-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Turn on phone alerts so you still get notified after closing the app.
            </p>
            <Button size="sm" className="w-full" onClick={handleEnablePush}>
              Enable phone notifications
            </Button>
          </div>
        )}
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => {
                const log = n.activity_log;
                const emoji = log ? (memberAvatars[log.member_name]?.emoji ?? '👤') : '👤';
                const action = log?.action ?? 'updated';
                return (
                  <button
                    key={n.id}
                    className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}
                    onClick={() => !n.is_read && markRead(n.id)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5">{emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                          {actionEmoji[action] ?? '📌'} {log?.member_name ?? 'Someone'}{' '}
                          {action} an activity
                        </p>
                        {log?.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {log.description}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
