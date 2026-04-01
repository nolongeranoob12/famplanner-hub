import { useState, useEffect } from 'react';
import { getMemberPhone, setMemberPhone } from '@/lib/activities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, Check, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface PhoneSettingsProps {
  currentUser: string;
}

export function PhoneSettings({ currentUser }: PhoneSettingsProps) {
  const [phone, setPhone] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMemberPhone(currentUser).then((p) => {
      setPhone(p);
      if (!p) setEditing(true);
    });
  }, [currentUser]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setMemberPhone(currentUser, phone.trim());
      toast.success('Phone number saved!');
      setEditing(false);
    } catch {
      toast.error('Failed to save phone number');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-xl hover:bg-muted"
      >
        <Phone className="w-3.5 h-3.5" />
        {phone ? phone : 'Add your phone number'}
        <Pencil className="w-3 h-3" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="tel"
        placeholder="+65 9123 4567"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="h-8 rounded-xl text-sm w-40 border-border"
      />
      <Button
        size="icon"
        className="h-8 w-8 rounded-xl"
        disabled={saving}
        onClick={handleSave}
      >
        <Check className="w-4 h-4" />
      </Button>
    </div>
  );
}
