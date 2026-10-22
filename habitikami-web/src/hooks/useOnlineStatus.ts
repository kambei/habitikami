import { useSyncExternalStore } from 'react';
import { queueSize, subscribeQueue } from '../utils/offlineQueue';

function subscribeOnline(cb: () => void) {
    window.addEventListener('online', cb);
    window.addEventListener('offline', cb);
    return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); };
}

/** Browser connectivity, updated on the online/offline events. */
export function useOnlineStatus(): boolean {
    return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

/** Number of writes waiting in the offline queue. */
export function usePendingWrites(): number {
    return useSyncExternalStore(subscribeQueue, queueSize, () => 0);
}
