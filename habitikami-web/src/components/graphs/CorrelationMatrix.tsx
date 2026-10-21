import { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n';
import { useHabitRows } from '../../hooks/useHabitRows';
import { useHabitMeta } from '../../hooks/useHabitMutations';
import { targetsOf } from '../../utils/habitMeta';
import { habitCorrelations, correlationHabits, correlationInsights, CORRELATION_MIN_DAYS } from '../../utils/correlations';
import { Skeleton } from '../ui/Skeleton';

const WINDOWS = [1, 3, 6] as const;

function cellColor(phi: number): string {
    const a = Math.min(1, Math.abs(phi)) * 0.85 + (phi === 0 ? 0 : 0.1);
    return phi >= 0 ? `rgba(16, 185, 129, ${a})` : `rgba(244, 63, 94, ${a})`;
}

/** Habit × habit phi matrix over 1/3/6 months, plus the pairs worth a sentence (issue #4). */
export function CorrelationMatrix({ colors = {} }: { colors?: Record<string, string> }) {
    const { t } = useTranslation();
    const [months, setMonths] = useState<(typeof WINDOWS)[number]>(3);
    const { rows, isLoading } = useHabitRows(months);
    const { data: habitMeta } = useHabitMeta();

    const { habits, lookup, insights } = useMemo(() => {
        const pairs = habitCorrelations(rows, targetsOf(habitMeta));
        const lookup = new Map<string, { phi: number; days: number }>();
        for (const p of pairs) { lookup.set(`${p.a}|${p.b}`, p); lookup.set(`${p.b}|${p.a}`, p); }
        return { habits: correlationHabits(pairs), lookup, insights: correlationInsights(pairs) };
    }, [rows, habitMeta]);

    const fmt = (s: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), s);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{t('correlationsHint')}</p>
                <div className="flex gap-1">
                    {WINDOWS.map(w => (
                        <button
                            key={w}
                            type="button"
                            onClick={() => setMonths(w)}
                            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${months === w ? 'bg-primary/15 border-primary text-foreground' : 'border-border text-muted-foreground hover:bg-secondary/50'}`}
                        >
                            {fmt(t('correlationsMonths'), { n: w })}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <Skeleton className="h-48 w-full rounded-xl" />
            ) : habits.length < 2 ? (
                <p className="text-sm text-muted-foreground">{t('correlationsEmpty')}</p>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <div
                            className="grid gap-px text-[10px]"
                            style={{ gridTemplateColumns: `minmax(80px, 140px) repeat(${habits.length}, minmax(28px, 1fr))`, minWidth: `${80 + habits.length * 28}px` }}
                        >
                            <div />
                            {habits.map(h => (
                                <div key={h} className="h-20 flex items-end justify-center pb-1" title={h}>
                                    <span className="block whitespace-nowrap text-muted-foreground" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: '76px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h}</span>
                                </div>
                            ))}
                            {habits.map(a => (
                                <div key={a} className="contents">
                                    <div className="flex items-center gap-1.5 pr-2 min-w-0" title={a}>
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[a] || '#6b7280' }} />
                                        <span className="truncate">{a}</span>
                                    </div>
                                    {habits.map(b => {
                                        if (a === b) return <div key={b} className="h-7 rounded-sm bg-secondary/40" />;
                                        const p = lookup.get(`${a}|${b}`);
                                        const weak = !p || p.days < CORRELATION_MIN_DAYS;
                                        return (
                                            <div
                                                key={b}
                                                className={`h-7 rounded-sm flex items-center justify-center font-medium ${weak ? 'opacity-40' : ''}`}
                                                style={{ backgroundColor: p ? cellColor(p.phi) : 'transparent', color: p && Math.abs(p.phi) > 0.5 ? '#fff' : undefined }}
                                                title={p ? fmt(t('correlationsCell'), { a, b, phi: p.phi.toFixed(2), days: p.days }) : ''}
                                            >
                                                {p ? (p.phi >= 0 ? '+' : '−') + Math.abs(p.phi).toFixed(1).replace('0.', '.') : ''}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{t('correlationsLegend')}</p>

                    <div>
                        <h3 className="text-sm font-semibold mb-2">{t('correlationsInsightsTitle')}</h3>
                        {insights.length === 0 ? (
                            <p className="text-xs text-muted-foreground">{fmt(t('correlationsInsightsEmpty'), { days: CORRELATION_MIN_DAYS })}</p>
                        ) : (
                            <ul className="space-y-1.5">
                                {insights.slice(0, 8).map(i => (
                                    <li key={`${i.a}|${i.b}`} className="text-sm flex items-start gap-2">
                                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${i.direction === 'together' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                        <span>
                                            {fmt(t(i.direction === 'together' ? 'correlationsTogether' : 'correlationsApart'), { a: i.a, b: i.b })}
                                            <span className="text-muted-foreground text-xs"> · φ {i.phi.toFixed(2)} · {fmt(t('correlationsDays'), { days: i.days })}</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
