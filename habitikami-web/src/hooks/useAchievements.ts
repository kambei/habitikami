import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { habitService } from '../services/HabitService';
import { useHabitStreaks, useStreakRows } from './useStreaks';
import { useHabitMeta } from './useHabitMutations';
import { useHabitNotes } from './useHabitNotes';
import { useMoodEntries } from './useMood';
import { targetsOf } from '../utils/habitMeta';
import { buildAchievementContext, evaluateAchievements, type AchievementStatus } from '../utils/achievements';
import type { CounterData } from '../types';

export const ACHIEVEMENTS_KEY = ['achievements'] as const;

/** Unlock state from the Achievements sheet. */
export function useUnlockedAchievements() {
    return useQuery({
        queryKey: ACHIEVEMENTS_KEY,
        queryFn: async (): Promise<Record<string, string>> => {
            const res = await habitService.getAchievements();
            if ('error' in res) throw new Error(res.error);
            return res.unlocked;
        },
        staleTime: 1000 * 60 * 5,
    });
}

export function useUnlockAchievements() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (ids: string[]) => {
            const res = await habitService.unlockAchievements(ids);
            if ('error' in res) throw new Error(res.error);
            return ids;
        },
        onSuccess: (ids) => {
            const now = new Date().toISOString();
            queryClient.setQueryData<Record<string, string>>(ACHIEVEMENTS_KEY, old => ({ ...(old ?? {}), ...Object.fromEntries(ids.map(id => [id, now])) }));
        },
    });
}

/** Every achievement with progress and unlock state, from the data the app already loads. */
export function useAchievements(): { achievements: AchievementStatus[]; isLoaded: boolean; unlocked: Record<string, string> | undefined } {
    const { rows, isLoaded: rowsLoaded } = useStreakRows();
    const { streaks } = useHabitStreaks();
    const { data: habitMeta } = useHabitMeta();
    const { data: notes } = useHabitNotes();
    const { data: mood } = useMoodEntries();
    const { data: unlocked } = useUnlockedAchievements();
    const { data: counters } = useQuery({
        queryKey: ['counters', 'all'],
        staleTime: 1000 * 60 * 5,
        queryFn: async (): Promise<CounterData[]> => { const r = await habitService.getCounters(); return Array.isArray(r) ? r : []; },
    });
    const { data: temptations } = useQuery({ queryKey: ['temptations'], staleTime: 1000 * 60 * 10, queryFn: () => habitService.getTemptations() });

    const achievements = useMemo(() => {
        const ctx = buildAchievementContext({
            rows, streaks, targets: targetsOf(habitMeta),
            notes: Object.values(notes ?? {}), mood: mood ?? [], counters: counters ?? [], temptations: temptations ?? [],
        });
        return evaluateAchievements(ctx, unlocked ?? {});
    }, [rows, streaks, habitMeta, notes, mood, counters, temptations, unlocked]);

    return { achievements, isLoaded: rowsLoaded && unlocked !== undefined, unlocked };
}
