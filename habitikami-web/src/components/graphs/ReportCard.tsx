import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Printer, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { useTranslation } from '../../i18n';
import { useHabitRows } from '../../hooks/useHabitRows';
import { useHabitStreaks } from '../../hooks/useStreaks';
import { useMoodEntries } from '../../hooks/useMood';
import { useHabitNotes } from '../../hooks/useHabitNotes';
import { useHabitMeta } from '../../hooks/useHabitMutations';
import { habitService } from '../../services/HabitService';
import { targetsOf } from '../../utils/habitMeta';
import { buildReport, type ReportPeriod } from '../../utils/report';
import { buildCsv, downloadText, exportFileName } from '../../utils/exportCsv';
import type { CounterData } from '../../types';
import { Skeleton } from '../ui/Skeleton';
import { ShareButton } from '../ui/ShareButton';

function Delta({ value, suffix = '' }: { value: number | null; suffix?: string }) {
    if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
    const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
    const tone = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-rose-400' : 'text-muted-foreground';
    return <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${tone}`}><Icon className="w-3 h-3" />{value > 0 ? '+' : ''}{value}{suffix}</span>;
}

/**
 * Weekly / monthly report built on the fly (issue #6) with CSV export and
 * print-to-PDF of the card itself (issue #18).
 */
export function ReportCard({ colors = {} }: { colors?: Record<string, string> }) {
    const { t, locale } = useTranslation();
    const [period, setPeriod] = useState<ReportPeriod>('week');
    const { rows, isLoading } = useHabitRows(3);
    const { streaks } = useHabitStreaks();
    const { data: mood } = useMoodEntries();
    const { data: notes } = useHabitNotes();
    const { data: habitMeta } = useHabitMeta();
    const { data: counters } = useQuery({
        queryKey: ['counters', 'all'],
        staleTime: 1000 * 60 * 5,
        queryFn: async (): Promise<CounterData[]> => {
            const res = await habitService.getCounters();
            return Array.isArray(res) ? res : [];
        },
    });

    const report = useMemo(
        () => buildReport(period, rows, { targets: targetsOf(habitMeta), counters: counters ?? [], mood: mood ?? [] }),
        [period, rows, habitMeta, counters, mood],
    );
    const activeStreaks = useMemo(
        () => Object.entries(streaks).filter(([, s]) => s.currentStreak > 0).sort((a, b) => b[1].currentStreak - a[1].currentStreak).slice(0, 5),
        [streaks],
    );
    const fmtDate = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    const fmt = (s: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), s);

    const exportCsv = () => {
        const csv = buildCsv({ habits: rows, counters: counters ?? [], notes: Object.values(notes ?? {}), mood: mood ?? [] }, report.from, report.to);
        downloadText(csv, exportFileName(report.from, report.to, 'csv'));
    };

    if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

    return (
        <div className="print-area space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div className="flex gap-1">
                    {(['week', 'month'] as ReportPeriod[]).map(p => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1 rounded-md text-xs border transition-colors ${period === p ? 'bg-primary/15 border-primary text-foreground' : 'border-border text-muted-foreground hover:bg-secondary/50'}`}
                        >
                            {t(p === 'week' ? 'reportWeek' : 'reportMonth')}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-xs font-medium">
                        <Download className="w-3.5 h-3.5" /> {t('reportExportCsv')}
                    </button>
                    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-xs font-medium">
                        <Printer className="w-3.5 h-3.5" /> {t('reportExportPdf')}
                    </button>
                    <ShareButton
                        label
                        fileName={`habitikami-${period}.png`}
                        spec={() => ({ template: 'rate', title: t('shareRateTitle'), rate: report.rate, periodLabel: t(period === 'week' ? 'shareRateWeek' : 'shareRateMonth'), subtitle: t('shareRateSubtitle').replace('{n}', String(report.habits.length)), footer: `${fmtDate(report.from)} – ${fmtDate(report.to)}` })}
                    />
                </div>
            </div>

            <div>
                <h3 className="text-base font-semibold">{t(period === 'week' ? 'reportTitleWeek' : 'reportTitleMonth')}</h3>
                <p className="text-xs text-muted-foreground">{fmtDate(report.from)} – {fmtDate(report.to)} · {fmt(t('reportVsPrevious'), { from: fmtDate(report.prevFrom), to: fmtDate(report.prevTo) })}</p>
            </div>

            {report.daysTracked === 0 ? (
                <p className="text-sm text-muted-foreground">{t('reportEmpty')}</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-border bg-background/30 p-3 text-center">
                            <div className="text-2xl font-bold text-primary">{report.rate}%</div>
                            <div className="text-[11px] text-muted-foreground">{t('reportCompletion')}</div>
                            <Delta value={report.prevRate === null ? null : report.rate - report.prevRate} suffix=" pt" />
                        </div>
                        <div className="rounded-xl border border-border bg-background/30 p-3 text-center">
                            <div className="text-2xl font-bold text-emerald-400">{report.daysTracked}</div>
                            <div className="text-[11px] text-muted-foreground">{t('reportDaysTracked')}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-background/30 p-3 text-center">
                            <div className="text-2xl font-bold text-amber-400">{activeStreaks.length}</div>
                            <div className="text-[11px] text-muted-foreground">{t('reportActiveStreaks')}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-background/30 p-3 text-center">
                            <div className="text-2xl font-bold text-sky-400">{report.mood ? report.mood.avg : '—'}</div>
                            <div className="text-[11px] text-muted-foreground">{t('reportMood')}</div>
                            {report.mood && <Delta value={report.mood.prevAvg === null ? null : report.mood.avg - report.mood.prevAvg} />}
                        </div>
                    </div>

                    <div style={{ height: `${Math.max(120, report.habits.length * 30)}px` }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={report.habits} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }} barSize={16}>
                                <XAxis type="number" domain={[0, 100]} hide />
                                <YAxis type="category" dataKey="name" width={120} stroke="#888" tick={{ fontSize: 11 }} />
                                <Bar dataKey="rate" radius={4} isAnimationActive={false}>
                                    {report.habits.map(h => <Cell key={h.name} fill={colors[h.name] || '#8b5cf6'} />)}
                                    <LabelList dataKey="rate" position="right" formatter={(v: unknown) => `${v}%`} style={{ fontSize: 11, fill: '#aaa' }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1.5">{t('reportBest')}</h4>
                            <ul className="space-y-1">
                                {report.best.map(h => (
                                    <li key={h.name} className="flex items-center justify-between gap-2">
                                        <span className="truncate">{h.name}</span>
                                        <span className="shrink-0 flex items-center gap-2"><span className="font-medium">{h.rate}%</span><Delta value={h.deltaRate} suffix=" pt" /></span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {report.worst.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1.5">{t('reportWorst')}</h4>
                                <ul className="space-y-1">
                                    {report.worst.map(h => (
                                        <li key={h.name} className="flex items-center justify-between gap-2">
                                            <span className="truncate">{h.name}</span>
                                            <span className="shrink-0 flex items-center gap-2"><span className="font-medium">{h.rate}%</span><Delta value={h.deltaRate} suffix=" pt" /></span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {activeStreaks.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1.5">{t('reportStreaks')}</h4>
                                <ul className="space-y-1">
                                    {activeStreaks.map(([name, s]) => (
                                        <li key={name} className="flex items-center justify-between gap-2">
                                            <span className="truncate">{name}</span>
                                            <span className="shrink-0 text-amber-400 font-medium">🔥 {s.currentStreak}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {report.counters.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1.5">{t('reportCounters')}</h4>
                                <ul className="space-y-1">
                                    {report.counters.map(c => (
                                        <li key={c.name} className="flex items-center justify-between gap-2">
                                            <span className="truncate">{c.name}</span>
                                            <span className="shrink-0 flex items-center gap-2"><span className="font-medium">{c.total}</span><Delta value={c.total - c.prevTotal} /></span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
