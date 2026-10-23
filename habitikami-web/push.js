// Web push reminders (issue #11): subscriptions per user, VAPID keys and the
// minute scheduler that sends habit reminders, the evening "N habits left"
// nudge and the weekly report. Pure logic takes its collaborators through
// `createPushService(deps)` so the test suite can drive it with fake sheets.
import webpush from 'web-push';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const SLOT_TIMES = { morning: '08:00', afternoon: '14:00', evening: '19:00' };
export const DEFAULT_PREFS = {
    habitReminders: true,
    eveningReminder: true,
    eveningTime: '21:00',
    weeklyReport: true,
    weeklyTime: '18:00',
    muted: [],
};
const META_CACHE_MS = 15 * 60 * 1000;
const ACTION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Local "YYYY-MM-DD", "HH:MM" and weekday (0 = Sunday) of `date` in `tz`. */
export function localClock(date, tz) {
    let parts;
    try {
        parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(date);
    } catch {
        parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(date);
    }
    const get = t => parts.find(p => p.type === t)?.value ?? '';
    const hour = get('hour') === '24' ? '00' : get('hour');
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { day: `${get('year')}-${get('month')}-${get('day')}`, time: `${hour}:${get('minute')}`, weekday, dateKey: `${get('day')}/${get('month')}/${get('year')}` };
}

/** True when a raw sheet cell counts as done (TRUE, HALF, SKIP or a number at goal). */
export function cellIsDone(raw, target) {
    const s = raw === undefined || raw === null ? '' : String(raw).trim().toUpperCase();
    if (s === 'TRUE' || s === 'HALF' || s === 'SKIP') return true;
    const n = parseFloat(s.replace(',', '.'));
    if (Number.isFinite(n)) return target ? n >= target : n > 0;
    return false;
}

/** Habits of today's row that are still pending, given rows as objects (rowsToObjects). */
export function pendingHabits(rows, dateKey, habitMeta = {}) {
    const row = rows.find(r => Object.values(r).some(v => String(v ?? '').trim() === dateKey));
    if (!row) return null;
    const pending = [];
    for (const [name, raw] of Object.entries(row)) {
        if (/^(date|giorno|day|data)$/i.test(name)) continue;
        if (!cellIsDone(raw, habitMeta[name]?.target)) pending.push(name);
    }
    return pending;
}

/** Reminder time of a habit: HabitMeta.Time, else its slot's default, else null. */
export function reminderTime(meta) {
    if (!meta) return null;
    if (meta.time && TIME_RE.test(meta.time)) return meta.time.padStart(5, '0');
    return SLOT_TIMES[meta.slot] ?? null;
}

export function sanitizePrefs(input = {}, base = DEFAULT_PREFS) {
    const out = { ...base };
    for (const k of ['habitReminders', 'eveningReminder', 'weeklyReport']) if (typeof input[k] === 'boolean') out[k] = input[k];
    for (const k of ['eveningTime', 'weeklyTime']) if (typeof input[k] === 'string' && TIME_RE.test(input[k])) out[k] = input[k].padStart(5, '0');
    if (Array.isArray(input.muted)) out.muted = input.muted.filter(h => typeof h === 'string' && h.length <= 100).slice(0, 200);
    return out;
}

