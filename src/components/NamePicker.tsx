import { familyMembers, memberAvatars } from '@/lib/activities';
import { Users } from 'lucide-react';

interface NamePickerProps {
  onSelect: (name: string) => void;
}

export function NamePicker({ onSelect }: NamePickerProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center space-y-8 max-w-sm w-full">
        <div>
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-5 shadow-lg">
            <Users className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Select your profile to continue</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {familyMembers.map((name) => {
            const avatar = memberAvatars[name];
            return (
              <button
                key={name}
                onClick={() => onSelect(name)}
                className="flex flex-col items-center gap-2.5 p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all duration-200 active:scale-[0.97]"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${avatar.color} shadow-sm`}>
                  {avatar.emoji}
                </div>
                <span className="font-semibold text-foreground text-sm">{name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
