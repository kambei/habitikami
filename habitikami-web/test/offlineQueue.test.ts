import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueue, isNetworkError, readQueue, removeOp, queueSize, OFFLINE_QUEUE_KEY } from '../src/utils/offlineQueue';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
});
vi.stubGlobal('window', { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} });
vi.stubGlobal('Event', class { constructor(public type: string) {} });

describe('offline queue', () => {
    beforeEach(() => store.clear());

    it('keeps the last write per cell and note, accumulates counters', () => {
        enqueue({ kind: 'cell', sheetName: 'Weekdays', rowIndex: 5, colIndex: 3, value: true });
        enqueue({ kind: 'cell', sheetName: 'Weekdays', rowIndex: 5, colIndex: 3, value: 'HALF' });
        enqueue({ kind: 'cell', sheetName: 'Weekdays', rowIndex: 6, colIndex: 3, value: true });
        enqueue({ kind: 'note', date: '01/10/2026', habit: 'Run', note: 'a' });
        enqueue({ kind: 'note', date: '01/10/2026', habit: 'Run', note: 'b' });
        enqueue({ kind: 'counter', counterName: 'smoke' });
        enqueue({ kind: 'counter', counterName: 'smoke' });
        const q = readQueue();
        expect(q.map(o => o.kind)).toEqual(['cell', 'cell', 'note', 'counter', 'counter']);
        expect(q[0]).toMatchObject({ rowIndex: 5, value: 'HALF', attempts: 0 });
        expect(q[2]).toMatchObject({ note: 'b' });
        expect(queueSize()).toBe(5);
    });

    it('removes entries and clears the storage key when empty', () => {
        const op = enqueue({ kind: 'counter', counterName: 'x' });
        removeOp(op.id);
        expect(readQueue()).toEqual([]);
        expect(store.has(OFFLINE_QUEUE_KEY)).toBe(false);
    });

    it('survives corrupted storage', () => {
        store.set(OFFLINE_QUEUE_KEY, '{not json');
        expect(readQueue()).toEqual([]);
    });

    it('tells connectivity errors from rejected requests', () => {
        vi.stubGlobal('navigator', { onLine: true });
        expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
        expect(isNetworkError({ status: 0, result: false })).toBe(true);
        expect(isNetworkError({ error: 'Load failed' })).toBe(true);
        expect(isNetworkError({ status: 403, message: 'Forbidden' })).toBe(false);
        expect(isNetworkError(new Error('Unable to parse range'))).toBe(false);
        vi.stubGlobal('navigator', { onLine: false });
        expect(isNetworkError(new Error('anything'))).toBe(true);
    });
});
