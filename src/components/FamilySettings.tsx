import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Copy, RefreshCw, Loader2, LogOut, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { type Family, getMyFamily, regenerateInviteCode, renameFamily, isFamilyOwner, removeFamilyMember } from '@/lib/families';
import { updateMyProfile, getFamilyProfiles, getDisplayAvatar, type Profile } from '@/lib/profiles';
import { useAuth } from '@/contexts/AuthContext';
import { MemberAvatar } from '@/components/MemberAvatar';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function FamilySettings() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [family, setFamily] = useState<Family | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<Profile[]>([]);

  const loadMembers = async () => {
    const map = await getFamilyProfiles();
    setMembers(Object.values(map).sort((a, b) => a.display_name.localeCompare(b.display_name)));
  };

  useEffect(() => {
    if (!open) return;
    getMyFamily().then((f) => {
      setFamily(f);
      setFamilyName(f?.name ?? '');
      if (f && user) isFamilyOwner(f.id, user.id).then(setIsOwner);
      if (f) loadMembers();
    });
    setDisplayName(profile?.display_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [open, user, profile]);

  const handleRemoveMember = async (memberId: string, name: string) => {
    setBusy(true);
    try {
      await removeFamilyMember(memberId);
      toast.success(`${name} removed from family`);
      await loadMembers();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = () => {
    if (!family) return;
    navigator.clipboard.writeText(family.invite_code);
    toast.success('Invite code copied!');
  };

  const handleRegen = async () => {
    if (!family) return;
    setBusy(true);
    try {
      const code = await regenerateInviteCode(family.id);
      setFamily({ ...family, invite_code: code });
      toast.success('New invite code generated');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = async () => {
    setBusy(true);
    try {
      await updateMyProfile({ display_name: displayName.trim(), phone: phone.trim() || null });
      await refreshProfile();
      toast.success('Profile updated');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRenameFamily = async () => {
    if (!family || !isOwner) return;
    setBusy(true);
    try {
      await renameFamily(family.id, familyName.trim());
      toast.success('Family renamed');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8 text-muted-foreground hover:text-foreground">
          <Settings className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Profile */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your profile</h3>
            <div className="space-y-2">
              <Label htmlFor="display-name">Display name</Label>
              <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" type="tel" placeholder="+65 9123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-lg" />
              <p className="text-[11px] text-muted-foreground">Visible only to other members of your family.</p>
            </div>
            <Button size="sm" onClick={handleSaveProfile} disabled={busy} className="rounded-lg">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save profile'}
            </Button>
          </section>

          {/* Family */}
          {family && (
            <section className="space-y-3 pt-4 border-t">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Family</h3>
              <div className="space-y-2">
                <Label>Family name</Label>
                {isOwner ? (
                  <div className="flex gap-2">
                    <Input value={familyName} onChange={(e) => setFamilyName(e.target.value)} maxLength={50} className="rounded-lg" />
                    <Button size="sm" onClick={handleRenameFamily} disabled={busy || familyName === family.name} className="rounded-lg">Save</Button>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-foreground">{family.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Invite code</Label>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                  <span className="text-2xl font-bold tracking-[0.3em] flex-1 text-center">{family.invite_code}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopy} className="rounded-lg flex-1">
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
                  </Button>
                  {isOwner && (
                    <Button size="sm" variant="outline" onClick={handleRegen} disabled={busy} className="rounded-lg flex-1">
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> New code
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">Share this code with family members so they can join.</p>
              </div>
            </section>
          )}

          <section className="pt-4 border-t">
            <Button variant="outline" onClick={() => { signOut(); setOpen(false); }} className="w-full rounded-lg text-destructive hover:text-destructive">
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
