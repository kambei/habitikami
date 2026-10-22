import { describe, it, expect } from 'vitest';
import type { HabitData } from '../src/types';
import { buildAchievementContext, evaluateAchievements, newlyUnlocked, rowsToUnlocked } from '../src/utils/achievements';
import { ACHIEVEMENTS } from '../src/data/achievements';

function series(n: number, make: (i: number) => HabitData['habits'], from = new Date(2026, 9, 1)): HabitData[] {
    return Array.from({ length: n }, (_, i) => {
        const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
        return { day: 'x', date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`, habits: make(i) };
    });
}

describe('achievements', () => {
    it('counts completions, perfect days and the longest perfect run', () => {
        const rows = series(10, i => ({ A: true, B: i === 4 ? false : 'half', C: 'skipped' }));
        const ctx = buildAchievementContext({ rows, streaks: { A: { currentStreak: 10, bestStreak: 12, totalDays: 10, completedDays: 10, percentage: 100 } } });
        expect(ctx).toMatchObject({ completions: 19, perfectDays: 9, bestPerfectRun: 5, habitsTracked: 2, daysTracked: 10, bestStreak: 12 });
    });

    it('sums only the resist counters and counts notes and mood days', () => {
        const ctx = buildAchievementContext({
            rows: [], streaks: {},
            counters: [{ date: '2026-10-01', smoke: 3, smoked: 1 }, { date: '2026-10-02', smoke: 2 }],
            temptations: [{ actions: [{ id: 'smoke', type: 'resist' }, { id: 'smoked', type: 'succumb' }] }],
            notes: [{ date: 'd', habit: 'A', note: 'x' }, { date: 'd', habit: 'B', note: '  ' }],
            mood: [{ date: '', timestamp: new Date(2026, 9, 1, 9).getTime(), mood: 50, anxiety: 0, label: '' }, { date: '', timestamp: new Date(2026, 9, 1, 20).getTime(), mood: 60, anxiety: 0, label: '' }],
        });
        expect(ctx).toMatchObject({ resisted: 5, notes: 1, moodDays: 1 });
    });

    it('evaluates progress, keeps stored unlocks and reports the new ones', () => {
        const rows = series(8, () => ({ A: true }));
        const ctx = buildAchievementContext({ rows, streaks: { A: { currentStreak: 8, bestStreak: 8, totalDays: 8, completedDays: 8, percentage: 100 } } });
        const statuses = evaluateAchievements(ctx, { mood_30: '2026-01-01T00:00:00Z' });
        const byId = Object.fromEntries(statuses.map(s => [s.id, s]));
        expect(byId.streak_7.unlocked).toBe(true);
        expect(byId.streak_30).toMatchObject({ unlocked: false, current: 8, progress: 8 / 30 });
        expect(byId.perfect_week.unlocked).toBe(true);
        expect(byId.mood_30).toMatchObject({ unlocked: true, current: 0 });
        expect(newlyUnlocked(statuses).sort()).toEqual(['first_step', 'perfect_day', 'perfect_week', 'streak_7']);
        expect(statuses).toHaveLength(ACHIEVEMENTS.length);
    });

    it('parses the sheet rows', () => {
        expect(rowsToUnlocked([['Id', 'UnlockedAt'], ['streak_7', '2026-10-01T10:00:00Z'], [''], ['notes_10']])).toEqual({ streak_7: '2026-10-01T10:00:00Z', notes_10: '' });
    });
});
