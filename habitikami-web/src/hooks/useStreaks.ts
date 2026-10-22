import { useMemo } from 'react';
import { useSheetRange } from './useSheetData';
import { useHabitMeta } from './useHabitMutations';
import { habitStreakStats, type StreakStats } from '../utils/streaks';
import { targetsOf } from '../utils/habitMeta';

const STREAK_WINDOW_DAYS = 365;

/**
 * Current and best streak of every habit, merged across Weekdays and Weekend
 * over the last year (rules in utils/streaks.ts). One cached range query per
 * sheet; invalidated by cell updates like the monthly data.
 */
function useStreakWindow() {
    return useMemo(() => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - STREAK_WINDOW_DAYS);
        return { from, to };
    }, []);
}

/** Weekdays + Weekend rows of the streak window (same cached queries as the streaks). */
export function useStreakRows() {
    const window = useStreakWindow();
    const weekdays = useSheetRange('Weekdays', window.from, window.to);
    const weekend = useSheetRange('Weekend', window.from, window.to);
    const rows = useMemo(() => [...(weekdays.data?.data ?? []), ...(weekend.data?.data ?? [])], [weekdays.data, weekend.data]);
    return { rows, isLoading: weekdays.isLoading || weekend.isLoading, isLoaded: !!weekdays.data && !!weekend.data };
}

export function useHabitStreaks(): { streaks: Record<string, StreakStats>; isLoading: boolean } {
    const window = useStreakWindow();
    const weekdays = useSheetRange('Weekdays', window.from, window.to);
    const weekend = useSheetRange('Weekend', window.from, window.to);
    const { data: habitMeta } = useHabitMeta();

    const streaks = useMemo(() => {
        const sheets = [weekdays.data?.data ?? [], weekend.data?.data ?? []];
        const targets = targetsOf(habitMeta);
        const habits = new Set<string>();
        for (const rows of sheets) for (const row of rows) for (const h of Object.keys(row.habits)) habits.add(h);
        const out: Record<string, StreakStats> = {};
        const today = new Date();
        for (const habit of habits) out[habit] = habitStreakStats(habit, sheets, today, targets[habit]);
        return out;
    }, [weekdays.data, weekend.data, habitMeta]);

    return { streaks, isLoading: weekdays.isLoading || weekend.isLoading };
}
