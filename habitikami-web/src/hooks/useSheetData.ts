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
