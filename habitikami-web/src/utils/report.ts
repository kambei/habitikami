import type { CounterData, HabitData, MoodEntry } from '../types';
import { parseDate } from './dateParsing';
import { countsAsDone, isNeutral } from './streaks';

/**
 * Weekly / monthly report (issue #6), computed on the fly from the rows of
 * the period and of the one before it.
 */

export type ReportPeriod = 'week' | 'month';

export interface ReportHabit {
    name: string;
    done: number;
    days: number;
    rate: number;
    /** Rate change vs the previous period in points, null when it had no data. */
    deltaRate: number | null;
}

export interface ReportSummary {
    from: Date;
    to: Date;
    prevFrom: Date;
    prevTo: Date;
    /** Overall completion rate of the period (0-100). */
    rate: number;
    prevRate: number | null;
    daysTracked: number;
    habits: ReportHabit[];
    best: ReportHabit[];
    worst: ReportHabit[];
    counters: { name: string; total: number; prevTotal: number }[];
    mood: { avg: number; prevAvg: number | null; entries: number } | null;
}

/** [from, to] of the current period and of the previous one, ending on `today`. */
export function reportRange(period: ReportPeriod, today: Date = new Date()): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
    const to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const from = period === 'week'
        ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
        : new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
    const prevTo = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1, 23, 59, 59, 999);
    const span = period === 'week' ? 6 : 29;
    const prevFrom = new Date(prevTo.getFullYear(), prevTo.getMonth(), prevTo.getDate() - span);
    return { from, to, prevFrom, prevTo };
}

function between(rows: HabitData[], from: Date, to: Date): HabitData[] {
    return rows.filter(r => {
        const d = parseDate(r.date);
        return d !== null && d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
    });
}

function habitTotals(rows: HabitData[], targets: Record<string, number | undefined>): Map<string, { done: number; days: number }> {
    const out = new Map<string, { done: number; days: number }>();
    for (const row of rows) {
        for (const [habit, value] of Object.entries(row.habits)) {
            if (isNeutral(value)) continue;
            const cur = out.get(habit) ?? { done: 0, days: 0 };
            cur.days++;
            if (countsAsDone(value, targets[habit])) cur.done++;
            out.set(habit, cur);
        }
    }
    return out;
}

function overallRate(totals: Map<string, { done: number; days: number }>): number | null {
    let done = 0, days = 0;
    for (const t of totals.values()) { done += t.done; days += t.days; }
    return days === 0 ? null : Math.round((done / days) * 100);
}

export function buildReport(
    period: ReportPeriod,
    rows: HabitData[],
    opts: { targets?: Record<string, number | undefined>; counters?: CounterData[]; mood?: MoodEntry[]; today?: Date } = {},
): ReportSummary {
    const targets = opts.targets ?? {};
    const range = reportRange(period, opts.today);
    const cur = between(rows, range.from, range.to);
    const prev = between(rows, range.prevFrom, range.prevTo);
    const curTotals = habitTotals(cur, targets);
    const prevTotals = habitTotals(prev, targets);

    const habits: ReportHabit[] = Array.from(curTotals.entries()).map(([name, t]) => {
        const p = prevTotals.get(name);
        const rate = Math.round((t.done / t.days) * 100);
        const prevRate = p && p.days > 0 ? Math.round((p.done / p.days) * 100) : null;
        return { name, done: t.done, days: t.days, rate, deltaRate: prevRate === null ? null : rate - prevRate };
    }).sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));

    const counters = (opts.counters ?? []).length > 0 ? (() => {
        const names = Array.from(new Set((opts.counters ?? []).flatMap(c => Object.keys(c).filter(k => k !== 'date'))));
        const sum = (from: Date, to: Date) => {
            const acc: Record<string, number> = {};
            for (const c of opts.counters ?? []) {
                const d = parseDate(c.date);
                if (!d || d.getTime() < from.getTime() || d.getTime() > to.getTime()) continue;
                for (const n of names) acc[n] = (acc[n] ?? 0) + (Number(c[n]) || 0);
            }
            return acc;
        };
        const now = sum(range.from, range.to), before = sum(range.prevFrom, range.prevTo);
        return names.map(name => ({ name, total: now[name] ?? 0, prevTotal: before[name] ?? 0 })).filter(c => c.total > 0 || c.prevTotal > 0);
    })() : [];

    const moodAvg = (from: Date, to: Date) => {
        const xs = (opts.mood ?? []).filter(m => m.timestamp >= from.getTime() && m.timestamp <= to.getTime());
        return xs.length === 0 ? null : { avg: Math.round(xs.reduce((s, m) => s + m.mood, 0) / xs.length), n: xs.length };
    };
    const moodNow = moodAvg(range.from, range.to);
    const moodBefore = moodAvg(range.prevFrom, range.prevTo);

    return {
        ...range,
        rate: overallRate(curTotals) ?? 0,
        prevRate: overallRate(prevTotals),
        daysTracked: new Set(cur.map(r => r.date)).size,
        habits,
        best: habits.slice(0, 3),
        worst: habits.length > 3 ? habits.slice(-3).reverse() : [],
        counters,
        mood: moodNow ? { avg: moodNow.avg, prevAvg: moodBefore?.avg ?? null, entries: moodNow.n } : null,
    };
}
