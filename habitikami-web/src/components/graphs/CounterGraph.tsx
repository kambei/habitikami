import { useState, useMemo, useEffect } from 'react';
import { ResponsiveContainer, BarChart, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Line } from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { habitService } from '../../services/HabitService';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../i18n';

interface Props {
    data: any[];
}

export const CounterGraph = ({ data }: Props) => {
    const { t, locale } = useTranslation();
    const [temptations, setTemptations] = useState<any[]>([]);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });

    useEffect(() => {
        habitService.getTemptations().then(setTemptations);
    }, []);

    // Sort data by date
    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [data]);

    // Filter data for current month
    const monthData = useMemo(() => {
        return sortedData.filter(d => {
            const date = new Date(d.date);
            return date.getFullYear() === currentMonth.year && date.getMonth() === currentMonth.month;
        });
    }, [sortedData, currentMonth]);

    // Monthly aggregation for line chart history (all months)
    const monthlyHistory = useMemo(() => {
        const monthlyMap: Record<string, any> = {};
        sortedData.forEach(d => {
            const date = new Date(d.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyMap[monthKey]) {
                monthlyMap[monthKey] = { date: monthKey };
            }

            Object.keys(d).forEach(k => {
                if (k !== 'date') {
                    monthlyMap[monthKey][k] = (monthlyMap[monthKey][k] || 0) + (d[k] || 0);
                }
            });
        });

        return Object.values(monthlyMap).sort((a: any, b: any) => a.date.localeCompare(b.date));
    }, [sortedData]);

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

    // Build per-temptation chart data
    const temptationCharts = useMemo(() => {
        if (temptations.length === 0) return [];

        return temptations.map(tConfig => {
            const resistAction = tConfig.actions.find((a: any) => a.type === 'positive' || a.type === 'resist');
            const succumbAction = tConfig.actions.find((a: any) => a.type === 'negative' || a.type === 'succumb');
            const otherActions = tConfig.actions.filter((a: any) =>
                a.type !== 'positive' && a.type !== 'resist' && a.type !== 'negative' && a.type !== 'succumb'
            );

            // Bar chart data (current month, daily)
            const barData = monthData.map(d => {
                const entry: any = { date: d.date };
                if (resistAction) {
                    entry[resistAction.label || resistAction.id] = d[resistAction.id.toLowerCase()] || d[resistAction.id] || 0;
                }
                if (succumbAction) {
                    entry[succumbAction.label || succumbAction.id] = d[succumbAction.id.toLowerCase()] || d[succumbAction.id] || 0;
                }
                for (const a of otherActions) {
                    entry[a.label || a.id] = d[a.id.toLowerCase()] || d[a.id] || 0;
                }
                return entry;
            });

            // Line chart data (monthly history)
            const lineData = monthlyHistory.map(d => {
                const entry: any = { date: d.date };
                if (resistAction) {
                    entry[resistAction.label || resistAction.id] = d[resistAction.id.toLowerCase()] || d[resistAction.id] || 0;
                }
                if (succumbAction) {
                    entry[succumbAction.label || succumbAction.id] = d[succumbAction.id.toLowerCase()] || d[succumbAction.id] || 0;
                }
                for (const a of otherActions) {
                    entry[a.label || a.id] = d[a.id.toLowerCase()] || d[a.id] || 0;
                }
                return entry;
            });

            const bars: { key: string; color: string }[] = [];
            if (resistAction) bars.push({ key: resistAction.label || resistAction.id, color: resistAction.color });
            if (succumbAction) bars.push({ key: succumbAction.label || succumbAction.id, color: succumbAction.color });
            for (const a of otherActions) {
                bars.push({ key: a.label || a.id, color: a.color });
            }

            return {
                label: tConfig.label,
                barData,
                lineData,
                bars,
            };
        });
    }, [temptations, monthData, monthlyHistory]);

    if (temptationCharts.length === 0 && monthData.length === 0) {
        return (
            <div className="w-full bg-card border border-border rounded-xl p-4 shadow-sm mb-6 text-center text-muted-foreground">
                {t('temptationNoData')}
            </div>
        );
    }

    return (
        <div className="w-full space-y-6 mb-6">
            {/* Month Navigation */}
            <div className="flex items-center justify-between bg-card border border-border rounded-xl p-4 shadow-sm">
                <h3 className="text-lg font-semibold">{t('temptationHistory')}</h3>
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
            </div>

            {/* One section per temptation, stacked vertically */}
            {temptationCharts.map((chart, idx) => (
                <div key={chart.label} className="w-full space-y-4">
                    <h4 className="text-base font-bold px-1">{chart.label}</h4>

                    {/* Bar chart: daily for current month */}
                    <div className={cn(
                        "w-full bg-card border border-border rounded-xl p-4 shadow-sm",
                        idx === temptationCharts.length - 1 ? "min-h-[400px]" : "min-h-[300px]"
                    )}>
                        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Daily &mdash; {monthLabel}</p>
                        <div className={cn(
                            "min-h-0",
                            idx === temptationCharts.length - 1 ? "h-[350px]" : "h-[250px]"
                        )}>
                            {chart.barData.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                    No data for this month
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={chart.barData}
                                        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#888"
                                            tickFormatter={(value) => {
                                                const date = new Date(value);
                                                return date.toLocaleDateString(locale, { day: 'numeric' });
                                            }}
                                            minTickGap={20}
                                        />
                                        <YAxis stroke="#888" allowDecimals={false} width={30} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
                                            itemStyle={{ color: '#f3f4f6' }}
                                            labelFormatter={(label) => new Date(label).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}
                                        />
                                        <Legend />
                                        {chart.bars.map(bar => (
                                            <Bar
                                                key={bar.key}
                                                dataKey={bar.key}
                                                fill={bar.color}
                                                radius={[4, 4, 0, 0]}
                                            />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Line chart: monthly totals over time */}
                    <div className="w-full bg-card border border-border rounded-xl p-4 shadow-sm min-h-[280px]">
                        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Monthly Trend</p>
                        <div className="h-[220px] min-h-0">
                            {chart.lineData.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                    No history data
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={chart.lineData}
                                        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#888"
                                            tickFormatter={(value) => {
                                                const [y, m] = value.split('-');
                                                return new Date(Number(y), Number(m) - 1).toLocaleDateString(locale, { month: 'short', year: '2-digit' });
                                            }}
                                            minTickGap={40}
                                        />
                                        <YAxis stroke="#888" allowDecimals={false} width={30} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
                                            itemStyle={{ color: '#f3f4f6' }}
                                            labelFormatter={(label) => {
                                                const [y, m] = label.split('-');
                                                return new Date(Number(y), Number(m) - 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
                                            }}
                                        />
                                        <Legend />
                                        {chart.bars.map(bar => (
                                            <Line
                                                key={bar.key}
                                                type="monotone"
                                                dataKey={bar.key}
                                                stroke={bar.color}
                                                strokeWidth={3}
                                                activeDot={{ r: 8 }}
                                                dot={{ r: 4, strokeWidth: 2, fill: 'var(--background)' }}
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {temptationCharts.length === 0 && monthData.length > 0 && (
                <div className="w-full bg-card border border-border rounded-xl p-4 shadow-sm text-center text-muted-foreground">
                    {t('temptationNoData')}
                </div>
            )}
        </div>
    );
};
