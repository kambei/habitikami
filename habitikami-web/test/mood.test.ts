import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { moodEntryToRow, queuePendingMoodEntry, readPendingMoodEntries, rowToMoodEntry, rowsToMoodEntries, writePendingMoodEntries, MOOD_PENDING_KEY } from '../src/utils/mood';
import type { MoodEntry } from '../src/types';

const entry: MoodEntry = { date: '2026-10-21T08:00:00.000Z', timestamp: 1792569600000, mood: 72, anxiety: 31, label: 'Guided Session', source: 'chat' };

describe('mood rows', () => {
    it('round-trips an entry through a sheet row', () => {
        expect(moodEntryToRow(entry)).toEqual(['2026-10-21T08:00:00.000Z', 1792569600000, 72, 31, 'Guided Session', 'chat']);
        expect(rowToMoodEntry(moodEntryToRow(entry))).toEqual(entry);
    });

    it('clamps scores to 0-100 and rounds', () => {
        expect(moodEntryToRow({ ...entry, mood: 140.4, anxiety: -3 }).slice(2, 4)).toEqual([100, 0]);
    });

    it('derives the timestamp from the date when the cell is empty', () => {
        const e = rowToMoodEntry(['2026-10-21T08:00:00.000Z', '', '50', '50', 'x', '']);
        expect(e?.timestamp).toBe(Date.parse('2026-10-21T08:00:00.000Z'));
        expect(e?.source).toBeUndefined();
    });

    it('rejects rows without date or scores', () => {
        expect(rowToMoodEntry(['', '1', '50', '50'])).toBeNull();
        expect(rowToMoodEntry(['2026-10-21', '1', 'n/a', '50'])).toBeNull();
        expect(rowToMoodEntry(undefined)).toBeNull();
    });

    it('skips the header and sorts by time', () => {
        const rows = [
            ['Date', 'Timestamp', 'Mood', 'Anxiety', 'Label', 'Source'],
            ['2026-10-21T09:00:00.000Z', '200', '60', '40', 'b', 'worksheet'],
            ['2026-10-21T08:00:00.000Z', '100', '70', '30', 'a', 'chat'],
            ['bad row'],
        ];
        expect(rowsToMoodEntries(rows).map(e => e.label)).toEqual(['a', 'b']);
    });
});

describe('pending outbox in localStorage', () => {
    const store = new Map<string, string>();
    beforeEach(() => {
        store.clear();
        globalThis.localStorage = {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => { store.set(k, v); },
            removeItem: (k: string) => { store.delete(k); },
            clear: () => store.clear(),
            key: () => null,
            length: 0,
        } as unknown as Storage;
    });
    afterEach(() => {
        // @ts-expect-error cleanup of the test double
        delete globalThis.localStorage;
    });

    it('reads the legacy history as pending entries', () => {
        store.set(MOOD_PENDING_KEY, JSON.stringify([entry, { junk: true }]));
        expect(readPendingMoodEntries()).toEqual([entry]);
    });

    it('queues and clears', () => {
        queuePendingMoodEntry(entry);
        queuePendingMoodEntry({ ...entry, label: 'second' });
        expect(readPendingMoodEntries()).toHaveLength(2);
        writePendingMoodEntries([]);
        expect(store.has(MOOD_PENDING_KEY)).toBe(false);
    });

    it('tolerates corrupt storage', () => {
        store.set(MOOD_PENDING_KEY, '{not json');
        expect(readPendingMoodEntries()).toEqual([]);
    });
});
