import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { uploadMemberAvatar, setMemberAvatar } from '@/lib/activities';
import { Camera, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const emojiOptions = [
  '👨', '👩', '😎', '🦊', '🐻', '🌸', '🐱', '🐶', '🦁', '🐼',
  '🦄', '🐲', '🎃', '👻', '🤖', '🧑‍🚀', '🧙', '🥷', '🧑‍🎨', '🦸',
  '🌞', '🌈', '⭐', '🔥', '💎', '🎯', '🚀', '🎸', '🎮', '🏀',
];

interface AvatarEditorProps {
  open: boolean;
  onClose: () => void;
  memberName: string;
  currentEmoji: string;
  currentColor: string;
  currentAvatarUrl?: string;
  onSaved: () => void;
}

export function AvatarEditor({ open, onClose, memberName, currentEmoji, currentColor, currentAvatarUrl, onSaved }: AvatarEditorProps) {
  const [selectedEmoji, setSelectedEmoji] = useState(currentEmoji);
  const [photoUrl, setPhotoUrl] = useState(currentAvatarUrl || '');
  const [photoPreview, setPhotoPreview] = useState(currentAvatarUrl || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'emoji' | 'photo'>(currentAvatarUrl ? 'photo' : 'emoji');
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setUploading(true);
    setPhotoPreview(URL.createObjectURL(file));
    try {
      const url = await uploadMemberAvatar(file);
      setPhotoUrl(url);
      setMode('photo');
    } catch {
      toast.error('Failed to upload photo');
      setPhotoPreview('');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === 'photo' && photoUrl) {
        await setMemberAvatar(memberName, undefined, photoUrl);
      } else {
        await setMemberAvatar(memberName, selectedEmoji, undefined);
      }
      toast.success('Avatar updated!');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to save avatar');
    } finally {
      setSaving(false);
    }
  };

  const clearPhoto = () => {
    setPhotoUrl('');
    setPhotoPreview('');
    setMode('emoji');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Choose your avatar</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div className="flex justify-center">
            {mode === 'photo' && photoPreview ? (
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <button onClick={clearPhoto} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className={cn('w-20 h-20 rounded-2xl flex items-center justify-center text-3xl shadow-lg', currentColor)}>
                {selectedEmoji}
              </div>
            )}
          </div>

          {/* Photo upload */}
          <div className="flex justify-center">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
              {uploading ? 'Uploading…' : 'Upload photo'}
            </Button>
          </div>

          {/* Emoji grid */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 text-center">Or pick an emoji</p>
            <div className="grid grid-cols-6 gap-2">
              {emojiOptions.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { setSelectedEmoji(emoji); setMode('emoji'); }}
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all',
                    'hover:bg-primary/10 active:scale-90',
                    mode === 'emoji' && selectedEmoji === emoji
                      ? 'bg-primary/15 ring-2 ring-primary scale-110'
                      : 'bg-secondary/50'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full rounded-lg">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Avatar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
