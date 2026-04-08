import { Skeleton } from '@/components/ui/skeleton';

export function ActivityCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex items-center gap-3 pt-1">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-20" />
            </div>
            <div className="flex items-center gap-1.5 pt-0.5">
              <Skeleton className="h-7 w-12 rounded-lg" />
              <Skeleton className="h-7 w-12 rounded-lg" />
              <Skeleton className="h-7 w-12 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActivityFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ActivityCardSkeleton key={i} />
      ))}
    </div>
  );
}
