import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  if (!Capacitor.isNativePlatform()) return null;
  if (subscribed === true) return null;
  if (dismissed) return null;

  const handleEnable = async () => {
    setBusy(true);
    const result = await onEnable();
    setBusy(false);
    if (result.ok) {
      toast.success('Notifications enabled — you’ll get banners on your lock screen.');
    } else if (result.reason === 'blocked') {
      toast.error('Notifications blocked. Open iOS Settings → famplanner-hub → Notifications → Allow.');
    } else if (result.reason === 'register-timeout') {
      toast.error('iOS didn’t return a push token. Push Notifications capability may be missing in Xcode.');
    } else {
      toast.error(result.detail ?? 'Could not enable notifications.');
    }
  };

  return (
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
  );
}
