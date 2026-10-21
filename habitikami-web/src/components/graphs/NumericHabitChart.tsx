import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HabitData, HabitMeta } from '../../types';
import { parseDate } from '../../utils/dateParsing';
import { useTranslation } from '../../i18n';

interface Props {
    data: HabitData[];
    habitName: string;
    meta: HabitMeta;
    color: string;
}

/** Daily values of a quantitative habit over the loaded period, with its goal line. */
export function NumericHabitChart({ data, habitName, meta, color }: Props) {
    const { t } = useTranslation();
    const points = data
        .filter(row => habitName in row.habits)
        .map(row => {
            const d = parseDate(row.date);
            const v = row.habits[habitName];
            return { date: d ? `${d.getDate()}/${d.getMonth() + 1}` : row.date, value: typeof v === 'number' ? v : 0 };
        });

    if (points.length === 0) return null;
    const unit = meta.unit ? ` ${meta.unit}` : '';

    return (
        <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id={`num-${habitName}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.5} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals />
                    <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                        formatter={(value) => [`${value}${unit}`, habitName]}
                    />
                    {meta.target && (
                        <ReferenceLine y={meta.target} stroke={color} strokeDasharray="4 4" label={{ value: `${t('graphsNumericTarget')} ${meta.target}${unit}`, fontSize: 10, fill: color, position: 'insideTopRight' }} />
                    )}
                    <Area type="monotone" dataKey="value" stroke={color} fill={`url(#num-${habitName})`} strokeWidth={2} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
