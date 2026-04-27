import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function StatusIcon({ ok }: { ok: boolean | null }) {
  if (ok === null) return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
  return ok ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-destructive" />;
}

export default function Debug() {
  const navigate = useNavigate();
  const currentUser = null; // legacy: identity now via auth
  const [info, setInfo] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

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

    // DB subscription record
    if (currentUser) {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('endpoint, created_at')
        .eq('member_name', currentUser)
        .limit(5);
      result.dbSubscriptions = data?.length ?? 0;
      result.dbSubError = error?.message;
      if (data?.[0]) {
        result.dbSubEndpoint = data[0].endpoint?.substring(0, 80);
        result.dbSubCreated = data[0].created_at;
      }
    }

    // Last notifications
    if (currentUser) {
      const { data } = await supabase
        .from('notifications')
        .select('id, is_read, created_at, activity_log(member_name, action, description)')
        .eq('member_name', currentUser)
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
    { label: 'Unread Count', value: String(info.unreadCount ?? 0) },
  ];

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
