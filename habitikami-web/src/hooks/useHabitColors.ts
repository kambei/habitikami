import { useQuery } from '@tanstack/react-query';
import { habitService } from '../services/HabitService';

export function useHabitColors(sheetName: string) {
    return useQuery({
        queryKey: ['habitColors', sheetName],
        queryFn: async () => {
            const response = await habitService.getHabitColors(sheetName);
            if ('error' in response) {
                throw new Error(response.error);
            }
            return response as Record<string, string>;
        },
        enabled: !!sheetName,
        staleTime: 1000 * 60 * 60, // Colors don't change often
    });
}
