/**
 * Offline queue (issue #16): writes that failed for lack of network wait in
 * localStorage and are replayed by utils/offlineSync.ts when the browser is
 * back online. Each entry is self-contained so a reload does not lose it.
 */

export type QueuedOp =
    | { id: string; kind: 'cell'; sheetName: string; rowIndex: number; colIndex: number; value: boolean | 'SKIP' | 'HALF' | number; habitName?: string; date?: string; previousValue?: string; createdAt: number; attempts: number }
    | { id: string; kind: 'counter'; counterName: string; createdAt: number; attempts: number }
    | { id: string; kind: 'note'; date: string; habit: string; note: string; createdAt: number; attempts: number };

export const OFFLINE_QUEUE_KEY = 'habitikami_offline_queue';
const EVENT = 'habitikami:offline-queue';

export function readQueue(): QueuedOp[] {
    try {
        const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function writeQueue(queue: QueuedOp[]): void {
    try {
        if (queue.length === 0) localStorage.removeItem(OFFLINE_QUEUE_KEY);
        else localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch { /* storage full or unavailable: the change is lost, the UI already warned */ }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

function newId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type NewOp = DistributiveOmit<QueuedOp, 'id' | 'createdAt' | 'attempts'>;

/** Adds an operation; a later write to the same cell or note replaces the earlier one. */
export function enqueue(op: NewOp): QueuedOp {
    const queue = readQueue().filter(q => !sameTarget(q, op));
    const full = { ...op, id: newId(), createdAt: Date.now(), attempts: 0 } as QueuedOp;
    queue.push(full);
    writeQueue(queue);
    return full;
}

function sameTarget(a: Pick<QueuedOp, 'kind'> & Record<string, unknown>, b: Pick<QueuedOp, 'kind'> & Record<string, unknown>): boolean {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'cell') return a.sheetName === b.sheetName && a.rowIndex === b.rowIndex && a.colIndex === b.colIndex;
    if (a.kind === 'note') return a.date === b.date && a.habit === b.habit;
    return false; // counters accumulate
}

export function removeOp(id: string): void {
    writeQueue(readQueue().filter(q => q.id !== id));
}

export function queueSize(): number {
    return readQueue().length;
}

/** Notifies on every change of the queue (same tab); returns the unsubscribe. */
export function subscribeQueue(cb: () => void): () => void {
    window.addEventListener(EVENT, cb);
    window.addEventListener('storage', cb);
    return () => { window.removeEventListener(EVENT, cb); window.removeEventListener('storage', cb); };
}

/**
 * True when an error (or a `{ error }` result) looks like a connectivity
 * problem rather than a rejected request: the browser says offline, a fetch
 * failed before any response, or gapi returned no HTTP status.
 */
export function isNetworkError(e: unknown): boolean {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    const err = e as { status?: number; message?: string; error?: string; result?: unknown } | null;
    if (!err) return false;
    if (typeof err.status === 'number' && (err.status === 0 || err.status === -1)) return true;
    const msg = String(err.message ?? err.error ?? '');
    return /failed to fetch|networkerror|network request failed|load failed|the internet connection|offline|ERR_INTERNET_DISCONNECTED|ERR_NETWORK/i.test(msg);
}
