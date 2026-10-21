import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { useTranslation } from '../../i18n';
import { useHabitRows } from '../../hooks/useHabitRows';
import { useMoodEntries } from '../../hooks/useMood';
import { useHabitMeta } from '../../hooks/useHabitMutations';
import { targetsOf } from '../../utils/habitMeta';
import { moodHabitEffects, MOOD_MIN_DAYS_PER_SIDE } from '../../utils/moodCorrelation';
import { Skeleton } from '../ui/Skeleton';

/** Mood on days with vs without each habit, as diverging bars (issue #5). */
export function MoodHabitCorrelation() {
    const { t } = useTranslation();
    const { rows, isLoading } = useHabitRows(6);
    const { data: mood, isLoading: moodLoading } = useMoodEntries();
    const { data: habitMeta } = useHabitMeta();

    const effects = useMemo(() => moodHabitEffects(rows, mood ?? [], targetsOf(habitMeta)), [rows, mood, habitMeta]);
    const fmt = (s: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), s);
    const good = effects.filter(e => e.delta > 0).slice(0, 3);

    if (isLoading || moodLoading) return <Skeleton className="h-48 w-full rounded-xl" />;
    if (effects.length === 0) {
        return <p className="text-sm text-muted-foreground">{fmt(t('moodHabitsEmpty'), { days: MOOD_MIN_DAYS_PER_SIDE })}</p>;
    }

    const maxAbs = Math.max(10, ...effects.map(e => Math.abs(e.delta)));
    return (
        <div className="space-y-4">
            <p className="text-xs text-muted-foreground">{t('moodHabitsHint')}</p>
            <div style={{ height: `${Math.max(160, effects.length * 34)}px` }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={effects} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }} barSize={18}>
                        <XAxis type="number" domain={[-maxAbs, maxAbs]} stroke="#888" tick={{ fontSize: 10 }} tickFormatter={(v: number) => (v > 0 ? `+${v}` : String(v))} />
                        <YAxis type="category" dataKey="habit" width={110} stroke="#888" tick={{ fontSize: 11 }} />
                        <ReferenceLine x={0} stroke="#666" />
                        <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const e = payload[0].payload as typeof effects[number];
                                return (
                                    <div style={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f3f4f6' }}>
                                        <strong>{e.habit}</strong>
                                        <div>{fmt(t('moodHabitsDone'), { mood: e.moodDone, days: e.daysDone })}</div>
                                        <div>{fmt(t('moodHabitsNotDone'), { mood: e.moodNotDone, days: e.daysNotDone })}</div>
                                    </div>
                                );
                            }}
                        />
                        <Bar dataKey="delta" radius={4}>
                            {effects.map(e => <Cell key={e.habit} fill={e.delta >= 0 ? '#10b981' : '#f43f5e'} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {good.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold mb-1">{t('moodHabitsTopTitle')}</h3>
                    <ul className="space-y-1">
                        {good.map((e, i) => (
                            <li key={e.habit} className="text-sm flex items-center gap-2">
                                <span className="text-base">{['🥇', '🥈', '🥉'][i]}</span>
                                <span>{e.habit}</span>
                                <span className="text-xs text-emerald-400 font-medium">+{e.delta} {t('moodHabitsPoints')}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
