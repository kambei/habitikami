import { useState, useMemo, useEffect } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { habitService } from '../../services/HabitService';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../i18n';

interface Props {
    data: any[];
}

const DAYS_TO_SHOW = 30;

export const CounterGraph = ({ data }: Props) => {
    const { t, locale } = useTranslation();
    const [temptations, setTemptations] = useState<any[]>([]);

    useEffect(() => {
        habitService.getTemptations().then(setTemptations);
    }, []);

    // Sort data by date
    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [data]);

    // View state: End date of the visible window
    const [viewEndDate, setViewEndDate] = useState<Date>(new Date());

    const { visibleData, startDate, endDate, canGoNext } = useMemo(() => {
        const end = new Date(viewEndDate);
        end.setHours(23, 59, 59, 999);

        const start = new Date(end);
        start.setDate(start.getDate() - DAYS_TO_SHOW);
        start.setHours(0, 0, 0, 0);

        const visible = sortedData.filter(d => {
            const date = new Date(d.date);
            return date >= start && date <= end;
        });

        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const canNext = end < today;

        return { visibleData: visible, startDate: start, endDate: end, canGoNext: canNext };
    }, [sortedData, viewEndDate]);

    const handlePrev = () => {
        const newEnd = new Date(viewEndDate);
        newEnd.setDate(newEnd.getDate() - Math.floor(DAYS_TO_SHOW / 2));
        setViewEndDate(newEnd);
    };

    const handleNext = () => {
        const newEnd = new Date(viewEndDate);
        newEnd.setDate(newEnd.getDate() + Math.floor(DAYS_TO_SHOW / 2));
        const today = new Date();
        if (newEnd > today) {
            setViewEndDate(today);
        } else {
            setViewEndDate(newEnd);
        }
    };

    // Build per-temptation chart data
    const temptationCharts = useMemo(() => {
        if (temptations.length === 0) return [];

        return temptations.map(tConfig => {
            // Find resist and succumb actions
            const resistAction = tConfig.actions.find((a: any) => a.type === 'positive' || a.type === 'resist');
            const succumbAction = tConfig.actions.find((a: any) => a.type === 'negative' || a.type === 'succumb');
            const otherActions = tConfig.actions.filter((a: any) =>
                a.type !== 'positive' && a.type !== 'resist' && a.type !== 'negative' && a.type !== 'succumb'
            );

            const chartData = visibleData.map(d => {
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
                chartData,
                bars,
            };
        });
    }, [temptations, visibleData]);

    if (temptationCharts.length === 0 && visibleData.length === 0) {
        return (
            <div className="w-full bg-card border border-border rounded-xl p-4 shadow-sm mb-6 text-center text-muted-foreground">
                {t('temptationNoData')}
            </div>
        );
    }

    return (
        <div className="w-full space-y-6 mb-6">
            {/* Navigation */}
            <div className="flex items-center justify-between bg-card border border-border rounded-xl p-4 shadow-sm">
                <h3 className="text-lg font-semibold">{t('temptationHistory')}</h3>
                <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-1">
                    <button
                        onClick={handlePrev}
                        className="p-1 hover:bg-background rounded-md transition-colors"
                        aria-label="Previous period"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium px-2 min-w-[140px] text-center">
                        {startDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} - {endDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                    </span>
                    <button
                        onClick={handleNext}
                        disabled={!canGoNext}
                        className={cn(
                            "p-1 hover:bg-background rounded-md transition-colors",
                            !canGoNext && "opacity-30 cursor-not-allowed hover:bg-transparent"
                        )}
                        aria-label="Next period"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* One chart per temptation, stacked vertically */}
            {temptationCharts.map((chart, idx) => (
                <div
                    key={chart.label}
                    className={cn(
                        "w-full bg-card border border-border rounded-xl p-4 shadow-sm",
                        idx === temptationCharts.length - 1 ? "min-h-[400px]" : "min-h-[300px]"
                    )}
                >
                    <h4 className="text-base font-bold mb-3">{chart.label}</h4>
                    <div className={cn(
                        "min-h-0",
                        idx === temptationCharts.length - 1 ? "h-[350px]" : "h-[250px]"
                    )}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chart.chartData}
                                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#888"
                                    tickFormatter={(value) => {
                                        const date = new Date(value);
                                        return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
                                    }}
                                    minTickGap={30}
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
                    </div>
                </div>
            ))}

            {temptationCharts.length === 0 && visibleData.length > 0 && (
                <div className="w-full bg-card border border-border rounded-xl p-4 shadow-sm text-center text-muted-foreground">
                    {t('temptationNoData')}
                </div>
            )}
        </div>
    );
};
