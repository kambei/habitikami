/** Browser side of the push reminders: feature detection and subscription helpers. */

export function isPushSupported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
}

/** Current subscription of this browser, if any. */
export async function currentPushSubscription(): Promise<PushSubscription | null> {
    if (!isPushSupported()) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
}

/** Asks permission and subscribes this browser with the server's VAPID key. */
export async function subscribeBrowser(publicKey: string): Promise<PushSubscription> {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('permission-denied');
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;
    return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource });
}
