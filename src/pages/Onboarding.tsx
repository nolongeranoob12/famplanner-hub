import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { createFamily, joinFamilyByCode } from '@/lib/families';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, KeyRound, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [familyName, setFamilyName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
    if (profile?.family_id) {
      navigate('/', { replace: true });
    }
  }, [user, profile, loading, navigate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyName.trim()) return;
    setBusy(true);
    try {
      await createFamily(familyName.trim());
      await refreshProfile();
      toast.success('Family created!');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      await joinFamilyByCode(code.trim().toUpperCase());
      await refreshProfile();
      toast.success('Joined family!');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-6 safe-pt safe-pb safe-px">
      <motion.div
        className="w-full max-w-sm space-y-5"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}!</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {mode === 'choose' ? 'Create a family or join an existing one' : mode === 'create' ? 'Name your family' : 'Enter your invite code'}
          </p>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMode('create')}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Create a new family</CardTitle>
                    <CardDescription className="text-xs mt-0.5">You'll get an invite code to share</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMode('join')}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Join an existing family</CardTitle>
                    <CardDescription className="text-xs mt-0.5">Use the 6-character invite code</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Button variant="ghost" size="sm" className="w-full text-muted-foreground mt-4" onClick={signOut}>
              <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign out
            </Button>
          </div>
        )}

        {mode === 'create' && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleCreate} className="space-y-3">
                <Input placeholder="Family name (e.g. The Smith Family)" value={familyName} onChange={(e) => setFamilyName(e.target.value)} maxLength={50} required autoFocus className="rounded-xl h-11" />
                <Button type="submit" disabled={busy} className="w-full rounded-xl h-11 font-semibold">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create family'}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setMode('choose')}>Back</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {mode === 'join' && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleJoin} className="space-y-3">
                <Input
                  placeholder="ABC123"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                  maxLength={6}
                  required
                  autoFocus
                  className="rounded-xl h-11 text-center text-lg tracking-[0.4em] font-bold uppercase"
                />
                <Button type="submit" disabled={busy || code.length !== 6} className="w-full rounded-xl h-11 font-semibold">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join family'}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setMode('choose')}>Back</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
