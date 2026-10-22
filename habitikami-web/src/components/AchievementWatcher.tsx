import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from '../i18n';
import { useAchievements, useUnlockAchievements } from '../hooks/useAchievements';
import { newlyUnlocked } from '../utils/achievements';
import type { AchievementStatus } from '../utils/achievements';

const PARTICLES = Array.from({ length: 16 }, (_, i) => i);

/**
 * Mounted once in the dashboard: when an achievement is reached and not yet
 * in the sheet, writes it there and shows a celebration card (issue #3).
 */
export function AchievementWatcher({ onOpenTrophies }: { onOpenTrophies?: () => void }) {
    const { language } = useTranslation();
    const { t } = useTranslation();
    const { achievements, isLoaded } = useAchievements();
    const unlock = useUnlockAchievements();
    const [queue, setQueue] = useState<AchievementStatus[]>([]);
    const inFlight = useRef<Set<string>>(new Set());
    const lang = language === 'it' ? 'it' : 'en';

    useEffect(() => {
        if (!isLoaded) return;
        const fresh = newlyUnlocked(achievements).filter(id => !inFlight.current.has(id));
        if (fresh.length === 0) return;
        fresh.forEach(id => inFlight.current.add(id));
        const items = achievements.filter(a => fresh.includes(a.id));
        unlock.mutate(fresh, {
            onSuccess: () => setQueue(q => [...q, ...items]),
            onError: () => fresh.forEach(id => inFlight.current.delete(id)),
        });
        // `unlock` is a stable mutation object; re-running on it would loop
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [achievements, isLoaded]);

    const current = queue[0];
    useEffect(() => {
        if (!current) return;
        const id = setTimeout(() => setQueue(q => q.slice(1)), 5000);
        return () => clearTimeout(id);
    }, [current]);

    return (
        <AnimatePresence>
            {current && (
                <motion.div
                    key={current.id}
                    initial={{ opacity: 0, y: 40, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                    onClick={() => { setQueue(q => q.slice(1)); onOpenTrophies?.(); }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] cursor-pointer"
                    role="status"
                >
                    <div className="relative overflow-hidden rounded-2xl border border-violet-400/40 bg-card shadow-2xl px-6 py-4 flex items-center gap-4 min-w-[280px]">
                        {PARTICLES.map(i => (
                            <motion.span
                                key={i}
                                className="absolute w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: i % 2 ? '#a78bfa' : '#fbbf24' }}
                                initial={{ opacity: 1, x: 0, y: 0, left: '50%', top: '50%' }}
                                animate={{ opacity: 0, x: Math.cos((i / PARTICLES.length) * Math.PI * 2) * 130, y: Math.sin((i / PARTICLES.length) * Math.PI * 2) * 80 }}
                                transition={{ duration: 1.3, ease: 'easeOut' }}
                            />
                        ))}
                        <motion.div
                            animate={{ scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] }}
                            transition={{ duration: 0.9, repeat: 2 }}
                            className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 text-2xl"
                        >
                            {current.icon}
                        </motion.div>
                        <div className="text-left">
                            <div className="text-xs uppercase tracking-wide text-violet-400 font-semibold">{t('achievementUnlocked')}</div>
                            <div className="font-bold text-foreground">{current.title[lang]}</div>
                            <div className="text-sm text-muted-foreground">{current.description[lang]}</div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
