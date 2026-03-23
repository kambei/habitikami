import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { calculateCompletionRates, calculateDailyTrends, calculateDayOfWeekStats, type HabitStats, type DailyTrend, type DayPerformance } from '../utils/analytics';
import { CompletionTrends } from './graphs/CompletionTrends';
import { DayOfWeekPerformance } from './graphs/DayOfWeekPerformance';
import { HabitHeatmap } from './graphs/HabitHeatmap';
import { habitService } from "../services/HabitService";
import { parseSheetData } from "../utils/parser";
import { type HabitData } from '../types';
import { parseDate } from '../utils/dateParsing';
import { Skeleton } from './ui/Skeleton';
import { useTranslation } from '../i18n';

// Deterministic color generation
const COLORS = [
    '#Fca5a5', '#fdba74', '#fcd34d', '#bef264', '#86efac',
    '#6ee7b7', '#5eead4', '#67e8f9', '#7dd3fc', '#93c5fd',
    '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f0abfc', '#fda4af'
];


export function Graphs() {
    const { t, tArray, locale } = useTranslation();
    const [stats, setStats] = useState<HabitStats[]>([]);
    const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
    const [dayOfWeekStats, setDayOfWeekStats] = useState<DayPerformance[]>([]);
    const [allData, setAllData] = useState<HabitData[]>([]);

    const [currentDate, setCurrentDate] = useState(new Date());

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedHabit, setSelectedHabit] = useState<string>('ALL');
    const [sortMethod, setSortMethod] = useState<'default' | 'alphabetical' | 'completion'>('default');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [habitColors, setHabitColors] = useState<Record<string, string>>({});

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();

                const [weekdaysRes, weekendRes, colorsResWeekdays, colorsResWeekend] = await Promise.all([
                    habitService.getDataSubset('Weekdays', year, month),
                    habitService.getDataSubset('Weekend', year, month),
                    habitService.getHabitColors('Weekdays'),
                    habitService.getHabitColors('Weekend')
                ]);

                if ('error' in weekdaysRes) throw new Error(weekdaysRes.error);
                if ('error' in weekendRes) throw new Error(weekendRes.error);

                const cleanWeekdays = parseSheetData(weekdaysRes.values);
                const cleanWeekend = parseSheetData(weekendRes.values);

                // Merge Colors
                const mergedColors: Record<string, string> = {};
                if (!('error' in colorsResWeekdays)) Object.assign(mergedColors, colorsResWeekdays);
                if (!('error' in colorsResWeekend)) Object.assign(mergedColors, colorsResWeekend);

                setHabitColors(mergedColors);

                const combinedData = [...cleanWeekdays.data, ...cleanWeekend.data];

                // sort by date ascending
                combinedData.sort((a, b) => {
                    return (parseDate(a.date)?.getTime() ?? 0) - (parseDate(b.date)?.getTime() ?? 0);
                });

                // Filter out future dates
                const now = new Date();
                now.setHours(23, 59, 59, 999);

                const filteredData = combinedData.filter(d => {
                    const date = parseDate(d.date);
                    return date !== null && date.getTime() <= now.getTime();
                });

                setAllData(filteredData);

                // 1. Overall Stats
                const allHabits = Array.from(new Set([...cleanWeekdays.headers, ...cleanWeekend.headers]));
                const calculatedStats = calculateCompletionRates(filteredData, allHabits);
                setStats(calculatedStats);

                // 2. Daily Trends
                const computedTrends = calculateDailyTrends(filteredData, 30);
                setDailyTrends(computedTrends);

                // 3. Week Day Performance - pass translated day names for display
                const dayNames = tArray('days');
                const computedWeekStats = calculateDayOfWeekStats(filteredData, dayNames as string[]);
                setDayOfWeekStats(computedWeekStats);

            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [currentDate, locale]);

    const getColor = (name: string) => {
        if (habitColors[name]) return habitColors[name];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % COLORS.length;
        return COLORS[index];
    };

    const getSortedStats = () => {
        let sorted = [...stats];
        if (sortMethod === 'alphabetical') {
            sorted.sort((a, b) => sortDirection === 'asc'
                ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name));
        } else if (sortMethod === 'completion') {
            sorted.sort((a, b) => sortDirection === 'asc'
                ? a.percentage - b.percentage
                : b.percentage - a.percentage);
        }
        return sorted;
    };

    const sortedStats = getSortedStats();

    const filteredStats = selectedHabit === 'ALL'
        ? sortedStats
        : sortedStats.filter(s => s.name === selectedHabit);

    const changeMonth = (delta: number) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setCurrentDate(newDate);
    };

    if (loading) {
        return (
            <div className="p-6 h-full space-y-8">
                <div className="flex items-center justify-between p-4 border border-border rounded-xl mb-6">
                    <Skeleton className="h-8 w-48" />
                    <div className="flex gap-2">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-16" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <Skeleton className="h-[300px] w-full rounded-xl" />
                    <Skeleton className="h-[300px] w-full rounded-xl" />
                </div>
                <Skeleton className="h-[400px] w-full rounded-xl" />
            </div>
        );
    }
    if (error) return <div className="p-8 text-center text-red-500">{t('error')}: {error}</div>;
    if (stats.length === 0) return <div className="p-8 text-center text-muted-foreground">{t('graphsNoData')}</div>;

    return (
        <div className="p-6 h-full overflow-y-auto">

            {/* Top Row: Trends & Radar */}
            <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl mb-6 shadow-sm">
                <h2 className="text-lg font-semibold">{currentDate.toLocaleString(locale, { month: 'long', year: 'numeric' })}</h2>
                <div className="flex gap-2">
                    <button onClick={() => changeMonth(-1)} className="px-3 py-1 rounded bg-secondary hover:bg-secondary/80 text-sm">{t('prev')}</button>
                    <button onClick={() => changeMonth(1)} className="px-3 py-1 rounded bg-secondary hover:bg-secondary/80 text-sm">{t('next')}</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <CompletionTrends data={dailyTrends} />
                <DayOfWeekPerformance data={dayOfWeekStats} />
            </div>

            {/* Main Stats: Bar Chart */}
            <div className="bg-card border border-border rounded-xl shadow-sm p-6 mb-8 min-h-[500px] flex flex-col max-w-full overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 overflow-hidden">
                    <h2 className="text-xl font-bold truncate pr-4" title={t('graphsHabitCompletion')}>{t('graphsHabitCompletion')}</h2>

                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        <select
                            value={sortMethod}
                            onChange={(e) => setSortMethod(e.target.value as any)}
                            className="bg-card text-card-foreground p-2 rounded-md border border-border outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer text-sm min-w-[120px]"
                        >
                            <option value="default">{t('graphsSortDefault')}</option>
                            <option value="alphabetical">{t('graphsSortName')}</option>
                            <option value="completion">{t('graphsSortCompletion')}</option>
                        </select>
                        <button
                            onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                            className="bg-card text-card-foreground p-2 rounded-md border border-border hover:bg-accent px-3 shrink-0"
                        >
                            {sortDirection === 'asc' ? '↑' : '↓'}
                        </button>
                        <select
                            value={selectedHabit}
                            onChange={(e) => setSelectedHabit(e.target.value)}
                            className="w-full sm:w-auto bg-card text-card-foreground p-2 rounded-md border border-border outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer min-w-[160px]"
                        >
                            <option value="ALL" className="bg-card text-card-foreground">{t('graphsAllHabits')}</option>
                            {sortedStats.map(s => (
                                <option key={s.name} value={s.name} className="bg-card text-card-foreground">
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="w-full h-[400px] min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={filteredStats}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                        >
                            <defs>
                                <pattern id="no-completion-pattern" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
                                    <rect width="10" height="10" fill="white" />
                                    <line x1="5" y1="0" x2="5" y2="10" stroke="#ef4444" strokeWidth="4" />
                                </pattern>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} stroke="#888" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={0}
                                tick={false}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
                                itemStyle={{ color: '#f3f4f6' }}
                                formatter={(value: any) => [`${value}%`, t('graphsCompletion')]}
                            />
                            {/* Background Bar for 0% and structure */}
                            <Bar 
                                dataKey={() => 100} 
                                barSize={32} 
                                isAnimationActive={false}
                                radius={4}
                            >
                                {filteredStats.map((entry, index) => (
                                    <Cell 
                                        key={`bg-${index}`} 
                                        fill={entry.percentage === 0 ? 'url(#no-completion-pattern)' : 'transparent'} 
                                    />
                                ))}
                            </Bar>
                            {/* Actual Data Bar */}
                            <Bar 
                                dataKey="percentage" 
                                radius={4} 
                                barSize={32}
                            >
                                {filteredStats.map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={entry.percentage === 0 ? 'transparent' : getColor(entry.name)} 
                                    />
                                ))}
                                <LabelList
                                    dataKey="name"
                                    position="insideLeft"
                                    fill="#000"
                                    content={(props: any) => {
                                        const { x, y, width, height, value } = props;
                                        // If bar is too short, or it is a 0% bar (where we used bg bar), 
                                        // we still want to show the text.
                                        // The background bar is 100% width, so we can always show text inside it.
                                        return (
                                            <text
                                                x={x + 10}
                                                y={y + height / 2}
                                                fill={width > 100 || filteredStats.find(s => s.name === value)?.percentage === 0 ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)"}
                                                textAnchor="start"
                                                dominantBaseline="central"
                                                style={{ fontSize: 12, fontWeight: 700, pointerEvents: 'none' }}
                                            >
                                                {value}
                                            </text>
                                        );
                                    }}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Heatmaps Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedStats.map(stat => (
                    <div key={stat.name} className="bg-card border border-border p-4 rounded-xl">
                        <HabitHeatmap
                            data={allData}
                            habitName={stat.name}
                            completionRate={stat.percentage}
                            color={getColor(stat.name)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
