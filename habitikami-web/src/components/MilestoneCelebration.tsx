import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { useTranslation } from '../i18n';
import { takeNewMilestones } from '../utils/milestones';
import type { StreakStats } from '../utils/streaks';

interface Props {
    streaks: Record<string, StreakStats>;
}

const PARTICLES = Array.from({ length: 14 }, (_, i) => i);

/**
 * Watches the streaks and shows a one-off celebration card when a habit
 * reaches 7, 30 or 100 consecutive days (remembered per device).
 */
export function MilestoneCelebration({ streaks }: Props) {
    const { t } = useTranslation();
    const [queue, setQueue] = useState<{ habit: string; milestone: number }[]>([]);

    useEffect(() => {
        if (Object.keys(streaks).length === 0) return;
        const fresh = takeNewMilestones(streaks);
        if (fresh.length === 0) return;
        // Deferred so the state update is not synchronous inside the effect
        const id = setTimeout(() => setQueue(q => [...q, ...fresh]), 0);
        return () => clearTimeout(id);
    }, [streaks]);

    const current = queue[0];
    useEffect(() => {
        if (!current) return;
        const id = setTimeout(() => setQueue(q => q.slice(1)), 4500);
        return () => clearTimeout(id);
    }, [current]);

    return (
        <AnimatePresence>
            {current && (
                <motion.div
                    key={`${current.habit}:${current.milestone}`}
                    initial={{ opacity: 0, y: 40, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                    onClick={() => setQueue(q => q.slice(1))}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] cursor-pointer"
                    role="status"
                >
                    <div className="relative overflow-hidden rounded-2xl border border-amber-400/40 bg-card shadow-2xl px-6 py-4 flex items-center gap-4 min-w-[260px]">
                        {PARTICLES.map(i => (
                            <motion.span
                                key={i}
                                className="absolute w-1.5 h-1.5 rounded-full bg-amber-400"
                                initial={{ opacity: 1, x: 0, y: 0, left: '50%', top: '50%' }}
                                animate={{
                                    opacity: 0,
                                    x: Math.cos((i / PARTICLES.length) * Math.PI * 2) * 120,
                                    y: Math.sin((i / PARTICLES.length) * Math.PI * 2) * 70,
                                }}
                                transition={{ duration: 1.2, ease: 'easeOut' }}
                            />
                        ))}
                        <motion.div
                            animate={{ scale: [1, 1.25, 1], rotate: [0, -8, 8, 0] }}
                            transition={{ duration: 0.9, repeat: 2 }}
                            className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0"
                        >
                            <Flame className="w-7 h-7 text-amber-400" />
                        </motion.div>
                        <div className="text-left">
                            <div className="text-xs uppercase tracking-wide text-amber-400 font-semibold">{t('milestoneTitle')}</div>
                            <div className="font-bold text-foreground">{current.habit}</div>
                            <div className="text-sm text-muted-foreground">
                                {t('milestoneMessage').replace('{days}', String(current.milestone))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
