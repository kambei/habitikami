import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DailyTrend } from '../../utils/analytics';
import { motion } from 'framer-motion';
import { useTranslation } from '../../i18n';

interface CompletionTrendsProps {
    data: DailyTrend[];
}

export function CompletionTrends({ data }: CompletionTrendsProps) {
    const { t } = useTranslation();

    if (!data || data.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card w-full h-[300px] border border-border shadow-sm rounded-xl p-4 flex flex-col"
        >
            <h3 className="text-lg font-semibold mb-4 text-card-foreground">{t('graphsDailyTrend')}</h3>
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
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
                            formatter={(value: any) => [`${value}%`, t('graphsCompletion')]}
                        />
                        <Line
                            type="monotone"
                            dataKey="rate"
                            stroke="#8b5cf6"
                            strokeWidth={3}
                            dot={{ fill: '#8b5cf6', strokeWidth: 0, r: 2 }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
}
