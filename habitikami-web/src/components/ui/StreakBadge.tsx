import { Flame } from 'lucide-react';
import { cn } from '../../lib/utils';
import { streakTone } from '../../utils/milestones';
import { useTranslation } from '../../i18n';

interface Props {
    streak: number;
    best?: number;
    size?: 'sm' | 'md' | 'lg';
    /** Render even when the streak is 0 (greyed). */
    showZero?: boolean;
    className?: string;
}

const TONE_CLASSES = {
    none: 'text-muted-foreground/70 bg-muted/40',
    warm: 'text-amber-400 bg-amber-500/15',
    hot: 'text-orange-400 bg-orange-500/15',
    legend: 'text-fuchsia-400 bg-fuchsia-500/15',
};

/** Compact "🔥 N" chip for a habit's current streak. */
export function StreakBadge({ streak, best, size = 'sm', showZero = false, className }: Props) {
    const { t } = useTranslation();
    if (streak <= 0 && !showZero) return null;
    const tone = TONE_CLASSES[streakTone(streak)];
    const title = best !== undefined
        ? `${t('statsCurrentStreak')}: ${streak} · ${t('statsBestStreak')}: ${best}`
        : `${t('statsCurrentStreak')}: ${streak}`;
    return (
        <span
            title={title}
            className={cn(
                'inline-flex items-center gap-0.5 rounded-full font-semibold tabular-nums leading-none',
                size === 'sm' && 'px-1.5 py-0.5 text-[10px]',
                size === 'md' && 'px-2 py-1 text-xs',
                size === 'lg' && 'px-3 py-1.5 text-sm',
                tone,
                className,
            )}
        >
            <Flame className={cn(size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
            {streak}
        </span>
    );
}
