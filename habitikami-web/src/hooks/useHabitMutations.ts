import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { habitService } from '../services/HabitService';
import { toast } from 'sonner';
import { translate } from '../i18n';
import type { HabitData, HabitMeta } from '../types';
import { mergeHabitMeta } from '../utils/habitMeta';
import { enqueue, isNetworkError } from '../utils/offlineQueue';

/** Raw cell value before an optimistic update, keyed by the mutation variables (for offline conflicts). */
const previousCellValues = new WeakMap<object, string | undefined>();

function rawCell(v: unknown): string | undefined {
    if (v === undefined) return undefined;
    if (v === 'skipped') return 'SKIP';
    if (v === 'half') return 'HALF';
    return v === true ? 'TRUE' : v === false ? 'FALSE' : String(v);
}

export function useUpdateCell() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (variables: {
            sheetName: string, rowIndex: number, colIndex: number, value: boolean | 'SKIP' | 'HALF' | number,
            year?: number, month?: number, habitName?: string, date?: string
        }) => {
            const { sheetName, rowIndex, colIndex, value } = variables;
            const queue = () => {
                enqueue({ kind: 'cell', sheetName, rowIndex, colIndex, value, habitName: variables.habitName, date: variables.date, previousValue: previousCellValues.get(variables) });
                toast.info(translate('offlineQueuedChange'));
                return { success: true, queued: true };
            };
            if (typeof navigator !== 'undefined' && navigator.onLine === false) return queue();
            const res = await habitService.updateCell(sheetName, rowIndex, colIndex, value);
            if ('error' in res) {
                if (isNetworkError(res)) return queue();
                throw new Error(res.error);
            }
            return res;
        },
        onMutate: async (variables) => {
            const { sheetName, year, month, habitName, value } = variables;
            if (year === undefined || month === undefined || !habitName) return;

            const queryKey = ['sheetData', sheetName, year, month];
            
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey });

            // Snapshot the previous value
            const previousData = queryClient.getQueryData(queryKey);
            try {
                const old = previousData as { data?: { habits: Record<string, unknown> }[]; meta?: { dataStartRow: number } } | undefined;
                const row = old?.data?.[variables.rowIndex - (old?.meta?.dataStartRow ?? 0)];
                previousCellValues.set(variables, rawCell(row?.habits?.[habitName]));
            } catch { /* no snapshot: the replay skips the conflict check */ }

            // Optimistically update to the new value
            queryClient.setQueryData(queryKey, (old: { data?: HabitData[]; meta?: { dataStartRow: number } } | undefined) => {
                if (!old || !old.data) return old;
                
                const newData = old.data.map((row: HabitData) => {
                    // We need to identify the row. 
                    // variables.rowIndex is the ABSOLUTE sheet row.
                    // (old.meta?.dataStartRow ?? 0) is the 1-based start row.
                    const relativeIndex = variables.rowIndex - (old.meta?.dataStartRow ?? 0);
                    
                    if (old.data!.indexOf(row) === relativeIndex) {
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
            toast.error(translate('toastUpdateCellFailed', { error: err instanceof Error ? err.message : translate('toastUnknownError') }));
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
            toast.success(translate('toastHabitAdded'));
        },
        onError: (error) => {
            toast.error(translate('toastHabitAddFailed', { error: error.message }));
        }
    });
}

export function useAddDay() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ sheetName, date }: { sheetName: string; date?: Date }) => {
            const res = await habitService.addDay(sheetName, date);
            if ('error' in res) throw new Error(res.error);
            return res;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['sheetData', variables.sheetName] });
            toast.success(translate('toastDayAdded'));
        },
        onError: (error) => {
            toast.error(translate('toastDayAddFailed', { error: error.message }));
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
            toast.error(translate('toastMoveFailed', { error: error.message }));
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
            toast.success(translate('toastHabitDeleted'));
        },
        onError: (error) => {
            toast.error(translate('toastDeleteFailed', { error: error.message }));
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
            toast.success(translate('toastHabitRenamed'));
        },
        onError: (error) => {
            toast.error(translate('toastRenameFailed', { error: error.message }));
        }
    });
}

export function useHabitMeta() {
    return useQuery({
        queryKey: ['habitMeta'],
        queryFn: async () => {
            const result = await habitService.getHabitMeta();
            if (result && 'error' in result) throw new Error((result as { error: string }).error);
            return result as Record<string, HabitMeta>;
        },
        staleTime: 1000 * 60 * 5,
    });
}

export function useSetHabitMeta() {
    const queryClient = useQueryClient();
    return useMutation({
        // Partial update: only the given fields change, the rest of the row is kept.
        mutationFn: async ({ habitName, ...patch }: { habitName: string } & Partial<HabitMeta>) => {
            const result = await habitService.setHabitMeta(habitName, patch);
            if (result && 'error' in result) throw new Error((result as { error: string }).error);
            return result;
        },
        onMutate: async ({ habitName, ...patch }) => {
            await queryClient.cancelQueries({ queryKey: ['habitMeta'] });
            const previous = queryClient.getQueryData(['habitMeta']);
            queryClient.setQueryData(['habitMeta'], (old: Record<string, HabitMeta> | undefined) => ({
                ...(old || {}),
                [habitName]: mergeHabitMeta(old?.[habitName], patch),
            }));
            return { previous };
        },
        onError: (err, _variables, context) => {
            queryClient.setQueryData(['habitMeta'], context?.previous);
            toast.error(translate('toastSaveInfoFailed', { error: err instanceof Error ? err.message : translate('toastUnknownError') }));
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
            toast.error(translate('toastSetColorFailed', { error: error.message }));
        }
    });
}
