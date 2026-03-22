import { useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CounterData } from '../../types';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../i18n';

interface Props {
    data: CounterData[];
}

const DAYS_TO_SHOW = 30;

export const SmokeVsResistedGraph = ({ data }: Props) => {
    const { t, locale } = useTranslation();

    // Sort data by date just in case
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

    return (
        <div className="w-full bg-card border border-border rounded-xl p-4 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
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

            <div className="h-[300px] min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={visibleData}
                        margin={{
                            top: 5,
                            right: 30,
                            left: 0,
                            bottom: 5,
                        }}
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
                        <Line type="monotone" dataKey="smoke" name={t('temptationResisted')} stroke="#10b981" strokeWidth={2} activeDot={{ r: 8 }} dot={false} />
                        <Line type="monotone" dataKey="smoked" name={t('temptationSmoked')} stroke="#ef4444" strokeWidth={2} activeDot={{ r: 8 }} dot={false} />
                        <Line type="monotone" dataKey="coffee" name={t('temptationCoffee')} stroke="#b45309" strokeWidth={2} activeDot={{ r: 8 }} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {visibleData.length === 0 && (
                <div className="text-center text-muted-foreground text-sm mt-2">
                    {t('temptationNoData')}
                </div>
            )}
        </div>
    );
};
