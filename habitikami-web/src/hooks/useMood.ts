import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { habitService } from '../services/HabitService';
import type { MoodEntry } from '../types';
import { queuePendingMoodEntry, readPendingMoodEntries, writePendingMoodEntries } from '../utils/mood';

export const MOOD_QUERY_KEY = ['mood'] as const;

/**
 * Writes pending entries (offline queue and pre-sheet history) to the sheet.
 * Entries are tagged `local` when they come from the old browser storage.
 */
async function flushPendingMoodEntries(): Promise<void> {
    const pending = readPendingMoodEntries();
    if (pending.length === 0) return;
    const tagged = pending.map(e => ({ ...e, source: e.source ?? 'local' as const }));
    const result = await habitService.appendMoodEntries(tagged);
    if ('error' in result) throw new Error(result.error);
    writePendingMoodEntries([]);
}

/** Mood entries from the sheet, oldest first; flushes the pending queue first. */
export function useMoodEntries() {
    return useQuery({
        queryKey: MOOD_QUERY_KEY,
        queryFn: async (): Promise<MoodEntry[]> => {
            try {
                await flushPendingMoodEntries();
            } catch (e) {
                console.warn('Mood: pending entries not flushed yet', e);
            }
            const result = await habitService.getMoodEntries();
            if ('error' in result) throw new Error(result.error);
            // Entries still queued (flush failed) are shown too, so nothing disappears
            return [...result.entries, ...readPendingMoodEntries()].sort((a, b) => a.timestamp - b.timestamp);
        },
        refetchOnMount: 'always',
    });
}

export function useClearMoodEntries() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            writePendingMoodEntries([]);
            const result = await habitService.clearMoodEntries();
            if ('error' in result) throw new Error(result.error);
        },
        onSuccess: () => {
            queryClient.setQueryData(MOOD_QUERY_KEY, []);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: MOOD_QUERY_KEY });
        },
    });
}

/**
 * Saves one assessment. Used outside React Query consumers (chat and
 * worksheet flows): writes to the sheet, or queues locally when that fails.
 */
export async function saveMoodEntry(entry: MoodEntry): Promise<void> {
    const result = await habitService.appendMoodEntries([entry]);
    if ('error' in result) {
        console.warn('Mood: sheet write failed, entry queued locally', result.error);
        queuePendingMoodEntry(entry);
    }
}
