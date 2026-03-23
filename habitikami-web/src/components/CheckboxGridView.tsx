import { useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { HabitData } from '../types';
import { useTranslation } from '../i18n';
import { translateDay } from '../utils/dayTranslation';

interface CheckboxGridViewProps {
    headers: string[];
    data: HabitData[];
    colors: Record<string, string>;
    meta: { startCol: number; headerRowIndex: number; dataStartRow: number } | null;
    dataStartRow: number;
    onToggle: (rowIndex: number, habit: string, currentValue: boolean) => void;
    isPending: boolean;
    optimisticOverrides: Record<string, boolean>;
}

export function CheckboxGridView({
    headers,
    data,
    colors,
    onToggle,
    isPending,
    optimisticOverrides,
}: CheckboxGridViewProps) {
    const { tArray } = useTranslation();
    const todayColRef = useRef<HTMLDivElement>(null);

    const parseDate = useCallback((dateStr: string) => {
        const parts = dateStr.split(/[-/]/);
        if (parts.length !== 3) return null;
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }, []);

    const isToday = useCallback((dateStr: string) => {
        const date = parseDate(dateStr);
        if (!date) return false;
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    }, [parseDate]);

    useEffect(() => {
        if (data.length > 0 && todayColRef.current) {
            todayColRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [data]);

    const defaultColor = '#6b7280';

    return (
        <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
            <div className="inline-block min-w-full md:block">
                {/* Day headers row */}
                <div className="flex items-end gap-1 md:gap-2 mb-2">
                    <div className="w-[112px] md:w-[152px] shrink-0 sticky left-0 z-10 bg-background" />
                    <div className="flex gap-1 md:gap-2 md:flex-1">
                        {data.map((row, colIndex) => {
                            const today = isToday(row.date);
                            const dayShort = translateDay(row.day, tArray('days')).slice(0, 3);
                            const dateParts = row.date.split(/[-/]/);
                            return (
                                <div
                                    key={row.date + colIndex}
                                    ref={today ? todayColRef : null}
                                    className={`w-6 md:flex-1 md:min-w-[28px] md:max-w-[48px] shrink-0 md:shrink flex flex-col items-center ${today ? 'text-primary font-bold' : 'text-muted-foreground'}`}
                                >
                                    <span className="text-[9px] leading-tight hidden md:block">{dayShort}</span>
                                    <span className="text-[10px] leading-tight">{dateParts[0]}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Habit rows */}
                <div className="space-y-1.5">
                    {headers.map((habit, hIndex) => {
                        const color = colors[habit] || defaultColor;
                        return (
                            <motion.div
                                key={habit}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: hIndex * 0.03 }}
                                className="flex items-center gap-2"
                            >
                                {/* Habit label - sticky on mobile */}
                                <div
                                    className="w-[112px] md:w-[152px] shrink-0 flex items-center gap-2 pr-2 truncate sticky left-0 z-10 bg-background"
                                    title={habit}
                                >
                                    <div
                                        className="w-3 h-3 rounded-full shrink-0"
                                        style={{ backgroundColor: color }}
                                    />
                                    <span className="text-xs font-medium truncate">{habit}</span>
                                </div>

                                {/* Day squares */}
                                <div className="flex gap-1 md:gap-2 md:flex-1">
                                    {data.map((row, rIndex) => {
                                        const overrideKey = `${rIndex}:${habit}`;
                                        const checked = overrideKey in optimisticOverrides
                                            ? optimisticOverrides[overrideKey]
                                            : row.habits[habit];
                                        const today = isToday(row.date);

                                        return (
                                            <button
                                                key={row.date + rIndex}
                                                title={`${row.date}: ${checked ? '✓' : '✗'}`}
                                                disabled={isPending}
                                                onClick={() => onToggle(rIndex, habit, checked)}
                                                className={`w-6 h-6 md:h-8 md:flex-1 md:min-w-[28px] md:max-w-[48px] rounded-sm transition-all duration-150 cursor-pointer hover:scale-110 active:scale-95 disabled:cursor-not-allowed shrink-0 md:shrink md:aspect-square ${today ? 'ring-1 ring-primary ring-offset-1 ring-offset-background' : ''}`}
                                                style={checked
                                                    ? { backgroundColor: color, boxShadow: `0 0 6px ${color}40` }
                                                    : { backgroundColor: 'transparent', border: `2px solid ${color}50` }
                                                }
                                            />
                                        );
                                    })}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
