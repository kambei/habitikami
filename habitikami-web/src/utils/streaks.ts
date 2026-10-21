import type { HabitCellValue, HabitData } from '../types';
import { parseDate } from './dateParsing';

/**
 * Streak rules shared by the web app, the Windows widget payload and the
 * Android widgets (see widget/Streaks.kt, which must stay in sync):
 *
 * - `TRUE` and `HALF` continue a streak (a half-done day still kept the habit).
 * - `SKIP` is neutral: it neither breaks nor extends the streak and it is not
 *   counted in completion rates.
 * - `FALSE` breaks the streak, except on today (and any future row): a day that
 *   is not over yet is "pending", not failed.
 * - Dates without a row are neutral too. Weekday-only habits have no weekend
 *   rows at all, so a calendar gap must not count as a miss.
 * - A numeric cell (quantitative habit) is done when it reaches the habit's
 *   target from HabitMeta; without a target, any value above zero is done.
 */

export type { HabitCellValue } from '../types';

export interface HabitDay {
    /** Local calendar date of the row. */
    date: Date;
    value: HabitCellValue;
}

export interface StreakStats {
    /** Consecutive done days ending today (or on the last done day before today). */
    currentStreak: number;
    /** Longest run of done days in the data. */
    bestStreak: number;
    /** Done days (`TRUE` or `HALF`). */
    completed: number;
    /** Days that count towards the rate: all rows minus skipped ones. */
    total: number;
    /** 0-100, `completed / total`. */
    percentage: number;
}

export function countsAsDone(value: HabitCellValue | undefined, target?: number): boolean {
    if (typeof value === 'number') return target !== undefined && target > 0 ? value >= target : value > 0;
    return value === true || value === 'half';
}

export function isNeutral(value: HabitCellValue | undefined): boolean {
    return value === 'skipped' || value === undefined;
}

function startOfDay(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Collects the rows of one habit from one or more sheets (typically Weekdays
 * and Weekend) into a single date-sorted list. Sheets that do not contain the
 * habit are ignored. If two sheets have the same date, a done value wins over
 * a missed one, and a missed one over a skip.
 */
export function collectHabitDays(habit: string, sheets: HabitData[][], target?: number): HabitDay[] {
    const byDate = new Map<number, HabitDay>();
    for (const rows of sheets) {
        if (!rows.some(row => habit in row.habits)) continue;
        for (const row of rows) {
            const date = parseDate(row.date);
            if (!date) continue;
            const value = row.habits[habit] ?? false;
            const key = startOfDay(date);
            const prev = byDate.get(key);
            if (!prev || rank(value, target) > rank(prev.value, target)) {
                byDate.set(key, { date: new Date(key), value });
            }
        }
    }
    return [...byDate.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

function rank(value: HabitCellValue, target?: number): number {
    if (countsAsDone(value, target)) return 2;
    if (value === 'skipped') return 0;
    return 1;
}

/**
 * Computes streaks and completion for a date-sorted list of days.
 * `today` defaults to the current local date; rows dated today or later that
 * are not done are treated as pending.
 */
export function computeStreaks(days: HabitDay[], today: Date = new Date(), target?: number): StreakStats {
    const todayKey = startOfDay(today);

    let bestStreak = 0;
    let run = 0;
    let completed = 0;
    let total = 0;

    for (const day of days) {
        if (day.value === 'skipped') continue;
        total++;
        if (countsAsDone(day.value, target)) {
            completed++;
            run++;
            if (run > bestStreak) bestStreak = run;
        } else {
            run = 0;
        }
    }

    let currentStreak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
        const day = days[i];
        if (day.value === 'skipped') continue;
        if (countsAsDone(day.value, target)) {
            currentStreak++;
            continue;
        }
        // Not done: pending if the day is not over yet, otherwise the streak ends here.
        if (startOfDay(day.date) >= todayKey) continue;
        break;
    }

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { currentStreak, bestStreak, completed, total, percentage };
}

/** Convenience: stats for one habit across the given sheets (`target` for quantitative habits). */
export function habitStreakStats(habit: string, sheets: HabitData[][], today: Date = new Date(), target?: number): StreakStats {
    return computeStreaks(collectHabitDays(habit, sheets, target), today, target);
}

/**
 * The longest current streak among all habits found in the sheets, with the
 * habit it belongs to. Used for the "streak" number of the widgets.
 * `targets` maps quantitative habits to their daily goal.
 */
export function longestCurrentStreak(
    sheets: HabitData[][],
    today: Date = new Date(),
    targets: Record<string, number | undefined> = {},
): { habit: string; streak: number } {
    const habits = new Set<string>();
    for (const rows of sheets) for (const row of rows) for (const h of Object.keys(row.habits)) habits.add(h);

    let best = { habit: '', streak: 0 };
    for (const habit of habits) {
        const { currentStreak } = habitStreakStats(habit, sheets, today, targets[habit]);
        if (currentStreak > best.streak) best = { habit, streak: currentStreak };
    }
    return best;
}
