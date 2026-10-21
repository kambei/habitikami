import type { HabitData } from '../types';
import { countsAsDone, isNeutral } from './streaks';
import { parseDate } from './dateParsing';

/**
 * Habit-to-habit correlations (issue #4).
 *
 * For every pair of habits, the phi coefficient of "done on the same day" is
 * computed over the days where both habits have a real value (TRUE, HALF,
 * FALSE or a number); SKIP and missing cells are left out. Phi is the Pearson
 * correlation of two binary variables: +1 means always done together, -1
 * means one excludes the other, 0 no relationship.
 */

export interface HabitPairCorrelation {
    a: string;
    b: string;
    /** -1..1, 0 when undefined (a habit always or never done). */
    phi: number;
    /** Days where both habits had a real value. */
    days: number;
}

export interface CorrelationInsight extends HabitPairCorrelation {
    /** Both done together (positive) or one without the other (negative). */
    direction: 'together' | 'apart';
}

export const CORRELATION_MIN_DAYS = 20;
export const CORRELATION_THRESHOLD = 0.3;

/** Per date, done/not done for each habit with a real value. Later rows win. */
export function doneByDay(rows: HabitData[], targets: Record<string, number | undefined> = {}): Map<string, Record<string, boolean>> {
    const out = new Map<string, Record<string, boolean>>();
    for (const row of rows) {
        const d = parseDate(row.date);
        if (!d) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const day = out.get(key) ?? {};
        for (const [habit, value] of Object.entries(row.habits)) {
            if (isNeutral(value)) continue;
            day[habit] = countsAsDone(value, targets[habit]);
        }
        out.set(key, day);
    }
    return out;
}

/** Phi coefficient of two boolean series of the same length. 0 when a series is constant. */
export function phiCoefficient(xs: boolean[], ys: boolean[]): number {
    let n11 = 0, n10 = 0, n01 = 0, n00 = 0;
    for (let i = 0; i < xs.length; i++) {
        if (xs[i] && ys[i]) n11++;
        else if (xs[i] && !ys[i]) n10++;
        else if (!xs[i] && ys[i]) n01++;
        else n00++;
    }
    const denom = Math.sqrt((n11 + n10) * (n01 + n00) * (n11 + n01) * (n10 + n00));
    if (denom === 0) return 0;
    return (n11 * n00 - n10 * n01) / denom;
}

/** Every habit pair with its phi and the number of shared days. */
export function habitCorrelations(rows: HabitData[], targets: Record<string, number | undefined> = {}): HabitPairCorrelation[] {
    const byDay = doneByDay(rows, targets);
    const habits = Array.from(new Set(Array.from(byDay.values()).flatMap(d => Object.keys(d)))).sort((a, b) => a.localeCompare(b));
    const out: HabitPairCorrelation[] = [];
    for (let i = 0; i < habits.length; i++) {
        for (let j = i + 1; j < habits.length; j++) {
            const a = habits[i], b = habits[j];
            const xs: boolean[] = [], ys: boolean[] = [];
            for (const day of byDay.values()) {
                if (a in day && b in day) { xs.push(day[a]); ys.push(day[b]); }
            }
            out.push({ a, b, phi: xs.length ? round3(phiCoefficient(xs, ys)) : 0, days: xs.length });
        }
    }
    return out;
}

/** Habits in a stable order for the matrix (alphabetical). */
export function correlationHabits(pairs: HabitPairCorrelation[]): string[] {
    return Array.from(new Set(pairs.flatMap(p => [p.a, p.b]))).sort((a, b) => a.localeCompare(b));
}

/** Pairs worth a sentence: |phi| >= threshold on at least minDays days, strongest first. */
export function correlationInsights(
    pairs: HabitPairCorrelation[],
    threshold: number = CORRELATION_THRESHOLD,
    minDays: number = CORRELATION_MIN_DAYS,
): CorrelationInsight[] {
    return pairs
        .filter(p => p.days >= minDays && Math.abs(p.phi) >= threshold)
        .sort((x, y) => Math.abs(y.phi) - Math.abs(x.phi))
        .map(p => ({ ...p, direction: p.phi > 0 ? 'together' : 'apart' }));
}

function round3(n: number): number {
    return Math.round(n * 1000) / 1000;
}
