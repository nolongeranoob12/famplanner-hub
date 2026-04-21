import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyRound, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

function getHashParams() {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(hash);
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    const bootstrapRecoverySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (mounted) {
          setReady(true);
          setCheckingSession(false);
        }
        return;
      }

      const hashParams = getHashParams();
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      if (type === 'recovery' && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!mounted) return;

        if (!error) {
          setReady(true);
        } else {
          toast.error('This reset link is invalid or has expired. Please request a new one.');
        }
      }

      if (mounted) setCheckingSession(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'TOKEN_REFRESHED' || !!session) {
        setReady(true);
        setCheckingSession(false);
      }
    });

    void bootstrapRecoverySession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setBusy(false);
      toast.error('This reset link is invalid or expired. Please request a new one.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Password updated! You are signed in.');
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        className="w-full max-w-sm space-y-7"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-5 shadow-lg">
            <KeyRound className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Set new password</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Choose a password you'll remember this time.</p>
        </div>

        {checkingSession ? (
          <p className="text-center text-sm text-muted-foreground">Checking your reset link…</p>
        ) : !ready ? (
          <p className="text-center text-sm text-muted-foreground">
            This reset link is invalid or expired. Request a new one from the sign-in screen.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input type="password" placeholder="New password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-xl h-11" />
            <Input type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} className="rounded-xl h-11" />
            <Button type="submit" disabled={busy} className="w-full rounded-xl h-11 font-semibold">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update password'}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

