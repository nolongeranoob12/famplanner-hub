import { useState, useEffect } from 'react';
import { familyMembers, memberAvatars, getAllMemberProfiles, getDisplayAvatar, type MemberProfile } from '@/lib/activities';
import { MemberAvatar } from '@/components/MemberAvatar';
import { AvatarEditor } from '@/components/AvatarEditor';
import { Users, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';

interface NamePickerProps {
  onSelect: (name: string) => void;
}

export function NamePicker({ onSelect }: NamePickerProps) {
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});
  const [editingMember, setEditingMember] = useState<string | null>(null);

  const fetchProfiles = () => {
    getAllMemberProfiles().then(setProfiles);
  };

  useEffect(() => { fetchProfiles(); }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        className="text-center space-y-8 max-w-sm w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div>
          <motion.div
            className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-5 shadow-lg"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
          >
            <Users className="w-7 h-7 text-primary-foreground" />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Select your profile to continue</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {familyMembers.map((name, index) => {
            const display = getDisplayAvatar(name, profiles);
            return (
              <motion.div
                key={name}
                className="relative"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.06, duration: 0.35 }}
              >
                <button
                  onClick={() => onSelect(name)}
                  className="w-full flex flex-col items-center gap-2.5 p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all duration-200 active:scale-[0.97]"
                >
                  <MemberAvatar
                    emoji={display.emoji}
                    color={display.color}
                    avatarUrl={display.avatarUrl}
                    size="lg"
                  />
                  <span className="font-semibold text-foreground text-sm">{name}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingMember(name); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-secondary/80 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Edit avatar"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {editingMember && (() => {
        const display = getDisplayAvatar(editingMember, profiles);
        return (
          <AvatarEditor
            open
            onClose={() => setEditingMember(null)}
            memberName={editingMember}
            currentEmoji={display.emoji}
            currentColor={display.color}
            currentAvatarUrl={display.avatarUrl}
            onSaved={fetchProfiles}
          />
        );
      })()}
    </div>
  );
}
