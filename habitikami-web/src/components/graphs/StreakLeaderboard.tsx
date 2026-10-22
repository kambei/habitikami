import { Flame, Trophy } from 'lucide-react';
import { useTranslation } from '../../i18n';
import type { StreakStats } from '../../utils/streaks';
import { StreakBadge } from '../ui/StreakBadge';
import { ShareButton } from '../ui/ShareButton';

interface Props {
    streaks: Record<string, StreakStats>;
    colors: Record<string, string>;
}

/** Habits ranked by best streak, with the current one next to it. */
export function StreakLeaderboard({ streaks, colors }: Props) {
    const { t, locale } = useTranslation();
    const rows = Object.entries(streaks)
        .map(([habit, s]) => ({ habit, ...s }))
        .filter(r => r.bestStreak > 0)
        .sort((a, b) => b.bestStreak - a.bestStreak || b.currentStreak - a.currentStreak);

    if (rows.length === 0) {
        return <p className="text-sm text-muted-foreground">{t('graphsStreaksEmpty')}</p>;
    }
    const max = rows[0].bestStreak;

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-[10px] uppercase tracking-wide text-muted-foreground px-1">
                <span />
                <span className="flex items-center gap-1"><Flame className="w-3 h-3" />{t('graphsStreakCurrent')}</span>
                <span className="flex items-center gap-1"><Trophy className="w-3 h-3" />{t('graphsStreakBest')}</span>
                <span />
            </div>
            {rows.map(r => (
                <div key={r.habit} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center px-1">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[r.habit] || '#6b7280' }} />
                            <span className="truncate">{r.habit}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted/50 mt-1 overflow-hidden">
                            <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.max(4, (r.bestStreak / max) * 100)}%`, backgroundColor: colors[r.habit] || '#6b7280' }}
                            />
                        </div>
                    </div>
                    <StreakBadge streak={r.currentStreak} size="md" showZero />
                    <span className="text-sm font-semibold tabular-nums text-muted-foreground w-10 text-right">{r.bestStreak}</span>
                    <ShareButton
                        fileName={`habitikami-streak-${r.habit.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`}
                        spec={() => ({ template: 'streak', title: t('shareStreakTitle'), habit: r.habit, days: r.currentStreak || r.bestStreak, daysLabel: t('shareStreakDays'), footer: new Date().toLocaleDateString(locale), color: colors[r.habit] })}
                    />
                </div>
            ))}
        </div>
    );
}
