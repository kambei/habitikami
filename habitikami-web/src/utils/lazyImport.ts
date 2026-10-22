/**
 * Wraps a dynamic import for React.lazy so a chunk that no longer exists on
 * the server (the page was loaded before a deploy and the hashed file names
 * changed) reloads the page once instead of leaving the tab broken.
 */
const RELOAD_KEY = 'habitikami_chunk_reload';

export function lazyImport<T>(importer: () => Promise<T>): () => Promise<T> {
    return () => importer().then(m => {
        try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ }
        return m;
    }).catch(err => {
        let reloaded = false;
        try {
            reloaded = sessionStorage.getItem(RELOAD_KEY) === '1';
            if (!reloaded) sessionStorage.setItem(RELOAD_KEY, '1');
        } catch { /* ignore */ }
        if (!reloaded) {
            window.location.reload();
            return new Promise<T>(() => {}); // the reload takes over
        }
        throw err;
    });
}
