import { useState, useMemo, useEffect } from 'react';
import { ResponsiveContainer, BarChart, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Line } from 'recharts';
import { ChevronLeft, ChevronRight, CalendarDays, TrendingUp } from 'lucide-react';
import { habitService } from '../../services/HabitService';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../i18n';
import { ExpandableGraph } from './ExpandableGraph';

interface Props {
    data: any[];
}

type ChartMode = 'weekly' | 'trend';

function getWeekBounds() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7)); // go back to Monday
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
}

export const CounterGraph = ({ data }: Props) => {
    const { t, locale } = useTranslation();
    const [temptations, setTemptations] = useState<any[]>([]);
    const [chartMode, setChartMode] = useState<ChartMode>('weekly');
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });

    useEffect(() => {
        habitService.getTemptations().then(setTemptations);
    }, []);

    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [data]);

    // Weekly mode: current week (Mon-Sun)
    const weekBounds = useMemo(() => getWeekBounds(), []);
    const weekData = useMemo(() => {
        return sortedData.filter(d => {
            const date = new Date(d.date);
            return date >= weekBounds.start && date <= weekBounds.end;
        });
    }, [sortedData, weekBounds]);

    const weekLabel = useMemo(() => {
        const fmt = (d: Date) => d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
        return `${fmt(weekBounds.start)} — ${fmt(weekBounds.end)}`;
    }, [weekBounds, locale]);

    // Selected month daily data for trend line chart
    const selectedMonthData = useMemo(() => {
        const { year, month } = currentMonth;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const dataMap: Record<string, any> = {};
        sortedData.forEach(d => {
            // Assume d.date is "YYYY-MM-DD"
            if (!d.date) return;
            const parts = d.date.split('-');
            if (parts.length >= 2) {
                const y = parseInt(parts[0]);
                const m = parseInt(parts[1]);
                if (y === year && (m - 1) === month) {
                    dataMap[d.date] = d;
                }
            }
        });

        const fullMonthData = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            if (dataMap[dateStr]) {
                fullMonthData.push(dataMap[dateStr]);
            } else {
                fullMonthData.push({ date: dateStr });
            }
        }
        return fullMonthData;
    }, [sortedData, currentMonth]);

    const changeMonth = (delta: number) => {
        setCurrentMonth(prev => {
            const d = new Date(prev.year, prev.month + delta, 1);
            return { year: d.getFullYear(), month: d.getMonth() };
        });
    };

    const canGoNext = useMemo(() => {
        const now = new Date();
        return currentMonth.year < now.getFullYear() || (currentMonth.year === now.getFullYear() && currentMonth.month < now.getMonth());
    }, [currentMonth]);

    const monthLabel = new Date(currentMonth.year, currentMonth.month).toLocaleDateString(locale, { month: 'long', year: 'numeric' });

    const temptationCharts = useMemo(() => {
        if (temptations.length === 0) return [];

        return temptations.map(tConfig => {
            const resistAction = tConfig.actions.find((a: any) => a.type === 'positive' || a.type === 'resist');
            const succumbAction = tConfig.actions.find((a: any) => a.type === 'negative' || a.type === 'succumb');
            const otherActions = tConfig.actions.filter((a: any) =>
                a.type !== 'positive' && a.type !== 'resist' && a.type !== 'negative' && a.type !== 'succumb'
            );

            const mapEntry = (d: any) => {
                const entry: any = {};
                if (resistAction) entry[resistAction.label || resistAction.id] = d[resistAction.id.toLowerCase()] || d[resistAction.id] || 0;
                if (succumbAction) entry[succumbAction.label || succumbAction.id] = d[succumbAction.id.toLowerCase()] || d[succumbAction.id] || 0;
                for (const a of otherActions) entry[a.label || a.id] = d[a.id.toLowerCase()] || d[a.id] || 0;
                return entry;
            };

            const barData = weekData.map(d => ({ date: d.date, ...mapEntry(d) }));
            const lineData = selectedMonthData.map(d => ({ date: d.date, ...mapEntry(d) }));

            const series: { key: string; color: string }[] = [];
            if (resistAction) series.push({ key: resistAction.label || resistAction.id, color: resistAction.color });
            if (succumbAction) series.push({ key: succumbAction.label || succumbAction.id, color: succumbAction.color });
            for (const a of otherActions) series.push({ key: a.label || a.id, color: a.color });

            return { label: tConfig.label, barData, lineData, series };
        });
    }, [temptations, weekData, selectedMonthData]);

    if (temptationCharts.length === 0 && sortedData.length === 0) {
        return (
            <div className="w-full bg-card border border-border rounded-xl p-4 shadow-sm mb-6 text-center text-muted-foreground">
                {t('temptationNoData')}
            </div>
        );
    }

    return (
        <div className="w-full space-y-6 mb-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border border-border rounded-xl p-4 shadow-sm">
                <h3 className="text-lg font-semibold">{t('temptationHistory')}</h3>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Chart type toggle */}
                    <div className="flex bg-secondary/50 rounded-lg p-1">
                        <button
                            onClick={() => setChartMode('weekly')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                                chartMode === 'weekly' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <CalendarDays className="w-3.5 h-3.5" />
                            Weekly
                        </button>
                        <button
                            onClick={() => setChartMode('trend')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                                chartMode === 'trend' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <TrendingUp className="w-3.5 h-3.5" />
                            Trend
                        </button>
                    </div>

                    {/* Week label (weekly mode) */}
                    {chartMode === 'weekly' && (
                        <span className="text-xs text-muted-foreground font-medium bg-secondary/50 rounded-lg px-3 py-1.5">
                            {weekLabel}
                        </span>
                    )}

                    {/* Month navigation (trend mode) */}
                    {chartMode === 'trend' && (
                        <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-1">
                            <button
                                onClick={() => changeMonth(-1)}
                                className="p-1 hover:bg-background rounded-md transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-medium px-2 min-w-[140px] text-center capitalize">
                                {monthLabel}
                            </span>
                            <button
                                onClick={() => changeMonth(1)}
                                disabled={!canGoNext}
                                className={cn(
                                    "p-1 hover:bg-background rounded-md transition-colors",
                                    !canGoNext && "opacity-30 cursor-not-allowed hover:bg-transparent"
                                )}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* One section per temptation */}
            {temptationCharts.map((chart, idx) => (
                <div
                    key={chart.label}
                    className={cn(
                        "w-full bg-card border border-border rounded-xl p-4 shadow-sm",
                        idx === temptationCharts.length - 1 ? "min-h-[400px]" : "min-h-[300px]"
                    )}
                >
                    <h4 className="text-base font-bold mb-3">{chart.label}</h4>

                    <ExpandableGraph title={chart.label} containerClassName={cn(
                        "min-h-0",
                        idx === temptationCharts.length - 1 ? "h-[350px]" : "h-[250px]"
                    )}>
                        <div className="w-full h-full">
                            {chartMode === 'weekly' ? (
                                chart.barData.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                        No data this week
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                        <BarChart data={chart.barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#888"
                                                tickFormatter={(value) => {
                                                    const parts = value.split('-');
                                                    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                                                    return date.toLocaleDateString(locale, { weekday: 'short' });
                                                }}
                                            />
                                            <YAxis stroke="#888" allowDecimals={false} width={30} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
                                                itemStyle={{ color: '#f3f4f6' }}
                                                labelFormatter={(label) => {
                                                    const parts = label.split('-');
                                                    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                                                    return date.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' });
                                                }}
                                            />
                                            <Legend />
                                            {chart.series.map(s => (
                                                <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} />
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                )
                            ) : (
                                chart.lineData.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                        No history data
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chart.lineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#888"
                                                tickFormatter={(value) => {
                                                    const parts = value.split('-');
                                                    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                                                    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
                                                }}
                                                minTickGap={30}
                                            />
                                            <YAxis stroke="#888" allowDecimals={false} width={30} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
                                                itemStyle={{ color: '#f3f4f6' }}
                                                labelFormatter={(label) => {
                                                    const parts = label.split('-');
                                                    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                                                    return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
                                                }}
                                            />
                                            <Legend />
                                            {chart.series.map(s => (
                                                <Line
                                                    key={s.key}
                                                    type="monotone"
                                                    dataKey={s.key}
                                                    stroke={s.color}
                                                    strokeWidth={3}
                                                    activeDot={{ r: 8 }}
                                                    dot={{ r: 4, strokeWidth: 2, fill: 'var(--background)' }}
                                                />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                )
                            )}
                        </div>
                    </ExpandableGraph>
                </div>
            ))}

            {temptationCharts.length === 0 && sortedData.length > 0 && (
                <div className="w-full bg-card border border-border rounded-xl p-4 shadow-sm text-center text-muted-foreground">
                    {t('temptationNoData')}
                </div>
            )}
        </div>
    );
};
