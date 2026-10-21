import { describe, it, expect } from 'vitest';
import type { HabitData, MoodEntry } from '../src/types';
import { phiCoefficient, habitCorrelations, correlationInsights, doneByDay } from '../src/utils/correlations';
import { moodByDay, moodHabitEffects } from '../src/utils/moodCorrelation';
import { linearRegression, projectTrends, nextMilestones } from '../src/utils/projections';
import { buildCsv, csvCell, exportFileName } from '../src/utils/exportCsv';
import { buildReport, reportRange } from '../src/utils/report';

function row(date: string, habits: HabitData['habits']): HabitData {
    return { day: 'Lunedì', date, habits };
}
function dateStr(d: Date): string {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
/** n consecutive days ending today, built by `make(i)` where i=0 is the oldest. */
function series(n: number, make: (i: number) => HabitData['habits'], today = new Date(2026, 9, 21)): HabitData[] {
    return Array.from({ length: n }, (_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (n - 1 - i));
        return row(dateStr(d), make(i));
    });
}

describe('correlations', () => {
    it('phi is 1 for identical series, -1 for opposite, 0 for constant', () => {
        expect(phiCoefficient([true, false, true, false], [true, false, true, false])).toBe(1);
        expect(phiCoefficient([true, false, true, false], [false, true, false, true])).toBe(-1);
        expect(phiCoefficient([true, true, true], [true, false, true])).toBe(0);
    });

    it('ignores skipped and missing cells when pairing days', () => {
        const rows = [
            row('01/10/2026', { A: true, B: true }),
            row('02/10/2026', { A: false, B: 'skipped' }),
            row('03/10/2026', { A: 'half', B: false }),
        ];
        const byDay = doneByDay(rows);
        expect(byDay.get('2026-10-02')).toEqual({ A: false });
        const pairs = habitCorrelations(rows);
        expect(pairs).toHaveLength(1);
        expect(pairs[0].days).toBe(2);
    });

    it('insights need enough days and a strong enough phi', () => {
        const rows = series(25, i => ({ Run: i % 2 === 0, Stretch: i % 2 === 0, Read: i % 3 === 0 }));
        const insights = correlationInsights(habitCorrelations(rows));
        expect(insights[0]).toMatchObject({ a: 'Run', b: 'Stretch', phi: 1, direction: 'together' });
        expect(insights.find(i => i.b === 'Read' || i.a === 'Read')).toBeUndefined();
        expect(correlationInsights(habitCorrelations(rows.slice(0, 10)))).toEqual([]);
    });
});

describe('mood vs habits', () => {
    const entry = (y: number, m: number, d: number, mood: number): MoodEntry => {
        const ts = new Date(y, m - 1, d, 12).getTime();
        return { date: new Date(ts).toISOString(), timestamp: ts, mood, anxiety: 50, label: 'x' };
    };

    it('averages several assessments of the same day', () => {
        const map = moodByDay([entry(2026, 10, 1, 40), entry(2026, 10, 1, 80)]);
        expect(map.get('2026-10-01')).toBe(60);
    });

    it('compares the mood of done days against not-done days', () => {
        const rows = series(8, i => ({ Walk: i < 4 }));
        const entries = rows.map((r, i) => {
            const [d, m, y] = r.date.split('/').map(Number);
            return entry(y, m, d, i < 4 ? 80 : 40);
        });
        const effects = moodHabitEffects(rows, entries);
        expect(effects).toEqual([{ habit: 'Walk', moodDone: 80, moodNotDone: 40, delta: 40, daysDone: 4, daysNotDone: 4 }]);
        expect(moodHabitEffects(rows.slice(0, 5), entries.slice(0, 5))).toEqual([]);
    });
});

