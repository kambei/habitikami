import { useMemo } from 'react';
import { useSheetRange } from './useSheetData';
import type { HabitData } from '../types';
import { parseDate } from '../utils/dateParsing';

/**
 * Weekdays + Weekend rows of the last `months` months (up to today), merged
 * and sorted by date. One cached range query per sheet, shared with the
 * streak hook when the window matches.
 */
export function useHabitRows(months: number): { rows: HabitData[]; isLoading: boolean; error: Error | null } {
    const window = useMemo(() => {
        const to = new Date();
        const from = new Date(to.getFullYear(), to.getMonth() - months, to.getDate());
        return { from, to };
    }, [months]);
    const weekdays = useSheetRange('Weekdays', window.from, window.to);
    const weekend = useSheetRange('Weekend', window.from, window.to);

    const rows = useMemo(() => {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const all = [...(weekdays.data?.data ?? []), ...(weekend.data?.data ?? [])]
            .filter(r => { const d = parseDate(r.date); return d !== null && d.getTime() <= end.getTime(); });
        all.sort((a, b) => (parseDate(a.date)?.getTime() ?? 0) - (parseDate(b.date)?.getTime() ?? 0));
        return all;
    }, [weekdays.data, weekend.data]);

    return { rows, isLoading: weekdays.isLoading || weekend.isLoading, error: (weekdays.error ?? weekend.error) as Error | null };
}