/** Weekly figures from the rows of the last 14 days. */
export function weeklyFigures(rows, today, habitMeta = {}) {
    const dayMs = 86400000;
    const base = new Date(`${today}T12:00:00Z`).getTime();
    const stats = { cur: { done: 0, total: 0 }, prev: { done: 0, total: 0 } };
    const perHabit = {};
    for (const r of rows) {
        let m = null;
        for (const v of Object.values(r)) { m = String(v ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) break; }
        if (!m) continue;
        const t = Date.UTC(+m[3], +m[2] - 1, +m[1], 12);
        const age = Math.round((base - t) / dayMs);
        const bucket = age >= 0 && age < 7 ? 'cur' : age >= 7 && age < 14 ? 'prev' : null;
        if (!bucket) continue;
        for (const [name, raw] of Object.entries(r)) {
            if (/^(date|giorno|day|data)$/i.test(name)) continue;
            const s = String(raw ?? '').trim().toUpperCase();
            if (s === 'SKIP' || s === '') continue;
            const done = cellIsDone(raw, habitMeta[name]?.target);
            stats[bucket].total++;
            if (done) stats[bucket].done++;
            if (bucket === 'cur') {
                perHabit[name] = perHabit[name] || { done: 0, total: 0 };
                perHabit[name].total++;
                if (done) perHabit[name].done++;
            }
        }
    }
    const rate = s => (s.total ? Math.round((s.done / s.total) * 100) : null);
    const ranked = Object.entries(perHabit).map(([name, s]) => ({ name, rate: rate(s) })).sort((a, b) => b.rate - a.rate);
    return { rate: rate(stats.cur), prevRate: rate(stats.prev), best: ranked[0]?.name ?? null, worst: ranked.length > 1 ? ranked[ranked.length - 1].name : null };
}

/** Signs { email, habit, day, exp } so a notification button can write one cell without a session. */
export function signActionToken(payload, secret, now = Date.now()) {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: now + ACTION_TOKEN_TTL_MS })).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
}

/** The payload of a valid, unexpired token, or null. */
export function verifyActionToken(token, secret, now = Date.now()) {
    if (typeof token !== 'string') return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (!payload.exp || payload.exp < now || !payload.email || !payload.habit || !payload.day) return null;
        return payload;
    } catch {
        return null;
    }
}

const TEXTS = {
    it: {
        habit: h => ({ title: `⏰ ${h}`, body: 'È il momento di farla. Tocca per aprire Focus.' }),
        evening: n => ({ title: n === 1 ? 'Ti manca 1 abitudine' : `Ti mancano ${n} abitudini`, body: 'Chiudi la giornata: tocca per vedere cosa resta.' }),
        weekly: f => ({ title: `📊 Settimana: ${f.rate}% completato`, body: `${f.prevRate === null ? '' : `Settimana prima: ${f.prevRate}%. `}${f.best ? `Migliore: ${f.best}.` : ''}${f.worst ? ` Da curare: ${f.worst}.` : ''}`.trim() }),
        test: () => ({ title: 'Habitikami', body: 'Le notifiche funzionano 🎉' }),
        actions: { done: '✅ Fatto', skip: '⏭ Salta' },
        confirmed: { done: h => `${h}: segnata come fatta`, skip: h => `${h}: saltata per oggi` },
    },
    en: {
        habit: h => ({ title: `⏰ ${h}`, body: 'Time to do it. Tap to open Focus.' }),
        evening: n => ({ title: n === 1 ? '1 habit left today' : `${n} habits left today`, body: 'Close the day: tap to see what is left.' }),
        weekly: f => ({ title: `📊 Week: ${f.rate}% done`, body: `${f.prevRate === null ? '' : `Week before: ${f.prevRate}%. `}${f.best ? `Best: ${f.best}.` : ''}${f.worst ? ` Needs care: ${f.worst}.` : ''}`.trim() }),
        test: () => ({ title: 'Habitikami', body: 'Notifications work 🎉' }),
        actions: { done: '✅ Done', skip: '⏭ Skip' },
        confirmed: { done: h => `${h}: marked done`, skip: h => `${h}: skipped for today` },
    },
};

/**
 * deps: { dataDir, encryptToken, decryptToken, refreshAccessToken,
 *         getUserSheetsClient, rowsToObjects, readHabitMeta, isAllowedEmail, logId, withJsonFile, log }
 */
