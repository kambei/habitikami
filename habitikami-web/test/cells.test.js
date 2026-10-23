import { describe, expect, it } from 'vitest';
import { columnLetter, locateCell, normalizeCellValue, sheetForDate, toSheetDate, todaySummary } from '../cells.js';

const rows = [
    ['Habitikami', '', ''],
    ['Giorno', 'Date', 'Run', 'Read', 'Water'],
    ['Lunedì', '20/10/2026', 'TRUE', 'FALSE', '3'],
    ['Martedì', '21/10/2026', 'HALF', 'SKIP', ''],
];

describe('cells helpers', () => {
    it('converts dates and picks the sheet', () => {
        expect(toSheetDate('2026-10-21')).toBe('21/10/2026');
        expect(toSheetDate('1/2/2026')).toBe('01/02/2026');
        expect(toSheetDate('nope')).toBeNull();
        expect(sheetForDate('24/10/2026')).toBe('Weekend');
        expect(sheetForDate('21/10/2026')).toBe('Weekdays');
        expect(columnLetter(0)).toBe('A');
        expect(columnLetter(27)).toBe('AB');
    });

    it('locates a cell by date and habit, case-insensitively', () => {
        expect(locateCell(rows, '21/10/2026', 'read')).toEqual({ rowIndex: 3, colIndex: 3, headerRowIndex: 1 });
        expect(locateCell(rows, '22/10/2026', 'Read')).toEqual({ error: 'row not found' });
        expect(locateCell(rows, '21/10/2026', 'Sleep')).toEqual({ error: 'habit not found' });
        expect(locateCell(rows, '21/10/2026', 'Date')).toEqual({ error: 'habit not found' });
        expect(locateCell([], '21/10/2026', 'Read')).toEqual({ error: 'header row not found' });
    });

    it('normalizes values', () => {
        expect(normalizeCellValue('true')).toBe('TRUE');
        expect(normalizeCellValue(false)).toBe('FALSE');
        expect(normalizeCellValue('half')).toBe('HALF');
        expect(normalizeCellValue('2,5')).toBe(2.5);
        expect(normalizeCellValue(4)).toBe(4);
        expect(normalizeCellValue('maybe')).toBeNull();
        expect(normalizeCellValue(-1)).toBeNull();
    });

    it("summarizes today's row with meta and colours", () => {
        const s = todaySummary(rows, '20/10/2026', { Water: { type: 'number', target: 8, slot: 'morning' } }, { Run: '#ff0000' });
        expect(s.found).toBe(true);
        expect(s.habits.map(h => [h.name, h.value, h.done])).toEqual([['Run', 'TRUE', true], ['Read', 'FALSE', false], ['Water', '3', false]]);
        expect(s.habits[2]).toMatchObject({ type: 'number', target: 8, slot: 'morning' });
        expect(s.habits[0].color).toBe('#ff0000');
        const missing = todaySummary(rows, '25/10/2026');
        expect(missing.found).toBe(false);
        expect(missing.habits.map(h => h.value)).toEqual([null, null, null]);
    });
});
