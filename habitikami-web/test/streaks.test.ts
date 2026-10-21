import { describe, expect, it } from 'vitest';
import { collectHabitDays, computeStreaks, habitStreakStats, longestCurrentStreak, type HabitDay } from '../src/utils/streaks';
import type { HabitData } from '../src/types';

const TODAY = new Date(2026, 9, 21); // 21 Oct 2026

function day(offsetFromToday: number, value: HabitDay['value']): HabitDay {
    const date = new Date(TODAY);
    date.setDate(date.getDate() + offsetFromToday);
    return { date, value };
}

describe('computeStreaks (rules D1)', () => {
    it('counts consecutive done days up to today', () => {
        const s = computeStreaks([day(-3, true), day(-2, true), day(-1, true), day(0, true)], TODAY);
        expect(s.currentStreak).toBe(4);
        expect(s.bestStreak).toBe(4);
    });

    it('HALF continues the streak and counts as completed', () => {
        const s = computeStreaks([day(-2, true), day(-1, 'half'), day(0, true)], TODAY);
        expect(s.currentStreak).toBe(3);
        expect(s.completed).toBe(3);
        expect(s.percentage).toBe(100);
    });

    it('SKIP is neutral: neither breaks nor extends, excluded from the rate', () => {
        const s = computeStreaks([day(-3, true), day(-2, 'skipped'), day(-1, true), day(0, true)], TODAY);
        expect(s.currentStreak).toBe(3);
        expect(s.bestStreak).toBe(3);
        expect(s.total).toBe(3);
        expect(s.completed).toBe(3);
    });

    it('FALSE on a past day breaks the current streak', () => {
        const s = computeStreaks([day(-3, true), day(-2, true), day(-1, false), day(0, true)], TODAY);
        expect(s.currentStreak).toBe(1);
        expect(s.bestStreak).toBe(2);
        expect(s.percentage).toBe(75);
    });

    it('an unchecked today is pending, not a miss', () => {
        const s = computeStreaks([day(-2, true), day(-1, true), day(0, false)], TODAY);
        expect(s.currentStreak).toBe(2);
    });

    it('a missed day before today ends the streak even with today unchecked', () => {
        const s = computeStreaks([day(-2, true), day(-1, false), day(0, false)], TODAY);
        expect(s.currentStreak).toBe(0);
    });

    it('calendar gaps (no row) are neutral', () => {
        // Friday done, no weekend rows, Monday done
        const s = computeStreaks([day(-4, true), day(-1, true), day(0, true)], TODAY);
        expect(s.currentStreak).toBe(3);
    });

    it('handles empty input', () => {
        expect(computeStreaks([], TODAY)).toEqual({ currentStreak: 0, bestStreak: 0, completed: 0, total: 0, percentage: 0 });
    });
});

describe('collectHabitDays', () => {
    const weekdays: HabitData[] = [
        { day: 'Venerdì', date: '16/10/2026', habits: { Read: true, Gym: false } },
        { day: 'Lunedì', date: '19/10/2026', habits: { Read: true, Gym: true } },
    ];
    const weekend: HabitData[] = [
        { day: 'Sabato', date: '17/10/2026', habits: { Read: 'skipped' } },
        { day: 'Domenica', date: '18/10/2026', habits: { Read: true } },
    ];

    it('merges sheets that contain the habit, sorted by date', () => {
        const days = collectHabitDays('Read', weekdays, weekend);
        expect(days.map(d => d.date.getDate())).toEqual([16, 17, 18, 19]);
        expect(days.map(d => d.value)).toEqual([true, 'skipped', true, true]);
    });

    it('ignores sheets without the habit', () => {
        const days = collectHabitDays('Gym', weekdays, weekend);
        expect(days.map(d => d.date.getDate())).toEqual([16, 19]);
    });

    it('a done value wins when two sheets share a date', () => {
        const dup: HabitData[] = [{ day: 'Lunedì', date: '19/10/2026', habits: { Read: false } }];
        const days = collectHabitDays('Read', weekdays, dup);
        expect(days.find(d => d.date.getDate() === 19)?.value).toBe(true);
    });

    it('habitStreakStats and longestCurrentStreak combine the pieces', () => {
        const today = new Date(2026, 9, 19);
        expect(habitStreakStats('Read', [weekdays, weekend], today).currentStreak).toBe(3);
        expect(longestCurrentStreak([weekdays, weekend], today)).toEqual({ habit: 'Read', streak: 3 });
    });
});
