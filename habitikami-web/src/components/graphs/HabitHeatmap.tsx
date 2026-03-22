import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { HabitData } from '../../types';
import { parseDate } from '../../utils/dateParsing';

interface HabitHeatmapProps {
    data: HabitData[];
    habitName: string;
    completionRate?: number;
    color?: string;
}

export function HabitHeatmap({ data, habitName, completionRate, color }: HabitHeatmapProps) {
    // Take last 60 days max
    const recentData = data.slice(-60);

    // Calculate padding for the first day to align with Mon-Sun grid
    // Date format is assumed to be parseable or we need to be careful.
    // Assuming data.date is "YYYY-MM-DD" or similar compliant string.
    // If it's custom, we might need more logic. 
    // Based on previous files, date seems to be text but let's try standard parsing or use the day field if available? 
    // Types says: day: string; date: string;

    const getDayIndex = (dateStr: string) => {
        const date = parseDate(dateStr);
        // Fallback to Monday if invalid
        if (!date || isNaN(date.getTime())) return 0;

        const day = date.getDay(); // 0 = Sun, 1 = Mon ...
        // Convert to 0 = Mon, 6 = Sun
        return day === 0 ? 6 : day - 1;
    };

    const firstDayIndex = recentData.length > 0 ? getDayIndex(recentData[0].date) : 0;
    const padding = Array(firstDayIndex).fill(null);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-3"
        >
            <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium text-muted-foreground">{habitName}</h4>
                {typeof completionRate === 'number' && (
                    <span className={cn(
                        "text-xs font-bold px-1.5 py-0.5 rounded",
                        // If color is present, we might want a simple style.
                        // But existing logic uses conditional classes.
                        // Let's override if color exists.
                    )}
                        style={color ? { color: color, backgroundColor: `${color}20` } : undefined}
                    >
                        {!color && (
                            <span className={cn(
                                completionRate >= 80 ? "text-green-500 bg-green-500/10" :
                                    completionRate >= 50 ? "text-yellow-500 bg-yellow-500/10" :
                                        "text-red-500 bg-red-500/10"
                            )}>
                                {completionRate}%
                            </span>
                        )}
                        {color && `${completionRate}%`}
                    </span>
                )}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {/* Weekday headers */}
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                    <div key={`head-${i}`} className="text-[10px] text-center text-muted-foreground font-medium mb-1">
                        {d}
                    </div>
                ))}

                {padding.map((_, i) => (
                    <div key={`pad-${i}`} className="w-full aspect-square" />
                ))}

                {recentData.map((row, i) => {
                    const isDone = row.habits[habitName];
                    return (
                        <div
                            key={i}
                            title={`${row.date}: ${isDone ? 'Done' : 'Missed'}`}
                            className={cn(
                                "w-full aspect-square rounded-sm transition-colors cursor-help",
                                !color && isDone
                                    ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]"
                                    : !color && !isDone ? "bg-secondary/40 hover:bg-secondary/60" : ""
                            )}
                            style={isDone && color ? { backgroundColor: color, boxShadow: `0 0 4px ${color}80` } : (!isDone ? { backgroundColor: 'rgba(255,255,255,0.05)' } : {})}
                        />
                    );
                })}
            </div>
        </motion.div>
    );
}
