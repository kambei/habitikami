/**
 * Wraps a dynamic import for React.lazy so a chunk that no longer exists on
 * the server (the page was loaded before a deploy and the hashed file names
 * changed) does not leave the tab broken: the page is reloaded with a fresh
 * cache-busting query (`?v=…`), which gets a new index.html even through a
 * browser or CDN cache that ignores Cache-Control. Two attempts, then the
 * error surfaces (ViewErrorBoundary).
 */
const ATTEMPTS_KEY = 'habitikami_chunk_reload';
const MAX_ATTEMPTS = 2;

function attempts(): number {
    try { return parseInt(sessionStorage.getItem(ATTEMPTS_KEY) || '0', 10) || 0; } catch { return 0; }
}

function cleanUrl() {
    try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('v')) {
            url.searchParams.delete('v');
            history.replaceState(history.state, '', url.toString());
        }
    } catch { /* ignore */ }
}

export function lazyImport<T>(importer: () => Promise<T>): () => Promise<T> {
    return () => importer().then(m => {
        try { sessionStorage.removeItem(ATTEMPTS_KEY); } catch { /* ignore */ }
        cleanUrl();
        return m;
    }).catch(err => {
        const n = attempts();
        if (n >= MAX_ATTEMPTS) throw err;
        try { sessionStorage.setItem(ATTEMPTS_KEY, String(n + 1)); } catch { /* ignore */ }
        const url = new URL(window.location.href);
        url.searchParams.set('v', Date.now().toString(36));
        window.location.replace(url.toString());
        return new Promise<T>(() => {}); // the reload takes over
    });
}
