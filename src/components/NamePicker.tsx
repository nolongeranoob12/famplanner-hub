import { familyMembers, memberAvatars } from '@/lib/activities';
import { Users } from 'lucide-react';
import { motion } from 'framer-motion';

interface NamePickerProps {
  onSelect: (name: string) => void;
}

export function NamePicker({ onSelect }: NamePickerProps) {
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
            const avatar = memberAvatars[name];
            return (
              <motion.button
                key={name}
                onClick={() => onSelect(name)}
                className="flex flex-col items-center gap-2.5 p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all duration-200 active:scale-[0.97]"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.06, duration: 0.35 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${avatar.color} shadow-sm`}>
                  {avatar.emoji}
                </div>
                <span className="font-semibold text-foreground text-sm">{name}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
