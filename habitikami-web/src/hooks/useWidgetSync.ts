import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSheetData } from './useSheetData';
import { useHabitStreaks } from './useStreaks';
import { useHabitMeta } from './useHabitMutations';
import { habitService } from '../services/HabitService';
import { useTranslation } from '../i18n';
import { translateDay } from '../utils/dayTranslation';
import { countsAsDone } from '../utils/streaks';

/** Sheet that holds today's row. */
export function todaySheet(now: Date = new Date()): 'Weekdays' | 'Weekend' {
    const d = now.getDay();
    return d === 0 || d === 6 ? 'Weekend' : 'Weekdays';
}

export interface WidgetCounter {
    id: string;
    label: string;
    value: number;
    color: string;
}

/** Payload pushed to the service worker for the Windows 11 widgets (see public/sw.js). */
export interface WidgetSummary {
    date: string;
    completedCount: number;
    totalCount: number;
    currentStreak: number;
    streakHabit: string;
    nextHabitName: string;
    counters: WidgetCounter[];
    updatedAt: string;
    labels: Record<string, string>;
}

/**
 * Keeps the Windows widgets in sync from any view: whenever today's row,
 * the streaks or the counters change, the summary is posted to the service
 * worker (which caches it and refreshes every widget by tag).
 */
export function useWidgetSync(enabled: boolean) {
    const { t, tArray } = useTranslation();
    const now = new Date();
    const sheet = todaySheet(now);
    const { data: sheetData } = useSheetData(enabled ? sheet : '', now.getFullYear(), now.getMonth());
    const { streaks } = useHabitStreaks();
    const { data: habitMeta } = useHabitMeta();
    const { data: counters } = useQuery({
        queryKey: ['widgetCounters'],
        enabled,
        staleTime: 1000 * 60 * 5,
        queryFn: async (): Promise<WidgetCounter[]> => {
            const [rows, temptations] = await Promise.all([habitService.getCounters(), habitService.getTemptations()]);
            if (!Array.isArray(rows)) return [];
            const todayKey = new Date().toISOString().split('T')[0];
            const todayRow = rows.find((r: { date?: string }) => r.date === todayKey) ?? {};
            const out: WidgetCounter[] = [];
            for (const group of temptations ?? []) {
                for (const action of group.actions ?? []) {
                    const raw = Object.entries(todayRow).find(([k]) => k.toLowerCase() === String(action.id).toLowerCase())?.[1];
                    out.push({ id: action.id, label: action.label, value: parseInt(String(raw ?? 0), 10) || 0, color: action.color || '#6b7280' });
                }
            }
            return out.slice(0, 6);
        },
    });

    const summary = useMemo<WidgetSummary | null>(() => {
        if (!enabled || !sheetData) return null;
        const pad = (n: number) => (n < 10 ? '0' + n : String(n));
        const todayStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
        const todayRow = sheetData.data.find(row => row.date === todayStr);
        if (!todayRow) return null;

        const habits = Object.keys(todayRow.habits);
        const isDone = (h: string) => {
            const v = todayRow.habits[h];
            if (v === 'skipped') return true;
            return countsAsDone(v, habitMeta?.[h]?.type === 'number' ? habitMeta[h].target : undefined);
        };
        const pending = habits.filter(h => !isDone(h));
        let best = { habit: '', streak: 0 };
        for (const [habit, s] of Object.entries(streaks)) if (s.currentStreak > best.streak) best = { habit, streak: s.currentStreak };

        return {
            date: `${translateDay(todayRow.day, tArray('days'))} ${todayRow.date}`,
            completedCount: habits.length - pending.length,
            totalCount: habits.length,
            currentStreak: best.streak,
            streakHabit: best.habit,
            nextHabitName: pending[0] ?? t('habitTableAllDone'),
            counters: counters ?? [],
            updatedAt: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
            labels: {
                completed: t('widgetLabelCompleted'),
                streak: t('widgetLabelStreak'),
                nextUp: t('widgetLabelNextUp'),
                days: t('widgetLabelDays'),
                counters: t('widgetLabelCounters'),
                updated: t('widgetLabelUpdated'),
                noCounters: t('widgetLabelNoCounters'),
                completeNext: t('widgetActionComplete'),
                skipNext: t('widgetActionSkip'),
                openApp: t('widgetActionOpen'),
            },
        };
        // `now` is recreated every render; the deps below are what actually changes the payload
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, sheetData, streaks, habitMeta, counters, t, tArray]);

    useEffect(() => {
        if (!summary) return;
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'WIDGET_UPDATE', data: summary });
        }
    }, [summary]);
}
