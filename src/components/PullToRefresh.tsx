import { useState, useRef, useCallback, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 80;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);
  const pullY = useMotionValue(0);
  const opacity = useTransform(pullY, [0, THRESHOLD], [0, 1]);
  const scale = useTransform(pullY, [0, THRESHOLD], [0.5, 1]);
  const rotate = useTransform(pullY, [0, THRESHOLD * 2], [0, 360]);

  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    const scrollTop = containerRef.current?.scrollTop ?? window.scrollY;
    if (scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
    }
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null || refreshing) return;
    const delta = Math.max(0, e.touches[0].clientY - startY.current);
    // Dampen the pull
    pullY.set(delta * 0.5);
  }, [refreshing, pullY]);

  const handleTouchEnd = useCallback(async () => {
    if (startY.current === null) return;
    startY.current = null;

    if (pullY.get() >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      animate(pullY, THRESHOLD * 0.6, { duration: 0.2 });
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        animate(pullY, 0, { duration: 0.3 });
      }
    } else {
      animate(pullY, 0, { duration: 0.3 });
    }
  }, [onRefresh, refreshing, pullY]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      <motion.div
        className="absolute left-0 right-0 flex justify-center z-20 pointer-events-none"
        style={{ top: -40, y: pullY }}
      >
        <motion.div
          className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center"
          style={{ opacity, scale }}
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          ) : (
            <motion.span className="text-sm" style={{ rotate }}>↓</motion.span>
          )}
        </motion.div>
      </motion.div>

      <motion.div style={{ y: pullY }}>
        {children}
      </motion.div>
    </div>
  );
}
