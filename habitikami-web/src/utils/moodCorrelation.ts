import type { HabitData, MoodEntry } from '../types';
import { doneByDay } from './correlations';

/**
 * Mood vs habits (issue #5): for each habit, the average mood of the days it
 * was done against the days it was not. Mood entries are averaged per local
 * day first (several assessments a day count once), then joined by date with
 * the habit rows.
 */

export interface MoodHabitEffect {
    habit: string;
    /** Average mood (0-100) on days the habit was done. */
    moodDone: number;
    /** Average mood on days it was not done. */
    moodNotDone: number;
    /** moodDone - moodNotDone, one decimal. */
    delta: number;
    daysDone: number;
    daysNotDone: number;
}

export const MOOD_MIN_DAYS_PER_SIDE = 3;

function localDayKey(ts: number): string {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Average mood per local day, keyed YYYY-MM-DD. */
export function moodByDay(entries: MoodEntry[]): Map<string, number> {
    const sums = new Map<string, { sum: number; n: number }>();
    for (const e of entries) {
        if (!Number.isFinite(e.timestamp) || e.timestamp <= 0) continue;
        const key = localDayKey(e.timestamp);
        const cur = sums.get(key) ?? { sum: 0, n: 0 };
        cur.sum += e.mood; cur.n += 1;
        sums.set(key, cur);
    }
    const out = new Map<string, number>();
    for (const [k, { sum, n }] of sums) out.set(k, sum / n);
    return out;
}

/** Effects of every habit with at least `minDays` days on each side, biggest positive first. */
export function moodHabitEffects(
    rows: HabitData[],
    entries: MoodEntry[],
    targets: Record<string, number | undefined> = {},
    minDays: number = MOOD_MIN_DAYS_PER_SIDE,
): MoodHabitEffect[] {
    const habitsByDay = doneByDay(rows, targets);
    const moods = moodByDay(entries);
    const acc = new Map<string, { done: number[]; not: number[] }>();
    for (const [day, habits] of habitsByDay) {
        const mood = moods.get(day);
        if (mood === undefined) continue;
        for (const [habit, done] of Object.entries(habits)) {
            const cur = acc.get(habit) ?? { done: [], not: [] };
            (done ? cur.done : cur.not).push(mood);
            acc.set(habit, cur);
        }
    }
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const out: MoodHabitEffect[] = [];
    for (const [habit, { done, not }] of acc) {
        if (done.length < minDays || not.length < minDays) continue;
        const moodDone = avg(done), moodNotDone = avg(not);
        out.push({
            habit,
            moodDone: Math.round(moodDone),
            moodNotDone: Math.round(moodNotDone),
            delta: Math.round((moodDone - moodNotDone) * 10) / 10,
            daysDone: done.length,
            daysNotDone: not.length,
        });
    }
    return out.sort((a, b) => b.delta - a.delta);
}
