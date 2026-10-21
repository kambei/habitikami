/**
 * Pairing of the Android home screen widgets with this server.
 *
 * The Android app registers the `web+habitikami://widget-config` scheme
 * (WidgetPairingActivity): opening such a link on the phone stores the server
 * URL and the API key in the encrypted widget store and refreshes every widget,
 * so the key never has to be typed by hand.
 *
 * From a desktop browser the same data is shown as a QR code. The QR encodes a
 * regular https link to this app (so any camera app can open it) with the data
 * in the hash fragment, which never reaches the server; the page then forwards
 * to the custom scheme (see `redirectPairingLink`).
 */
export const PAIRING_SCHEME = 'web+habitikami';
export const PAIRING_PATH = '/widget-config';

export function buildPairingUri(apiKey: string, serverUrl: string = window.location.origin): string {
    const params = new URLSearchParams({ url: serverUrl, key: apiKey });
    return `${PAIRING_SCHEME}://widget-config?${params.toString()}`;
}

export function buildPairingWebUrl(apiKey: string, serverUrl: string = window.location.origin): string {
    const params = new URLSearchParams({ url: serverUrl, key: apiKey });
    return `${serverUrl}${PAIRING_PATH}#${params.toString()}`;
}

export function isAndroidBrowser(ua: string = navigator.userAgent || ''): boolean {
    return /Android/i.test(ua);
}

/**
 * When the page was opened from a pairing QR (`/widget-config#url=…&key=…`),
 * forwards to the custom scheme so the Android app picks it up, then cleans
 * the URL. Returns true when a redirect was issued.
 */
export function redirectPairingLink(
    loc: { pathname: string; hash: string; href: string } = window.location,
    hist: { replaceState: (data: unknown, unused: string, url: string) => void } = window.history,
): boolean {
    if (loc.pathname !== PAIRING_PATH) return false;
    const params = new URLSearchParams(loc.hash.replace(/^#/, ''));
    const key = params.get('key');
    const url = params.get('url');
    hist.replaceState(null, '', '/');
    if (!key || !url) return false;
    loc.href = buildPairingUri(key, url);
    return true;
}
