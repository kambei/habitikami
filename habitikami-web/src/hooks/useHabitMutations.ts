import { useMutation, useQueryClient } from '@tanstack/react-query';
import { habitService } from '../services/HabitService';
import { toast } from 'sonner';

export function useUpdateCell() {


    return useMutation({
        mutationFn: async ({ sheetName, rowIndex, colIndex, value }: {
            sheetName: string, rowIndex: number, colIndex: number, value: boolean | 'SKIP'
        }) => {
            // rowIndex here is SHEET row index (global).
            // But habitService.updateCell expects SHEET row index.
            // The hook caller (HabitTable) must provide the correct global row index.
            return habitService.updateCell(sheetName, rowIndex, colIndex, value);
        },
        onSuccess: () => {
            // Invalidate the query to refetch data (or we could optimistically update)
            // For now, simpler to invalidate.
            // queryClient.invalidateQueries({ queryKey: ['sheetData', variables.sheetName] });

            // Actually, we should optimistically update to avoid flickering.
            // But for MVP, let's just toast and maybe silent refresh?
            // If we don't invalidate, the UI state (local) is already updated by the user click.
            // We just need to ensure backend sync status.
        },
        onError: (error) => {
            toast.error(`Failed to update cell: ${error.message}`);
        }
    });
}

export function useAddHabit() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ sheetName, habitName }: { sheetName: string, habitName: string }) => {
            return habitService.addHabit(sheetName, habitName);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['sheetData', variables.sheetName] });
            toast.success('Habit added successfully');
        },
        onError: (error) => {
            toast.error(`Failed to add habit: ${error.message}`);
        }
    });
}

export function useAddDay() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ sheetName }: { sheetName: string }) => {
            return habitService.addDay(sheetName);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['sheetData', variables.sheetName] });
            toast.success('Day added successfully');
        },
        onError: (error) => {
            toast.error(`Failed to add day: ${error.message}`);
        }
    });
}

export function useMoveColumn() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ sheetName, fromIndex, toIndex }: { sheetName: string, fromIndex: number, toIndex: number }) => {
            return habitService.moveColumn(sheetName, fromIndex, toIndex);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['sheetData', variables.sheetName] });
        },
        onError: (error) => {
            toast.error(`Failed to move column: ${error.message}`);
        }
    });
}

export function useDeleteColumn() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ sheetName, colIndex }: { sheetName: string, colIndex: number }) => {
            return habitService.deleteColumn(sheetName, colIndex);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['sheetData', variables.sheetName] });
            toast.success('Habit deleted');
        },
        onError: (error) => {
            toast.error(`Failed to delete habit: ${error.message}`);
        }
    });
}

export function useSetHabitColor() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ sheetName, habitName, color }: { sheetName: string, habitName: string, color: string }) => {
            return habitService.setHabitColor(sheetName, habitName, color);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['habitColors', variables.sheetName] });
            // Maybe also invalidate sheetData if colors are merged there? No, separate hook.
        },
        onError: (error) => {
            toast.error(`Failed to set color: ${error.message}`);
        }
    });
}
