import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { habitService } from '../services/HabitService';
import { translate } from '../i18n';
import { enqueue, isNetworkError, readQueue, writeQueue, type QueuedOp } from './offlineQueue';

/**
 * Replays the offline queue (issue #16). Cells: last write wins, with a toast
 * when the server value changed meanwhile. Counters: incremented once per
 * queued tap. Notes: last text wins. A network failure stops the replay and
 * keeps the rest for the next attempt; any other failure drops the entry
 * after a warning, so one bad write cannot block the queue forever.
 */

const MAX_ATTEMPTS = 5;
let replaying: Promise<number> | null = null;

function normalize(v: unknown): string {
    if (v === true) return 'TRUE';
    if (v === false) return 'FALSE';
    return String(v ?? '').trim().toUpperCase();
}

async function apply(op: QueuedOp): Promise<void> {
    if (op.kind === 'cell') {
        if (op.previousValue !== undefined) {
            const remote = await habitService.getCellValue(op.sheetName, op.rowIndex, op.colIndex);
            if (!('error' in remote) && normalize(remote.value) !== normalize(op.previousValue) && normalize(remote.value) !== normalize(op.value)) {
                toast.warning(translate('offlineConflict', { habit: op.habitName ?? '', date: op.date ?? '' }));
            }
        }
        const res = await habitService.updateCell(op.sheetName, op.rowIndex, op.colIndex, op.value);
        if ('error' in res) throw Object.assign(new Error(res.error), { fromResult: true });
    } else if (op.kind === 'counter') {
        const res = await habitService.incrementCounter(op.counterName);
        if (res && res.error) throw Object.assign(new Error(res.error), { fromResult: true });
    } else if (op.kind === 'note') {
        const res = await habitService.setHabitNote(op.date, op.habit, op.note);
        if ('error' in res) throw Object.assign(new Error(res.error), { fromResult: true });
    }
}

/** Replays what it can; resolves with the number of entries written. */
export function replayQueue(queryClient?: QueryClient): Promise<number> {
    if (replaying) return replaying;
    replaying = (async () => {
        let done = 0;
        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;
            let queue = readQueue();
            while (queue.length > 0) {
                const op = queue[0];
                try {
                    await apply(op);
                    done++;
                    queue = readQueue().filter(q => q.id !== op.id);
                    writeQueue(queue);
                } catch (e) {
                    if (isNetworkError(e)) break; // still offline: keep everything
                    const attempts = op.attempts + 1;
                    queue = readQueue().filter(q => q.id !== op.id);
                    if (attempts < MAX_ATTEMPTS) {
                        queue.push({ ...op, attempts });
                        writeQueue(queue);
                        break; // retry later, keep order
                    }
                    writeQueue(queue);
                    toast.error(translate('offlineDropped', { error: e instanceof Error ? e.message : translate('toastUnknownError') }));
                }
            }
            if (done > 0) {
                toast.success(translate('offlineSynced', { n: done }));
                if (queryClient) {
                    await Promise.all([
                        queryClient.invalidateQueries({ queryKey: ['sheetData'] }),
                        queryClient.invalidateQueries({ queryKey: ['habitNotes'] }),
                        queryClient.invalidateQueries({ queryKey: ['counters'] }),
                        queryClient.invalidateQueries({ queryKey: ['widgetCounters'] }),
                    ]);
                    window.dispatchEvent(new CustomEvent('habitDataChanged'));
                }
            }
            return done;
        } finally {
            replaying = null;
        }
    })();
    return replaying;
}

/** Replays on start and whenever the browser comes back online; returns the stop function. */
export function startOfflineSync(queryClient: QueryClient): () => void {
    const onOnline = () => { replayQueue(queryClient).catch(() => {}); };
    window.addEventListener('online', onOnline);
    const timer = window.setTimeout(onOnline, 1500);
    return () => { window.removeEventListener('online', onOnline); window.clearTimeout(timer); };
}

/** Increments a counter now, or queues the tap when there is no network. */
export async function incrementCounterOfflineAware(counterName: string): Promise<{ success?: boolean; queued?: boolean; error?: string }> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueue({ kind: 'counter', counterName });
        toast.info(translate('offlineQueuedChange'));
        return { success: true, queued: true };
    }
    try {
        const res = await habitService.incrementCounter(counterName);
        if (res && res.error && isNetworkError(res)) {
            enqueue({ kind: 'counter', counterName });
            toast.info(translate('offlineQueuedChange'));
            return { success: true, queued: true };
        }
        return res;
    } catch (e) {
        if (isNetworkError(e)) {
            enqueue({ kind: 'counter', counterName });
            toast.info(translate('offlineQueuedChange'));
            return { success: true, queued: true };
        }
        throw e;
    }
}
