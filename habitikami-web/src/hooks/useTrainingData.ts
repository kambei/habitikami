import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { habitService } from '../services/HabitService';
import type { TrainingLogEntry } from '../types';

/**
 * Fetch training log entries for a given month (or all if no params).
 */
export function useTrainingLog(year?: number, month?: number) {
    return useQuery({
        queryKey: ['trainingLog', year, month],
        queryFn: async () => {
            const res = await habitService.getTrainingLog(year, month);
            if ('error' in res) throw new Error(res.error);
            // Parse raw rows into typed entries
            return res.entries.map(row => ({
                date: row[0] || '',
                section: row[1] || '',
                exercise: row[2] || '',
                session: row[3] || '',
                duration: row[4] || '',
            } as TrainingLogEntry));
        },
    });
}

/**
 * Get today's logged exercises (derived from the monthly query).
 */
export function useTodayTrainingLog() {
    const now = new Date();
    const pad = (n: number) => n < 10 ? '0' + n : String(n);
    const todayStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    const query = useTrainingLog(now.getFullYear(), now.getMonth());

    const todayEntries = (query.data || []).filter(e => e.date === todayStr);

    return {
        ...query,
        todayEntries,
        todayStr,
    };
}

/**
 * Mutation to log a training exercise.
 */
export function useLogTrainingExercise() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: { date: string; section: string; exercise: string; session: string; duration: string }) => {
            // Ensure sheet exists first
            await habitService.ensureTrainingSheet();
            const res = await habitService.logTrainingExercise(
                params.date, params.section, params.exercise, params.session, params.duration
            );
            if ('error' in res) throw new Error(res.error);
            return res;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trainingLog'] });
        },
    });
}

/**
 * Mutation to undo (remove) a training exercise log entry.
 */
export function useRemoveTrainingExercise() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: { date: string; section: string; exercise: string; session: string }) => {
            const res = await habitService.removeTrainingExercise(
                params.date, params.section, params.exercise, params.session
            );
            if ('error' in res) throw new Error(res.error);
            return res;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trainingLog'] });
        },
    });
}
