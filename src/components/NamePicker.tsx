import { familyMembers, memberAvatars } from '@/lib/activities';

interface NamePickerProps {
  onSelect: (name: string) => void;
}

export function NamePicker({ onSelect }: NamePickerProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center space-y-10 max-w-md w-full">
        <div className="space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-lg">
            <span className="text-3xl">👨‍👩‍👧‍👦</span>
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Select your name to continue</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {familyMembers.map((name) => {
            const avatar = memberAvatars[name];
            return (
              <button
                key={name}
                onClick={() => onSelect(name)}
                className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 active:scale-[0.98] text-left"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${avatar.color} shadow-sm`}>
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