import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { projectTrends } from '../../utils/projections';
import type { DailyTrend } from '../../utils/analytics';
import { motion } from 'framer-motion';
import { useTranslation } from '../../i18n';

interface CompletionTrendsProps {
    data: DailyTrend[];
    /** Days of dashed projection after the last point (0 hides it). */
    projectionDays?: number;
}

export function CompletionTrends({ data, projectionDays = 7 }: CompletionTrendsProps) {
    const { t } = useTranslation();
    const { points, regression } = useMemo(() => projectTrends(data ?? [], projectionDays), [data, projectionDays]);

    if (!data || data.length === 0) return null;
    const perWeek = Math.round(regression.slope * 7);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card w-full h-[300px] border border-border shadow-sm rounded-xl p-4 flex flex-col"
        >
            <div className="flex items-baseline justify-between gap-2 mb-4">
                <h3 className="text-lg font-semibold text-card-foreground">{t('graphsDailyTrend')}</h3>
                {projectionDays > 0 && data.length >= 2 && (
                    <span className={`text-xs font-medium ${perWeek > 0 ? 'text-emerald-400' : perWeek < 0 ? 'text-rose-400' : 'text-muted-foreground'}`} title={t('projectionHint')}>
                        {t('projectionTrend').replace('{delta}', (perWeek > 0 ? '+' : '') + String(perWeek))}
                    </span>
                )}
            </div>
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart
                        data={points}
                        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                        className='!overflow-visible'
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#888"
                            tick={{ fontSize: 10 }}
                            tickMargin={10}
                            minTickGap={30}
                        />
                        <YAxis
                            stroke="#888"
                            tick={{ fontSize: 10 }}
                            domain={[0, 100]}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6', borderRadius: '8px' }}
                            itemStyle={{ color: '#8b5cf6' }}
                            formatter={(value: unknown, name?: unknown) => [`${value}%`, name === 'projected' ? t('projectionLabel') : t('graphsCompletion')]}
                        />
                        <Line
                            type="monotone"
                            dataKey="rate"
                            stroke="#8b5cf6"
                            strokeWidth={3}
                            dot={{ fill: '#8b5cf6', strokeWidth: 0, r: 2 }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                        {projectionDays > 0 && (
                            <Line
                                type="monotone"
                                dataKey="projected"
                                stroke="#a78bfa"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                                connectNulls
                            />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
}
