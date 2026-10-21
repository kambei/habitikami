import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { habitService } from '../services/HabitService';
import type { HabitNote } from '../types';
import { noteKey } from '../utils/habitNotes';
import { translate } from '../i18n';

export const HABIT_NOTES_KEY = ['habitNotes'] as const;

/** All per-habit notes keyed by `date|habit`. */
export function useHabitNotes() {
    return useQuery({
        queryKey: HABIT_NOTES_KEY,
        queryFn: async (): Promise<Record<string, HabitNote>> => {
            const result = await habitService.getHabitNotes();
            if ('error' in result) throw new Error(result.error);
            return result.notes;
        },
        staleTime: 1000 * 60 * 5,
    });
}

/** Creates, updates (or deletes with an empty text) the note of one habit on one day. */
export function useSetHabitNote() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ date, habit, note }: HabitNote) => {
            const result = await habitService.setHabitNote(date, habit, note);
            if ('error' in result) throw new Error(result.error);
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: HABIT_NOTES_KEY });
            const previous = queryClient.getQueryData<Record<string, HabitNote>>(HABIT_NOTES_KEY);
            queryClient.setQueryData<Record<string, HabitNote>>(HABIT_NOTES_KEY, (old) => {
                const next = { ...(old ?? {}) };
                const key = noteKey(variables.date, variables.habit);
                if (variables.note.trim()) next[key] = { ...variables, note: variables.note.trim() };
                else delete next[key];
                return next;
            });
            return { previous };
        },
        onError: (err, _v, context) => {
            queryClient.setQueryData(HABIT_NOTES_KEY, context?.previous);
            toast.error(translate('toastNoteSaveFailed', { error: err instanceof Error ? err.message : translate('toastUnknownError') }));
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: HABIT_NOTES_KEY });
        },
    });
}
