import { describe, expect, it } from 'vitest';
import { parseCell, parseSheetData } from '../src/utils/parser';

describe('parseCell', () => {
    it('maps checkbox and marker cells', () => {
        expect(parseCell('TRUE')).toBe(true);
        expect(parseCell(true)).toBe(true);
        expect(parseCell('FALSE')).toBe(false);
        expect(parseCell('')).toBe(false);
        expect(parseCell(undefined)).toBe(false);
        expect(parseCell('SKIP')).toBe('skipped');
        expect(parseCell('HALF')).toBe('half');
    });

    it('maps numeric cells of quantitative habits to numbers', () => {
        expect(parseCell('6')).toBe(6);
        expect(parseCell(' 6 ')).toBe(6);
        expect(parseCell('6.5')).toBe(6.5);
        expect(parseCell('6,5')).toBe(6.5);
        expect(parseCell('0')).toBe(0);
        expect(parseCell(12)).toBe(12);
    });

    it('does not treat free text as a number', () => {
        expect(parseCell('yes')).toBe(false);
        expect(parseCell('6/8')).toBe(false);
    });
});

describe('parseSheetData', () => {
    it('keeps numbers next to checkbox values', () => {
        const parsed = parseSheetData([
            ['Giorno', 'Data', 'Read', 'Water'],
            ['Lunedì', '19/10/2026', 'TRUE', '6'],
            ['Martedì', '20/10/2026', 'HALF', '8,5'],
        ]);
        expect(parsed.headers).toEqual(['Read', 'Water']);
        expect(parsed.data[0].habits).toEqual({ Read: true, Water: 6 });
        expect(parsed.data[1].habits).toEqual({ Read: 'half', Water: 8.5 });
        expect(parsed.meta.startCol).toBe(2);
    });
});
