import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { DayPerformance } from '../../utils/analytics';
import { motion } from 'framer-motion';
import { useTranslation } from '../../i18n';

interface DayOfWeekPerformanceProps {
    data: DayPerformance[];
}

export function DayOfWeekPerformance({ data }: DayOfWeekPerformanceProps) {
    const { t } = useTranslation();

    if (!data || data.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card w-full h-[300px] border border-border shadow-sm rounded-xl p-4 flex flex-col"
        >
            <h3 className="text-lg font-semibold mb-2 text-card-foreground">{t('graphsWeeklyPerformance')}</h3>
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                        <PolarGrid stroke="#444" />
                        <PolarAngleAxis dataKey="day" tick={{ fill: '#888', fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6', borderRadius: '8px' }}
                            formatter={(value: any) => [`${value}%`, t('graphsCompletion')]}
                        />
                        <Radar
                            name={t('graphsCompletion')}
                            dataKey="rate"
                            stroke="#10b981"
                            fill="#10b981"
                            fillOpacity={0.4}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
}
