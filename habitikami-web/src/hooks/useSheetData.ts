import { useQuery } from '@tanstack/react-query';
import { habitService } from '../services/HabitService';
import { parseSheetData } from '../utils/parser';

export function useSheetData(sheetName: string, year: number, month: number) {
    return useQuery({
        queryKey: ['sheetData', sheetName, year, month],
        queryFn: async () => {
            const response = await habitService.getDataSubset(sheetName, year, month);
            if ('error' in response) {
                throw new Error(response.error);
            }
            const parsed = parseSheetData(response.values);
            return {
                ...parsed,
                meta: { ...parsed.meta, dataStartRow: response.dataStartRow },
            };
        },
        enabled: !!sheetName,
    });
}

/** ISO day key (local date) used in query keys, so equal dates share the cache. */
function dayKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Rows of a sheet between two dates (inclusive) in a single request.
 * The key starts with ['sheetData', sheetName] so the existing invalidations
 * after a mutation refresh it too.
 */
export function useSheetRange(sheetName: string, from: Date, to: Date) {
    const fromKey = dayKey(from);
    const toKey = dayKey(to);
    return useQuery({
        queryKey: ['sheetData', sheetName, 'range', fromKey, toKey],
        queryFn: async () => {
            const response = await habitService.getRangeData(sheetName, from, to);
            if ('error' in response) {
                throw new Error(response.error);
            }
            const parsed = parseSheetData(response.values);
            return {
                ...parsed,
                meta: { ...parsed.meta, dataStartRow: response.dataStartRow },
            };
        },
        enabled: !!sheetName,
    });
}
