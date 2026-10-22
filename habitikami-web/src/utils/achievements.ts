import type { CounterData, HabitData, HabitNote, MoodEntry } from '../types';
import { ACHIEVEMENTS, type Achievement, type AchievementContext } from '../data/achievements';
import { doneByDay } from './correlations';
import { moodByDay } from './moodCorrelation';
import type { StreakStats } from './streaks';

export interface AchievementStatus extends Achievement {
    current: number;
    /** 0-1 */
    progress: number;
    unlocked: boolean;
    unlockedAt: string | null;
}

export const ACHIEVEMENTS_SHEET = 'Achievements';
export const ACHIEVEMENTS_COLUMNS = ['Id', 'UnlockedAt'] as const;
export const ACHIEVEMENTS_RANGE = `${ACHIEVEMENTS_SHEET}!A:B`;

interface TemptationLike { actions?: { id: string; type?: string }[] }

/** Builds the numbers every achievement is judged on. */
export function buildAchievementContext(input: {
    rows: HabitData[];
    streaks: Record<string, StreakStats>;
    targets?: Record<string, number | undefined>;
    notes?: HabitNote[];
    mood?: MoodEntry[];
    counters?: CounterData[];
    temptations?: TemptationLike[];
}): AchievementContext {
    const byDay = doneByDay(input.rows, input.targets ?? {});
    const days = Array.from(byDay.keys()).sort();
    let completions = 0, perfectDays = 0, bestPerfectRun = 0, run = 0;
    const habits = new Set<string>();
    let prevDay: string | null = null;
    for (const day of days) {
        const values = Object.entries(byDay.get(day)!);
        if (values.length === 0) continue;
        for (const [h, done] of values) { habits.add(h); if (done) completions++; }
        const perfect = values.every(([, done]) => done);
        if (perfect) {
            perfectDays++;
            run = prevDay && isNextDay(prevDay, day) ? run + 1 : 1;
            bestPerfectRun = Math.max(bestPerfectRun, run);
        } else {
            run = 0;
        }
        prevDay = day;
    }
    const resistIds = new Set<string>();
    for (const t of input.temptations ?? []) for (const a of t.actions ?? []) if (a.type === 'resist' || a.type === 'positive') resistIds.add(String(a.id).toLowerCase());
    let resisted = 0;
    for (const c of input.counters ?? []) for (const [k, v] of Object.entries(c)) if (k !== 'date' && resistIds.has(k.toLowerCase())) resisted += Number(v) || 0;

    return {
        bestStreak: Math.max(0, ...Object.values(input.streaks).map(s => s.bestStreak)),
        bestPerfectRun,
        perfectDays,
        completions,
        habitsTracked: habits.size,
        resisted,
        notes: (input.notes ?? []).filter(n => n.note.trim()).length,
        moodDays: moodByDay(input.mood ?? []).size,
        daysTracked: days.length,
    };
}

function isNextDay(a: string, b: string): boolean {
    const [ay, am, ad] = a.split('-').map(Number);
    const [by, bm, bd] = b.split('-').map(Number);
    return Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad) === 86400000;
}

/** Every achievement with its progress; `unlocked` once stored in the sheet or reached now. */
export function evaluateAchievements(ctx: AchievementContext, stored: Record<string, string> = {}): AchievementStatus[] {
    return ACHIEVEMENTS.map(a => {
        const current = a.value(ctx);
        const reached = current >= a.target;
        const unlockedAt = stored[a.id] ?? null;
        return { ...a, current, progress: Math.min(1, current / a.target), unlocked: reached || unlockedAt !== null, unlockedAt };
    });
}

/** Ids reached now that are not in the sheet yet. */
export function newlyUnlocked(statuses: AchievementStatus[]): string[] {
    return statuses.filter(s => s.current >= s.target && s.unlockedAt === null).map(s => s.id);
}

/** Rows of the Achievements sheet (header optional) → id → UnlockedAt. */
export function rowsToUnlocked(rows: readonly (readonly unknown[])[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const row of rows) {
        const id = String(row?.[0] ?? '').trim();
        if (!id || /^id$/i.test(id)) continue;
        out[id] = String(row?.[1] ?? '').trim();
    }
    return out;
}
