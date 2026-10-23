import { type Page, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const FAKE_GAPI = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-gapi.js'), 'utf8');
export const EMAIL = 'tester@example.com';
export const ALL_TABS = ['Weekdays', 'Weekend', 'Focus', 'Graphs', 'MobNotes', 'SmokeTemptation', 'Counters', 'Help'];

/** Fake Google script, stubbed server API and a signed-in session. */
export async function setupApp(context: BrowserContext, page: Page, opts: { tab?: string } = {}) {
    // gapi-script (bundled) reuses an existing window.gapi: install the fake before any page script runs
    await context.addInitScript({ content: FAKE_GAPI });
    // The app injects api.js and treats a load error as fatal: answer with an empty script, block the rest
    await context.route('https://apis.google.com/js/api.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stubbed */' }));
    await context.route('https://apis.google.com/_/**', route => route.abort());
    await context.route('https://www.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [] }) }));
    await context.route('https://accounts.google.com/**', route => route.abort());
    await context.route('**/config.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.config = { VITE_GOOGLE_CLIENT_ID: "test-client" };' }));
    await context.route('**/api/**', route => {
        const url = new URL(route.request().url());
        const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        switch (true) {
            case url.pathname === '/api/user/preferences' && route.request().method() === 'GET':
                return json({ enabled_tabs: ALL_TABS, default_tab: 'Weekdays', temptations: null });
            case url.pathname === '/api/user/apikey': return json({ has_key: false });
            case url.pathname === '/api/push/settings': return json({ enabled: false, devices: 0, prefs: { habitReminders: true, eveningReminder: true, eveningTime: '21:00', weeklyReport: true, weeklyTime: '18:00', muted: [] }, tz: null, hasRefreshToken: false });
            case url.pathname === '/api/push/public-key': return json({ key: 'BPublicKey' });
            case url.pathname === '/api/ai/status': return json({ shared: null });
            case url.pathname === '/api/changelog': return json({ content: '# Changelog\n\n## Web 1.0.0\n- Test build', hash: 'seen' });
            case url.pathname === '/api/auth/refresh': return json({ access_token: 'ya29.test', expires_in: 3599, email: EMAIL, spreadsheet_id: 'sheet-1' });
            default: return json({ success: true });
        }
    });
    await context.addInitScript(({ email, tab }) => {
        localStorage.setItem('habitikami_session_v3', JSON.stringify({ access_token: 'ya29.test', refresh_token: 'rt', expiry_date: Date.now() + 3600 * 1000, email, spreadsheet_id: 'sheet-1' }));
        localStorage.setItem('habitikami_language', 'en');
        localStorage.setItem('habitikami_tour_completed', '1');
        localStorage.setItem('lastSeenChangelogHash', 'seen');
        localStorage.setItem('habitikami_theme', 'dark');
        if (tab) localStorage.setItem('habitikami_active_view', tab);
    }, { email: EMAIL, tab: opts.tab ?? 'Weekdays' });
    await page.goto('/' + (opts.tab ? `#${opts.tab}` : ''));
}

/** Cell value in the fake sheet for today's row. */
export async function todayCell(page: Page, habit: string): Promise<string | undefined> {
    return page.evaluate((h) => {
        const f = (window as unknown as { __fakeSheets: { sheets: Record<string, string[][]>; today: string } }).__fakeSheets;
        for (const name of ['Weekdays', 'Weekend']) {
            const rows = f.sheets[name];
            const col = rows[0].indexOf(h);
            const row = rows.find(r => r[1] === f.today);
            if (row && col !== -1) return row[col];
        }
        return undefined;
    }, habit);
}

export async function todayDate(page: Page): Promise<string> {
    return page.evaluate(() => (window as unknown as { __fakeSheets: { today: string } }).__fakeSheets.today);
}
