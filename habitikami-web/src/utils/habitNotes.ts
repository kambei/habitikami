import type { HabitNote } from '../types';

/**
 * Per-habit daily notes live in the `HabitNotes` sheet:
 *
 *   Date | Habit | Note
 *
 * Date is DD/MM/YYYY like the habit grids, one row per (date, habit).
 */
export const HABIT_NOTES_SHEET = 'HabitNotes';
export const HABIT_NOTES_COLUMNS = ['Date', 'Habit', 'Note'] as const;
export const HABIT_NOTES_RANGE = `${HABIT_NOTES_SHEET}!A:C`;

export function noteKey(date: string, habit: string): string {
    return `${date.trim()}|${habit.trim()}`;
}

/** Rows of the sheet (header optional) → notes keyed by date|habit, with their 0-based row index. */
export function rowsToHabitNotes(rows: readonly (readonly unknown[])[]): Map<string, HabitNote & { rowIndex: number }> {
    const out = new Map<string, HabitNote & { rowIndex: number }>();
    const start = rows[0] && typeof rows[0][0] === 'string' && /^date$/i.test(rows[0][0].trim()) ? 1 : 0;
    for (let i = start; i < rows.length; i++) {
        const row = rows[i] ?? [];
        const date = String(row[0] ?? '').trim();
        const habit = String(row[1] ?? '').trim();
        const note = String(row[2] ?? '').trim();
        if (!date || !habit) continue;
        out.set(noteKey(date, habit), { date, habit, note, rowIndex: i });
    }
    return out;
}

/** Case-insensitive search over note text, habit and date. */
export function searchHabitNotes(notes: Iterable<HabitNote>, query: string): HabitNote[] {
    const q = query.trim().toLowerCase();
    const list = [...notes].filter(n => n.note);
    const matches = q ? list.filter(n => n.note.toLowerCase().includes(q) || n.habit.toLowerCase().includes(q) || n.date.includes(q)) : list;
    return matches.sort((a, b) => toSortable(b.date).localeCompare(toSortable(a.date)) || a.habit.localeCompare(b.habit));
}

function toSortable(ddmmyyyy: string): string {
    const [d, m, y] = ddmmyyyy.split('/');
    return y && m && d ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : ddmmyyyy;
}
