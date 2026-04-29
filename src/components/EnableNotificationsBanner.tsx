import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { NativePushResult } from '@/hooks/useNativePush';

interface Props {
  subscribed: boolean | null;
  onEnable: () => Promise<NativePushResult>;
  lastError: string | null;
}

/**
 * Native-only banner that appears on the home screen when push is not yet
 * subscribed. Lets the user retry registration (or, if blocked, see the
 * exact reason so they can fix iOS Settings / Xcode capability).
 */
export function EnableNotificationsBanner({ subscribed, onEnable, lastError }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || subscribed === true) return;
    if (localStorage.getItem('native-push-permission-intro-seen') === 'true') return;
    const timer = window.setTimeout(() => setPromptOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [subscribed]);

  if (!Capacitor.isNativePlatform()) return null;
  if (subscribed === true) return null;
  if (dismissed) return null;

  const handleEnable = async () => {
    setBusy(true);
    const result = await onEnable();
    setBusy(false);
    if (result.ok === true) {
      localStorage.setItem('native-push-permission-intro-seen', 'true');
      setPromptOpen(false);
      toast.success('Notifications enabled — you’ll get banners on your lock screen.');
      return;
    }
    localStorage.setItem('native-push-permission-intro-seen', 'true');
    const r = result as Exclude<NativePushResult, { ok: true }>;
    if (r.reason === 'blocked') {
      toast.error('Notifications blocked. Open iOS Settings → famplanner-hub → Notifications → Allow.');
    } else if (r.reason === 'register-timeout') {
      toast.error('iOS didn’t return a push token. Push Notifications capability may be missing in Xcode.');
    } else {
      toast.error(r.detail ?? 'Could not enable notifications.');
    }
  };

  return (
    <>
      <Dialog open={promptOpen} onOpenChange={(open) => {
        setPromptOpen(open);
        if (!open) localStorage.setItem('native-push-permission-intro-seen', 'true');
      }}>
        <DialogContent className="w-[calc(100vw-2rem)] rounded-2xl">
          <DialogHeader>
            <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center mb-1">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle>Stay updated instantly</DialogTitle>
            <DialogDescription>
              Allow notifications so your iPhone can show a lock-screen banner and play a sound when family posts or edits an activity, even if the app is closed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button onClick={handleEnable} disabled={busy} className="w-full rounded-xl">
              {busy ? 'Asking iOS…' : 'Continue'}
            </Button>
            <Button variant="ghost" onClick={() => setPromptOpen(false)} className="w-full rounded-xl">
              Not now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-2xl border border-primary/30 bg-primary/5 backdrop-blur-md px-4 py-3 flex items-start gap-3"
        >
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">
            Turn on push notifications
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            Get a banner on your lock screen the moment a family member posts or edits an activity.
          </p>
          {lastError && (
            <p className="text-[11px] text-destructive mt-1.5 leading-snug">{lastError}</p>
          )}
          <Button
            size="sm"
            className="mt-2 h-8 px-3 text-xs"
            disabled={busy}
            onClick={handleEnable}
          >
            {busy ? 'Asking iOS…' : 'Enable notifications'}
          </Button>
        </div>
        <button
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground p-1 -m-1"
        >
          <X className="w-4 h-4" />
        </button>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