export function createPushService(deps) {
    const file = path.join(deps.dataDir, 'push.json');
    const vapidFile = path.join(deps.dataDir, 'vapid.json');
    const log = deps.log || console;
    const metaCache = new Map();   // email → { at, meta }
    const sent = new Map();        // `${email}|${key}` → true (pruned daily)
    let sentDay = '';
    let vapid = null;

    function loadVapid() {
        if (vapid) return vapid;
        const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
        const subject = process.env.VAPID_SUBJECT || 'mailto:admin@habitikami.app';
        if (pub && priv) vapid = { publicKey: pub, privateKey: priv, subject };
        else if (fs.existsSync(vapidFile)) vapid = { subject, ...JSON.parse(fs.readFileSync(vapidFile, 'utf8')) };
        else {
            const keys = webpush.generateVAPIDKeys();
            fs.mkdirSync(deps.dataDir, { recursive: true });
            fs.writeFileSync(vapidFile, JSON.stringify(keys, null, 2), { mode: 0o600 });
            vapid = { subject, ...keys };
            log.log('Push: generated VAPID keys in data/vapid.json');
        }
        webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
        return vapid;
    }

    function load() {
        try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}; } catch { return {}; }
    }
    const save = modifier => deps.withJsonFile(file, modifier);

    function publicView(entry) {
        if (!entry) return { enabled: false, devices: 0, prefs: DEFAULT_PREFS, tz: null, hasRefreshToken: false };
        return { enabled: (entry.subscriptions || []).length > 0, devices: (entry.subscriptions || []).length, prefs: sanitizePrefs(entry.prefs), tz: entry.tz || null, hasRefreshToken: !!entry.refreshToken };
    }

    async function subscribe(email, { subscription, refreshToken, tz, lang, spreadsheetId }) {
        if (!subscription || typeof subscription.endpoint !== 'string' || !/^https:\/\//.test(subscription.endpoint)) throw new Error('Invalid subscription');
        await save(data => {
            const entry = data[email] || { subscriptions: [], prefs: { ...DEFAULT_PREFS } };
            const previous = (entry.subscriptions || []).find(s => s.endpoint === subscription.endpoint);
            entry.subscriptions = (entry.subscriptions || []).filter(s => s.endpoint !== subscription.endpoint);
            const language = lang === 'it' || lang === 'en' ? lang : (previous?.lang ?? 'en');
            entry.subscriptions.push({ endpoint: subscription.endpoint, keys: subscription.keys, lang: language, addedAt: previous?.addedAt ?? new Date().toISOString() });
            if (refreshToken) entry.refreshToken = deps.encryptToken(refreshToken);
            if (tz && typeof tz === 'string' && tz.length <= 64) entry.tz = tz;
            if (spreadsheetId) entry.spreadsheetId = spreadsheetId;
            data[email] = entry;
            return data;
        });
        return publicView(load()[email]);
    }

    async function unsubscribe(email, endpoint) {
        await save(data => {
            const entry = data[email];
            if (!entry) return data;
            entry.subscriptions = endpoint ? (entry.subscriptions || []).filter(s => s.endpoint !== endpoint) : [];
            if (entry.subscriptions.length === 0) delete data[email];
            return data;
        });
        return publicView(load()[email]);
    }

    async function updatePrefs(email, prefs) {
        await save(data => {
            const entry = data[email];
            if (entry) entry.prefs = sanitizePrefs(prefs, sanitizePrefs(entry.prefs));
            return data;
        });
        return publicView(load()[email]);
    }

    async function updateRefreshToken(email, refreshToken) {
        if (!refreshToken) return;
        await save(data => {
            if (data[email]) data[email].refreshToken = deps.encryptToken(refreshToken);
            return data;
        });
    }

    async function purgeDisallowed() {
        let removed = 0;
        if (!fs.existsSync(file)) return 0;
        await save(data => {
            for (const email of Object.keys(data)) {
                if (deps.isAllowedEmail(email)) continue;
                delete data[email];
                removed++;
            }
            return data;
        });
        return removed;
    }

    /** Sends `payload` to every device of `email`; drops subscriptions that are gone (404/410). */
    async function sendToUser(email, payload, entry = load()[email]) {
        if (!entry || !(entry.subscriptions || []).length) return { sent: 0, dropped: 0 };
        loadVapid();
        const gone = [];
        let ok = 0;
        for (const sub of entry.subscriptions) {
            const lang = sub.lang === 'it' ? 'it' : 'en';
            const text = TEXTS[lang][payload.kind](payload.arg);
            const extra = {};
            if (payload.kind === 'habit' && payload.day) {
                // Buttons on the reminder write the cell through /api/push/action (issue #122)
                extra.habit = payload.arg;
                extra.day = payload.day;
                extra.token = signActionToken({ email, habit: payload.arg, day: payload.day }, loadVapid().privateKey);
                extra.actions = [{ action: 'done', title: TEXTS[lang].actions.done }, { action: 'skip', title: TEXTS[lang].actions.skip }];
            }
            const body = JSON.stringify({ ...text, tag: payload.tag, url: payload.url, ...extra });
            try {
                await (deps.sendNotification || webpush.sendNotification.bind(webpush))({ endpoint: sub.endpoint, keys: sub.keys }, body, { TTL: 3600 });
                ok++;
            } catch (e) {
                if (e && (e.statusCode === 404 || e.statusCode === 410)) gone.push(sub.endpoint);
                else log.warn(`Push: send failed for user=${deps.logId(email)}: ${e && e.statusCode ? 'HTTP ' + e.statusCode : (e && e.message)}`);
            }
        }
        if (gone.length) {
            await save(data => {
                if (data[email]) data[email].subscriptions = data[email].subscriptions.filter(s => !gone.includes(s.endpoint));
                if (data[email] && data[email].subscriptions.length === 0) delete data[email];
                return data;
            });
        }
        return { sent: ok, dropped: gone.length };
    }

    async function sheetsFor(entry) {
        const refreshToken = deps.decryptToken(entry.refreshToken);
        const accessToken = await deps.refreshAccessToken(refreshToken);
        return deps.getUserSheetsClient(accessToken);
    }

    async function habitMetaFor(email, entry, sheets) {
        const cached = metaCache.get(email);
        if (cached && Date.now() - cached.at < META_CACHE_MS) return cached.meta;
        const meta = await deps.readHabitMeta(await sheets(), entry.spreadsheetId);
        metaCache.set(email, { at: Date.now(), meta });
        return meta;
    }

    async function readRows(sheets, spreadsheetId, sheetName) {
        const res = await (await sheets()).spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A:Z` });
        return deps.rowsToObjects(res.data.values || []);
    }

    function once(email, key) {
        const k = `${email}|${key}`;
        if (sent.has(k)) return false;
        sent.set(k, true);
        return true;
    }

    /** One scheduler tick for the given instant; returns what was sent (for tests and logs). */
    async function tick(now = new Date()) {
        const data = load();
        const report = [];
        for (const [email, entry] of Object.entries(data)) {
            if (!(entry.subscriptions || []).length || !entry.refreshToken || !entry.spreadsheetId) continue;
            if (!deps.isAllowedEmail(email)) continue;
            const prefs = sanitizePrefs(entry.prefs);
            const clock = localClock(now, entry.tz);
            if (clock.day !== sentDay) { sent.clear(); sentDay = clock.day; }

            let sheetsClient = null;
            const sheets = async () => sheetsClient || (sheetsClient = await sheetsFor(entry));
            const todaySheet = clock.weekday === 0 || clock.weekday === 6 ? 'Weekend' : 'Weekdays';

            try {
                // 1. Habit reminders at HabitMeta.Time or the slot's default time
                if (prefs.habitReminders) {
                    const meta = await habitMetaFor(email, entry, sheets);
                    const due = Object.entries(meta).filter(([name, m]) => reminderTime(m) === clock.time && !prefs.muted.includes(name)).map(([name]) => name);
                    if (due.length) {
                        const pending = pendingHabits(await readRows(sheets, entry.spreadsheetId, todaySheet), clock.dateKey, meta);
                        for (const habit of due) {
                            if (pending && !pending.includes(habit)) continue;
                            if (!once(email, `habit|${habit}|${clock.day}`)) continue;
                            const r = await sendToUser(email, { kind: 'habit', arg: habit, tag: `habit-${habit}`, url: '/#Focus', day: clock.day }, entry);
                            report.push({ email, kind: 'habit', habit, ...r });
                        }
                    }
                }

                // 2. Evening nudge with what is left
                if (prefs.eveningReminder && prefs.eveningTime === clock.time && once(email, `evening|${clock.day}`)) {
                    const meta = await habitMetaFor(email, entry, sheets);
                    const pending = (pendingHabits(await readRows(sheets, entry.spreadsheetId, todaySheet), clock.dateKey, meta) || []).filter(h => !prefs.muted.includes(h));
                    if (pending.length > 0) {
                        const r = await sendToUser(email, { kind: 'evening', arg: pending.length, tag: 'evening', url: '/#Focus' }, entry);
                        report.push({ email, kind: 'evening', pending: pending.length, ...r });
                    }
                }

                // 3. Weekly report on Sunday
                if (prefs.weeklyReport && clock.weekday === 0 && prefs.weeklyTime === clock.time && once(email, `weekly|${clock.day}`)) {
                    const meta = await habitMetaFor(email, entry, sheets);
                    const rows = [...await readRows(sheets, entry.spreadsheetId, 'Weekdays'), ...await readRows(sheets, entry.spreadsheetId, 'Weekend')];
                    const figures = weeklyFigures(rows, clock.day, meta);
                    if (figures.rate !== null) {
                        const r = await sendToUser(email, { kind: 'weekly', arg: figures, tag: 'weekly', url: '/#Graphs' }, entry);
                        report.push({ email, kind: 'weekly', ...figures, ...r });
                    }
                }
            } catch (e) {
                log.warn(`Push: tick failed for user=${deps.logId(email)}: ${e && e.message}`);
            }
        }
        return report;
    }

    /**
     * Handles a notification button: verifies the token, writes TRUE (done) or
     * SKIP (skip) in the habit's cell of that day. Returns { ok, status, error }.
     */
    async function applyAction(token, action) {
        const payload = verifyActionToken(token, loadVapid().privateKey);
        if (!payload) return { ok: false, status: 401, error: 'invalid or expired token' };
        if (action !== 'done' && action !== 'skip') return { ok: false, status: 400, error: 'unknown action' };
        const entry = load()[payload.email];
        if (!entry || !entry.refreshToken || !entry.spreadsheetId || !deps.isAllowedEmail(payload.email)) return { ok: false, status: 403, error: 'not subscribed' };
        const [y, m, d] = payload.day.split('-');
        const sheetDate = `${d}/${m}/${y}`;
        const weekday = new Date(Date.UTC(+y, +m - 1, +d)).getUTCDay();
        const sheetName = weekday === 0 || weekday === 6 ? 'Weekend' : 'Weekdays';
        try {
            const sheets = await sheetsFor(entry);
            const res = await sheets.spreadsheets.values.get({ spreadsheetId: entry.spreadsheetId, range: `${sheetName}!A:Z` });
            const pos = deps.locateCell(res.data.values || [], sheetDate, payload.habit);
            if (pos.error) return { ok: false, status: 404, error: pos.error };
            await sheets.spreadsheets.values.update({
                spreadsheetId: entry.spreadsheetId,
                range: `${sheetName}!${deps.columnLetter(pos.colIndex)}${pos.rowIndex + 1}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[action === 'done' ? 'TRUE' : 'SKIP']] },
            });
            const lang = (entry.subscriptions || []).some(s => s.lang === 'it') ? 'it' : 'en';
            return { ok: true, status: 200, habit: payload.habit, action, message: TEXTS[lang].confirmed[action](payload.habit) };
        } catch (e) {
            log.warn(`Push: action failed for user=${deps.logId(payload.email)}: ${e && e.message}`);
            return { ok: false, status: 502, error: 'sheet write failed' };
        }
    }

    let task = null;
    function start() {
        if (task) return task;
        task = cron.schedule('* * * * *', () => {
            tick().then(r => { if (r.length) log.log(`Push: sent ${r.length} notification(s)`); }).catch(e => log.error('Push: tick error', e));
        });
        log.log('Push: scheduler started (every minute)');
        return task;
    }

    return {
        get publicKey() { return loadVapid().publicKey; },
        settings: email => publicView(load()[email]),
        subscribe, unsubscribe, updatePrefs, updateRefreshToken, purgeDisallowed,
        sendTest: email => sendToUser(email, { kind: 'test', arg: null, tag: 'test', url: '/' }),
        applyAction, tick, start,
    };
}
