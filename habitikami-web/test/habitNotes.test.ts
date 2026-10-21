import { describe, expect, it } from 'vitest';
import { noteKey, rowsToHabitNotes, searchHabitNotes } from '../src/utils/habitNotes';

const rows = [
    ['Date', 'Habit', 'Note'],
    ['19/10/2026', 'Read', 'Ten pages of Dune'],
    ['20/10/2026', 'Read', ''],
    ['20/10/2026', 'Gym', 'Legs, felt strong'],
    ['', 'Gym', 'orphan'],
];

describe('habit notes', () => {
    it('parses rows into a map keyed by date and habit with row indexes', () => {
        const notes = rowsToHabitNotes(rows);
        expect(notes.size).toBe(3);
        expect(notes.get(noteKey('20/10/2026', 'Gym'))).toEqual({ date: '20/10/2026', habit: 'Gym', note: 'Legs, felt strong', rowIndex: 3 });
    });

    it('searches text, habit and date, newest first, ignoring empty notes', () => {
        const notes = rowsToHabitNotes(rows).values();
        expect(searchHabitNotes(notes, '').map(n => n.habit)).toEqual(['Gym', 'Read']);
        expect(searchHabitNotes(rowsToHabitNotes(rows).values(), 'dune').map(n => n.date)).toEqual(['19/10/2026']);
        expect(searchHabitNotes(rowsToHabitNotes(rows).values(), 'gym')).toHaveLength(1);
        expect(searchHabitNotes(rowsToHabitNotes(rows).values(), '19/10')).toHaveLength(1);
    });
});
