import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
    const { t, tArray } = useTranslation();
    const todayColRef = useRef<HTMLDivElement>(null);
    const [selectedHabit, setSelectedHabit] = useState<string | null>(null);

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

    const habitStats = useMemo(() => {
        if (!selectedHabit) return null;
        const total = data.length;
        let completed = 0;
        let currentStreak = 0;
        let bestStreak = 0;
        let streak = 0;
        let countingCurrent = true;

        // Iterate from most recent to oldest
        for (let i = data.length - 1; i >= 0; i--) {
            const overrideKey = `${i}:${selectedHabit}`;
            const checked = overrideKey in optimisticOverrides
                ? optimisticOverrides[overrideKey]
                : data[i].habits[selectedHabit];
            if (checked) {
                completed++;
                streak++;
                if (streak > bestStreak) bestStreak = streak;
            } else {
                if (countingCurrent) currentStreak = streak;
                countingCurrent = false;
                streak = 0;
            }
        }
        if (countingCurrent) currentStreak = streak;

        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, percentage, currentStreak, bestStreak };
    }, [selectedHabit, data, optimisticOverrides]);

    return (
        <div className="flex-1 flex overflow-y-auto p-4">
            {/* Fixed left column — habit names */}
            <div className="shrink-0 relative z-10">
                {/* Spacer for day headers row */}
                <div className="h-[20px] md:h-[30px] mb-2" />
                {/* Habit labels */}
                <div className="space-y-1.5">
                    {headers.map((habit, hIndex) => {
                        const color = colors[habit] || defaultColor;
                        return (
                            <motion.div
                                key={habit}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: hIndex * 0.03 }}
                                className="flex items-center gap-2 h-6 md:h-8"
                            >
                                <button
                                    onClick={() => setSelectedHabit(habit)}
                                    className="w-[112px] md:w-[152px] shrink-0 flex items-center gap-2 pr-2 truncate cursor-pointer hover:opacity-80 active:scale-95 transition-all text-left"
                                    title={habit}
                                >
                                    <div
                                        className="w-3 h-3 rounded-full shrink-0"
                                        style={{ backgroundColor: color }}
                                    />
                                    <span className="text-xs font-medium truncate">{habit}</span>
                                </button>
                            </motion.div>
                        );
                    })}
                </div>
                {/* Fade edge */}
                <div className="absolute top-0 right-[-12px] w-3 h-full bg-gradient-to-r from-background to-transparent pointer-events-none" />
            </div>

            {/* Scrollable right column — day squares */}
            <div className="flex-1 overflow-x-auto ml-1">
                {/* Day headers row */}
                <div className="flex items-end gap-1 md:gap-2 mb-2">
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

                {/* Habit square rows */}
                <div className="space-y-1.5">
                    {headers.map((habit) => {
                        const color = colors[habit] || defaultColor;
                        return (
                            <div key={habit} className="flex gap-1 md:gap-2 h-6 md:h-8">
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
                        );
                    })}
                </div>
            </div>

            {/* Habit stats popup */}
            <AnimatePresence>
                {selectedHabit && habitStats && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                        onClick={() => setSelectedHabit(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', duration: 0.3 }}
                            className="bg-card border border-border rounded-xl p-5 w-full max-w-xs shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center gap-3 mb-4">
                                <div
                                    className="w-4 h-4 rounded-full shrink-0"
                                    style={{ backgroundColor: colors[selectedHabit] || defaultColor }}
                                />
                                <h3 className="text-base font-semibold break-words">{selectedHabit}</h3>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full h-2 bg-secondary rounded-full mb-4 overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${habitStats.percentage}%` }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: colors[selectedHabit] || defaultColor }}
                                />
                            </div>

                            {/* Stats grid */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-secondary/50 rounded-lg p-3 text-center">
                                    <div className="text-lg font-bold" style={{ color: colors[selectedHabit] || defaultColor }}>
                                        {habitStats.percentage}%
                                    </div>
                                    <div className="text-muted-foreground text-xs">{t('statsCompletion')}</div>
                                </div>
                                <div className="bg-secondary/50 rounded-lg p-3 text-center">
                                    <div className="text-lg font-bold">
                                        {habitStats.completed}/{habitStats.total}
                                    </div>
                                    <div className="text-muted-foreground text-xs">{t('statsDays')}</div>
                                </div>
                                <div className="bg-secondary/50 rounded-lg p-3 text-center">
                                    <div className="text-lg font-bold" style={{ color: colors[selectedHabit] || defaultColor }}>
                                        {habitStats.currentStreak}
                                    </div>
                                    <div className="text-muted-foreground text-xs">{t('statsCurrentStreak')}</div>
                                </div>
                                <div className="bg-secondary/50 rounded-lg p-3 text-center">
                                    <div className="text-lg font-bold">
                                        {habitStats.bestStreak}
                                    </div>
                                    <div className="text-muted-foreground text-xs">{t('statsBestStreak')}</div>
                                </div>
                            </div>

                            {/* Close button */}
                            <button
                                onClick={() => setSelectedHabit(null)}
                                className="mt-4 w-full py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors"
                            >
                                {t('close')}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
