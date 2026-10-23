/** Light/dark theme: follows the system by default, with a manual override (issue #125). */
export type ThemePref = 'system' | 'dark' | 'light';
const KEY = 'habitikami_theme';

export function getThemePref(): ThemePref {
    try {
        const v = localStorage.getItem(KEY);
        return v === 'dark' || v === 'light' ? v : 'system';
    } catch {
        return 'system';
    }
}

export function resolveTheme(pref: ThemePref = getThemePref()): 'dark' | 'light' {
    if (pref !== 'system') return pref;
    try {
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch {
        return 'dark';
    }
}

export function applyTheme(pref: ThemePref = getThemePref()): void {
    const theme = resolveTheme(pref);
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f7f7f8' : '#1a1a1a');
}

export function setThemePref(pref: ThemePref): void {
    try { localStorage.setItem(KEY, pref); } catch { /* ignore */ }
    applyTheme(pref);
    window.dispatchEvent(new Event('habitikami:theme'));
}

/** Re-applies the system theme when it changes; returns the stop function. */
export function watchSystemTheme(): () => void {
    try {
        const mq = window.matchMedia('(prefers-color-scheme: light)');
        const onChange = () => { if (getThemePref() === 'system') applyTheme('system'); };
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    } catch {
        return () => {};
    }
}
