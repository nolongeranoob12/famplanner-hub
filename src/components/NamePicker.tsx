import { familyMembers, memberAvatars } from '@/lib/activities';

interface NamePickerProps {
  onSelect: (name: string) => void;
}

export function NamePicker({ onSelect }: NamePickerProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center space-y-8 max-w-sm w-full">
        <div>
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">👨‍👩‍👧‍👦</span>
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Who's here?</h1>
          <p className="text-sm text-muted-foreground mt-1">Tap your name to continue</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {familyMembers.map((name) => {
            const avatar = memberAvatars[name];
            return (
              <button
                key={name}
                onClick={() => onSelect(name)}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] shadow-sm"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${avatar.color} shadow-md`}>
                  {avatar.emoji}
                </div>
                <span className="font-bold text-foreground text-sm">{name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
