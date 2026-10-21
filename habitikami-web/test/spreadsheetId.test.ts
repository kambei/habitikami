import { describe, expect, it } from 'vitest';
import { extractSpreadsheetId } from '../src/utils/spreadsheetId';

const ID = '1aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789-_abc';

describe('extractSpreadsheetId', () => {
    it('returns a bare id unchanged (trimmed)', () => {
        expect(extractSpreadsheetId(`  ${ID} `)).toBe(ID);
    });

    it('extracts the id from the usual edit URL', () => {
        expect(extractSpreadsheetId(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`)).toBe(ID);
        expect(extractSpreadsheetId(`https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing`)).toBe(ID);
        expect(extractSpreadsheetId(`https://docs.google.com/spreadsheets/d/${ID}`)).toBe(ID);
    });

    it('handles the /u/N/ account prefix', () => {
        expect(extractSpreadsheetId(`https://docs.google.com/spreadsheets/u/1/d/${ID}/edit`)).toBe(ID);
    });

    it('rejects empty, short and free-text input', () => {
        expect(extractSpreadsheetId('')).toBeNull();
        expect(extractSpreadsheetId('abc')).toBeNull();
        expect(extractSpreadsheetId('my sheet')).toBeNull();
        expect(extractSpreadsheetId('https://docs.google.com/spreadsheets/')).toBeNull();
    });
});
