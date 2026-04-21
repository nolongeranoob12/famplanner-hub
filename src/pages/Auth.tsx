import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Enter your email first');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Check your email for a reset link');
    setForgotMode(false);
  };

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true });
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Welcome back!');
    navigate('/', { replace: true });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: displayName.trim() },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Account created! Setting up your family…');
    navigate('/onboarding', { replace: true });
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
          <motion.div
            className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-5 shadow-lg"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 15 }}
          >
            <Users className="w-7 h-7 text-primary-foreground" />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Family Board</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Sign in or create an account to get started</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'signin' | 'signup')}>
          <TabsList className="grid grid-cols-2 w-full rounded-xl">
            <TabsTrigger value="signin" className="rounded-lg">Sign in</TabsTrigger>
            <TabsTrigger value="signup" className="rounded-lg">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-5">
            {forgotMode ? (
              <form onSubmit={handleForgot} className="space-y-3">
                <p className="text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
                <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl h-11" />
                <Button type="submit" disabled={busy} className="w-full rounded-xl h-11 font-semibold">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send reset link'}
                </Button>
                <button type="button" onClick={() => setForgotMode(false)} className="w-full text-xs text-muted-foreground hover:text-foreground pt-1">
                  Back to sign in
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignIn} className="space-y-3">
                <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl h-11" />
                <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl h-11" />
                <Button type="submit" disabled={busy} className="w-full rounded-xl h-11 font-semibold">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
                </Button>
                <button type="button" onClick={() => setForgotMode(true)} className="w-full text-xs text-muted-foreground hover:text-foreground pt-1">
                  Forgot password?
                </button>
              </form>
            )}
          </TabsContent>

          <TabsContent value="signup" className="mt-5">
            <form onSubmit={handleSignUp} className="space-y-3">
              <Input placeholder="Your name (e.g. Mom)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={40} className="rounded-xl h-11" />
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl h-11" />
              <Input type="password" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-xl h-11" />
              <Button type="submit" disabled={busy} className="w-full rounded-xl h-11 font-semibold">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create account'}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center pt-1">
                After signing up, you'll create a family or join one with an invite code.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