describe('projections', () => {
    it('fits a straight line', () => {
        expect(linearRegression([10, 20, 30, 40])).toEqual({ slope: 10, intercept: 10 });
        expect(linearRegression([50])).toEqual({ slope: 0, intercept: 50 });
    });

    it('extends the trend with clamped projected points', () => {
        const trends = [10, 20, 30].map((rate, i) => ({ date: `0${i + 1}/10`, rate, total: 10, completed: rate / 10 }));
        const { points } = projectTrends(trends, 3, new Date(2026, 9, 3));
        expect(points).toHaveLength(6);
        expect(points[2].projected).toBe(30);
        expect(points.slice(3).map(p => p.projected)).toEqual([40, 50, 60]);
        expect(points[3].date).toBe('04/10');
        expect(points[3].rate).toBeUndefined();
        const high = projectTrends([90, 95, 100].map((rate, i) => ({ date: String(i), rate, total: 1, completed: 1 })), 2).points;
        expect(high.at(-1)?.projected).toBe(100);
    });

    it('forecasts the next milestone of active streaks, soonest first', () => {
        const today = new Date(2026, 9, 21);
        const out = nextMilestones({ A: { currentStreak: 5 }, B: { currentStreak: 28 }, C: { currentStreak: 0 }, D: { currentStreak: 150 } }, today);
        expect(out.map(f => [f.habit, f.milestone, f.daysLeft])).toEqual([['B', 30, 2], ['A', 7, 2]]);
        expect(out[0].on.getDate()).toBe(23);
    });
});

describe('csv export', () => {
    it('quotes cells with commas, quotes and newlines', () => {
        expect(csvCell('a,b')).toBe('"a,b"');
        expect(csvCell('say "hi"')).toBe('"say ""hi"""');
        expect(csvCell(true)).toBe('TRUE');
        expect(csvCell(undefined)).toBe('');
    });

    it('writes one section per kind, filtered by period', () => {
        const rows = [row('01/10/2026', { A: true, B: 3 }), row('02/10/2026', { A: 'skipped', B: 'half' }), row('15/09/2026', { A: false })];
        const csv = buildCsv({
            habits: rows,
            counters: [{ date: '2026-10-01', smoke: 2 }, { date: '2026-09-01', smoke: 9 }],
            notes: [{ date: '02/10/2026', habit: 'A', note: 'tired, rainy' }],
            mood: [{ date: 'x', timestamp: new Date(2026, 9, 1, 9).getTime(), mood: 70, anxiety: 20, label: 'Diary' }],
        }, new Date(2026, 9, 1), new Date(2026, 9, 31));
        const sections = csv.trim().split('\n\n');
        expect(sections).toHaveLength(4);
        expect(sections[0].split('\n')).toEqual(['Date,Day,A,B', '01/10/2026,Lunedì,TRUE,3', '02/10/2026,Lunedì,SKIP,HALF']);
        expect(sections[1]).toBe('Date,smoke\n2026-10-01,2');
        expect(sections[2]).toContain('"tired, rainy"');
        expect(sections[3]).toContain('70,20,Diary');
        expect(exportFileName(new Date(2026, 9, 1), new Date(2026, 9, 31), 'csv')).toBe('habitikami_20261001-20261031.csv');
    });
});

describe('report', () => {
    const today = new Date(2026, 9, 21);

    it('builds week and month ranges with the previous period right before', () => {
        const w = reportRange('week', today);
        expect(w.from.getDate()).toBe(15);
        expect(w.prevTo.getDate()).toBe(14);
        expect(w.prevFrom.getDate()).toBe(8);
        const m = reportRange('month', today);
        expect(m.from.getMonth()).toBe(8);
        expect(m.from.getDate()).toBe(22);
    });

    it('ranks habits and compares with the previous period', () => {
        const rows = series(14, i => ({ Run: i >= 7 ? true : i % 2 === 0, Read: i >= 7 ? i % 2 === 0 : true, Skip: 'skipped' }), today);
        const r = buildReport('week', rows, {
            today,
            counters: [{ date: '2026-10-20', smoke: 2 }, { date: '2026-10-10', smoke: 5 }],
            mood: [{ date: 'x', timestamp: new Date(2026, 9, 20).getTime(), mood: 60, anxiety: 0, label: '' }],
        });
        expect(r.daysTracked).toBe(7);
        expect(r.habits.map(h => h.name)).toEqual(['Run', 'Read']);
        expect(r.habits[0]).toMatchObject({ rate: 100, deltaRate: 43 });
        expect(r.habits[1]).toMatchObject({ rate: 43, deltaRate: -57 });
        expect(r.rate).toBe(71);
        expect(r.prevRate).toBe(79);
        expect(r.counters).toEqual([{ name: 'smoke', total: 2, prevTotal: 5 }]);
        expect(r.mood).toEqual({ avg: 60, prevAvg: null, entries: 1 });
        expect(r.worst).toEqual([]);
    });
});
