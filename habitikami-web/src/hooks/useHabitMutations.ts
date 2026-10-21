import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { habitService } from '../services/HabitService';
import { toast } from 'sonner';

export function useUpdateCell() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ sheetName, rowIndex, colIndex, value }: {
            sheetName: string, rowIndex: number, colIndex: number, value: boolean | 'SKIP' | 'HALF',
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
                                [habitName]: value === 'SKIP' ? 'skipped' : (value === 'HALF' ? 'half' : value)
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
        onSettled: (_data, _error, variables) => {
            const { sheetName, year, month } = variables;
            if (year !== undefined && month !== undefined) {
                queryClient.invalidateQueries({ queryKey: ['sheetData', sheetName, year, month] });
            }
            // Date-range queries (streaks, widget summary) include this cell too
            queryClient.invalidateQueries({ queryKey: ['sheetData', sheetName, 'range'] });
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

export function useRenameHabit() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ sheetName, oldName, newName }: { sheetName: string, oldName: string, newName: string }) => {
            const result = await habitService.renameHabit(sheetName, oldName, newName);
            if (result && 'error' in result) throw new Error(result.error as string);
            return result;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['sheetData', variables.sheetName] });
            queryClient.invalidateQueries({ queryKey: ['habitColors', variables.sheetName] });
            queryClient.invalidateQueries({ queryKey: ['habitMeta'] });
            toast.success('Habit renamed');
        },
        onError: (error) => {
            toast.error(`Failed to rename habit: ${error.message}`);
        }
    });
}

export function useHabitMeta() {
    return useQuery({
        queryKey: ['habitMeta'],
        queryFn: async () => {
            const result = await habitService.getHabitMeta();
            if (result && 'error' in result) throw new Error((result as any).error);
            return result as Record<string, string>;
        },
        staleTime: 1000 * 60 * 5,
    });
}

export function useSetHabitMeta() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ habitName, description }: { habitName: string, description: string }) => {
            const result = await habitService.setHabitMeta(habitName, description);
            if (result && 'error' in result) throw new Error((result as any).error);
            return result;
        },
        onMutate: async ({ habitName, description }) => {
            await queryClient.cancelQueries({ queryKey: ['habitMeta'] });
            const previous = queryClient.getQueryData(['habitMeta']);
            queryClient.setQueryData(['habitMeta'], (old: any) => ({
                ...(old || {}),
                [habitName]: description,
            }));
            return { previous };
        },
        onError: (err, _variables, context) => {
            queryClient.setQueryData(['habitMeta'], context?.previous);
            toast.error(`Failed to save info: ${err instanceof Error ? err.message : 'Unknown error'}`);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['habitMeta'] });
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
