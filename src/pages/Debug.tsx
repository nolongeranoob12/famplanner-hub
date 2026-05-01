import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, AlertCircle, Send, Trash2, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  getNativePushLogs,
  subscribeNativePushLogs,
  clearNativePushLogs,
  useNativePush,
  type NativePushLogEntry,
} from '@/hooks/useNativePush';

function StatusIcon({ ok }: { ok: boolean | null }) {
  if (ok === null) return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
  return ok ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-destructive" />;
}

export default function Debug() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const currentUser = user?.id ?? null;
  const [info, setInfo] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pushLogs, setPushLogs] = useState<NativePushLogEntry[]>(() => getNativePushLogs());
  const [registering, setRegistering] = useState(false);

  const { subscribe: registerNativePush } = useNativePush(
    currentUser,
    profile?.display_name ?? 'Unknown',
    profile?.family_id ?? null,
  );

  useEffect(() => {
    setPushLogs(getNativePushLogs());
    const unsub = subscribeNativePushLogs((entries) => setPushLogs(entries));
    return unsub;
  }, []);

  const triggerRegistration = async () => {
    setRegistering(true);
    try {
      const result = await registerNativePush({ requestPermission: true });
      if (result.ok === true) {
        toast.success('APNs registration succeeded.');
      } else {
        toast.error(`Registration failed: ${result.reason}${result.detail ? ` — ${result.detail}` : ''}`);
      }
    } catch (e: any) {
      toast.error(`Error: ${e?.message ?? String(e)}`);
    } finally {
      setRegistering(false);
    }
  };

  const gather = async () => {
    setLoading(true);
    const result: Record<string, any> = {};

    // Basic environment
    result.currentUser = currentUser;
    result.url = window.location.href;
    result.standalone = (navigator as any).standalone ?? window.matchMedia('(display-mode: standalone)').matches;
    result.swSupported = 'serviceWorker' in navigator;
    result.pushSupported = 'PushManager' in window;
    result.notifSupported = 'Notification' in window;
    result.notifPermission = 'Notification' in window ? Notification.permission : 'N/A';
    result.badgeSupported = 'setAppBadge' in navigator;

    // Service worker
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration('/');
        result.swRegistered = !!reg;
        result.swState = reg?.active?.state ?? reg?.installing?.state ?? reg?.waiting?.state ?? 'none';
        result.swScope = reg?.scope ?? 'N/A';

        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          result.pushSubscribed = !!sub;
          result.pushEndpoint = sub?.endpoint?.substring(0, 80) ?? 'none';
        }
      } catch (e: any) {
        result.swError = e.message;
      }
    }

    // DB subscription record (filter by current user id)
    if (currentUser) {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('endpoint, platform, device_token, created_at')
        .eq('user_id', currentUser)
        .limit(5);
      result.dbSubscriptions = data?.length ?? 0;
      result.dbSubError = error?.message;
      if (data?.[0]) {
        result.dbSubEndpoint = data[0].endpoint?.substring(0, 80);
        result.dbSubPlatform = data[0].platform;
        result.dbSubCreated = data[0].created_at;
      }
    }

    // Last notifications
    if (currentUser) {
      const { data } = await supabase
        .from('notifications')
        .select('id, is_read, created_at, activity_log(member_name, action, description)')
        .eq('user_id', currentUser)
        .order('created_at', { ascending: false })
        .limit(5);
      result.recentNotifications = data ?? [];
      result.unreadCount = data?.filter((n: any) => !n.is_read).length ?? 0;
    }

    setInfo(result);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { gather(); }, []);

  const rows: { label: string; value: any; ok?: boolean | null }[] = [
    { label: 'Current User', value: info.currentUser ?? 'Not set', ok: !!info.currentUser },
    { label: 'Standalone (Home Screen)', value: String(info.standalone), ok: info.standalone === true },
    { label: 'Service Worker', value: info.swSupported ? 'Supported' : 'Not supported', ok: info.swSupported },
    { label: 'SW Registered', value: String(info.swRegistered), ok: info.swRegistered },
    { label: 'SW State', value: info.swState ?? '—' },
    { label: 'Push Manager', value: info.pushSupported ? 'Supported' : 'Not supported', ok: info.pushSupported },
    { label: 'Notification API', value: info.notifSupported ? 'Supported' : 'Not supported', ok: info.notifSupported },
    { label: 'Permission', value: info.notifPermission, ok: info.notifPermission === 'granted' },
    { label: 'Push Subscribed', value: String(info.pushSubscribed), ok: info.pushSubscribed },
    { label: 'Badge API', value: info.badgeSupported ? 'Supported' : 'Not supported', ok: info.badgeSupported },
    { label: 'DB Subscriptions', value: String(info.dbSubscriptions ?? '—'), ok: (info.dbSubscriptions ?? 0) > 0 },
    { label: 'DB Sub Platform', value: info.dbSubPlatform ?? '—' },
    { label: 'Unread Count', value: String(info.unreadCount ?? 0) },
  ];

  const sendTestPush = async () => {
    if (!profile?.family_id) {
      toast.error('You must be in a family to test push.');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-push', {
        body: {
          title: '🔔 Test push',
          body: 'If you see this on your lock screen, push notifications are working!',
          family_id: profile.family_id,
        },
      });
      if (error) throw error;
      toast.success('Test push sent. Lock your phone to see the banner.');
    } catch (e: any) {
      toast.error(`Send failed: ${e?.message ?? String(e)}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Push Diagnostics</h1>
          <Button variant="outline" size="sm" onClick={gather} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-5 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Send test push to my family</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Sends a real push to every device subscribed in your family (including yours, if registered). Lock your phone first to see if the banner appears.
            </p>
            <Button onClick={sendTestPush} disabled={sending} className="w-full">
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {sending ? 'Sending…' : 'Send test push'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold">APNs Registration Logs</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={triggerRegistration}
                disabled={registering || !currentUser || !profile?.family_id}
              >
                <Bell className={`w-3.5 h-3.5 mr-1.5 ${registering ? 'animate-pulse' : ''}`} />
                {registering ? 'Registering…' : 'Trigger'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { clearNativePushLogs(); setPushLogs([]); }}
                disabled={pushLogs.length === 0}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Live log of every step in the native push registration flow. Tap <span className="font-semibold">Trigger</span> to start a registration attempt and watch the steps below in real time.
            </p>
            {pushLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-4 text-center">
                No log entries yet. Tap "Trigger" to start a registration attempt.
              </p>
            ) : (
              <div className="bg-muted/30 rounded-md border border-border max-h-96 overflow-y-auto">
                {[...pushLogs].reverse().map((entry) => {
                  const color =
                    entry.level === 'error'
                      ? 'text-destructive'
                      : entry.level === 'warn'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-foreground';
                  return (
                    <div
                      key={entry.id}
                      className="px-3 py-2 border-b border-border last:border-0 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-muted-foreground/70 text-[10px]">
                          {new Date(entry.at).toLocaleTimeString(undefined, { hour12: false })}
                        </span>
                        {entry.attemptId !== null && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                            #{entry.attemptId}
                          </Badge>
                        )}
                        <Badge
                          variant={entry.level === 'error' ? 'destructive' : 'outline'}
                          className="text-[9px] px-1.5 py-0 h-4 uppercase"
                        >
                          {entry.level}
                        </Badge>
                      </div>
                      <p className={`${color} font-medium break-words`}>{entry.step}</p>
                      {entry.details && Object.keys(entry.details).length > 0 && (
                        <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap break-all">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span className="text-muted-foreground">{r.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-foreground truncate max-w-[200px]">{String(r.value)}</span>
                  {r.ok !== undefined && <StatusIcon ok={r.ok ?? null} />}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {info.pushEndpoint && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Push Endpoint</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs font-mono text-muted-foreground break-all">{info.pushEndpoint}…</p>
            </CardContent>
          </Card>
        )}

        {info.recentNotifications?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Recent Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {info.recentNotifications.map((n: any) => (
                <div key={n.id} className="flex items-start gap-2 text-xs py-2 border-b border-border last:border-0">
                  <Badge variant={n.is_read ? 'secondary' : 'default'} className="text-[10px] shrink-0 mt-0.5">
                    {n.is_read ? 'read' : 'unread'}
                  </Badge>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {n.activity_log?.member_name} {n.activity_log?.action}
                    </p>
                    <p className="text-muted-foreground truncate">{n.activity_log?.description}</p>
                    <p className="text-muted-foreground/60 mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {info.swError && (
          <Card className="border-destructive">
            <CardContent className="pt-4">
              <p className="text-sm text-destructive font-medium">SW Error: {info.swError}</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
