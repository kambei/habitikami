import { useMutation, useQueryClient } from '@tanstack/react-query';
import { habitService } from '../services/HabitService';
import { toast } from 'sonner';

export function useUpdateCell() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ sheetName, rowIndex, colIndex, value }: {
            sheetName: string, rowIndex: number, colIndex: number, value: boolean | 'SKIP',
            year?: number, month?: number, habitName?: string
        }) => {
            return habitService.updateCell(sheetName, rowIndex, colIndex, value);
        },
        onMutate: async (variables) => {
            const { sheetName, year, month, habitName, value } = variables;
            if (year === undefined || month === undefined || !habitName) return;

            const queryKey = ['sheetData', sheetName, year, month];
            
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey });

            // Snapshot the previous value
            const previousData = queryClient.getQueryData(queryKey);

            // Optimistically update to the new value
            queryClient.setQueryData(queryKey, (old: any) => {
                if (!old || !old.data) return old;
                
                const newData = old.data.map((row: any) => {
                    // We need to identify the row. 
                    // variables.rowIndex is the ABSOLUTE sheet row.
                    // old.meta.dataStartRow is the 1-based start row.
                    const relativeIndex = variables.rowIndex - old.meta.dataStartRow;
                    
                    if (old.data.indexOf(row) === relativeIndex) {
                        return {
                            ...row,
                            habits: {
                                ...row.habits,
                                [habitName]: value === 'SKIP' ? 'skipped' : value
                            }
                        };
                    }
                    return row;
                });

                return { ...old, data: newData };
            });

            return { previousData };
        },
        onError: (err, variables, context) => {
            const { sheetName, year, month } = variables;
            if (year !== undefined && month !== undefined) {
                queryClient.setQueryData(['sheetData', sheetName, year, month], context?.previousData);
            }
            toast.error(`Failed to update cell: ${err instanceof Error ? err.message : 'Unknown error'}`);
        },
        onSettled: (data, error, variables) => {
            const { sheetName, year, month } = variables;
            if (year !== undefined && month !== undefined) {
                queryClient.invalidateQueries({ queryKey: ['sheetData', sheetName, year, month] });
            }
        },
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
