import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export function RequireAuth({ children, requireFamily = true }: { children: ReactNode; requireFamily?: boolean }) {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
    if (requireFamily && profile && !profile.family_id) {
      navigate('/onboarding', { replace: true });
    }
  }, [user, profile, loading, requireFamily, navigate]);

  if (loading || !user || (requireFamily && !profile?.family_id)) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
