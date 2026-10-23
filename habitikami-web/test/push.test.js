// Push reminders (push.js): pure helpers, the subscription store and one
// scheduler tick driven with fake sheets and a fake sender.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPushService, localClock, cellIsDone, pendingHabits, reminderTime, sanitizePrefs, weeklyFigures, signActionToken, verifyActionToken } from '../push.js';

const EMAIL = 'owner@example.com';
const sub = (n) => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: 'k', auth: 'a' } });

describe('push helpers', () => {
    it('gives the local clock in the user time zone', () => {
        const c = localClock(new Date('2026-10-25T20:30:00Z'), 'Europe/Rome');
        expect(c).toEqual({ day: '2026-10-25', time: '21:30', weekday: 0, dateKey: '25/10/2026' });
        expect(localClock(new Date('2026-10-25T23:30:00Z'), 'not/a-zone').day).toBe('2026-10-25');
    });

    it('reads raw cells like the apps do', () => {
        expect(cellIsDone('TRUE')).toBe(true);
        expect(cellIsDone('HALF')).toBe(true);
        expect(cellIsDone('SKIP')).toBe(true);
        expect(cellIsDone('FALSE')).toBe(false);
        expect(cellIsDone('')).toBe(false);
        expect(cellIsDone('3', 5)).toBe(false);
        expect(cellIsDone('5', 5)).toBe(true);
    });

    it('lists the pending habits of today', () => {
        const rows = [{ Giorno: 'Lunedì', Date: '20/10/2026', Run: 'TRUE', Read: 'FALSE', Water: '4' }];
        expect(pendingHabits(rows, '20/10/2026', { Water: { target: 8 } })).toEqual(['Read', 'Water']);
        expect(pendingHabits(rows, '21/10/2026')).toBeNull();
    });

    it('derives the reminder time from HabitMeta', () => {
        expect(reminderTime({ time: '7:30', slot: 'any' })).toBe('07:30');
        expect(reminderTime({ time: null, slot: 'evening' })).toBe('19:00');
        expect(reminderTime({ time: null, slot: 'any' })).toBeNull();
    });

    it('sanitizes preferences', () => {
        const p = sanitizePrefs({ eveningTime: '9:05', weeklyReport: false, muted: ['A', 5], bogus: 1 });
        expect(p).toEqual({ habitReminders: true, eveningReminder: true, eveningTime: '09:05', weeklyReport: false, weeklyTime: '18:00', muted: ['A'] });
        expect(sanitizePrefs({ eveningTime: '25:00' }).eveningTime).toBe('21:00');
    });

    it('computes the weekly figures against the week before', () => {
        const rows = [];
        for (let i = 0; i < 14; i++) {
            const d = new Date(Date.UTC(2026, 9, 25 - i, 12));
            rows.push({ Date: `${String(d.getUTCDate()).padStart(2, '0')}/10/2026`, Run: i < 7 ? 'TRUE' : 'FALSE', Read: i % 2 ? 'TRUE' : 'FALSE' });
        }
        const f = weeklyFigures(rows, '2026-10-25');
        expect(f).toEqual({ rate: 71, prevRate: 29, best: 'Run', worst: 'Read' });
    });
});

describe('action tokens', () => {
    it('round-trips and rejects tampering and expiry', () => {
        const t = signActionToken({ email: 'a@b.c', habit: 'Run', day: '2026-10-20' }, 'secret', 1000);
        expect(verifyActionToken(t, 'secret', 2000)).toMatchObject({ email: 'a@b.c', habit: 'Run', day: '2026-10-20' });
        expect(verifyActionToken(t, 'other', 2000)).toBeNull();
        expect(verifyActionToken(t + 'x', 'secret', 2000)).toBeNull();
        expect(verifyActionToken(t, 'secret', 1000 + 25 * 3600 * 1000)).toBeNull();
        expect(verifyActionToken('garbage', 'secret')).toBeNull();
    });
});

describe('push service', () => {
    let dataDir, service;
    const sendNotification = vi.fn(async () => ({}));
    const sheetValues = { Weekdays: [], Weekend: [], HabitMeta: [] };
    const updates = [];
    const sheets = { spreadsheets: { values: { get: async ({ range }) => ({ data: { values: sheetValues[range.split('!')[0]] || [] } }), update: async (req) => { updates.push(req); return {}; } } } };

    beforeAll(() => {
        dataDir = mkdtempSync(join(tmpdir(), 'habitikami-push-'));
        service = createPushService({
            dataDir,
            encryptToken: t => `enc:${t}`,
            decryptToken: t => t.replace(/^enc:/, ''),
            refreshAccessToken: async () => 'access',
            getUserSheetsClient: () => sheets,
            rowsToObjects: rows => rows.slice(1).map(r => Object.fromEntries(rows[0].map((h, i) => [h, r[i]]))),
            readHabitMeta: async () => ({ Run: { slot: 'morning', time: null, target: null }, Read: { slot: 'any', time: '21:00', target: null } }),
            isAllowedEmail: e => e === EMAIL,
            logId: e => e,
            withJsonFile: async (file, modifier) => {
                const data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
                const next = modifier(data);
                const { writeFileSync } = await import('node:fs');
                writeFileSync(file, JSON.stringify(next));
            },
            sendNotification,
            locateCell: (rows, date, habit) => { const col = rows[0].indexOf(habit); const row = rows.findIndex(r => r[1] === date); return col === -1 ? { error: 'habit not found' } : row === -1 ? { error: 'row not found' } : { rowIndex: row, colIndex: col }; },
            columnLetter: i => String.fromCharCode(65 + i),
            log: { log() {}, warn() {}, error() {} },
        });
    });
    afterAll(() => rmSync(dataDir, { recursive: true, force: true }));

    it('generates and persists VAPID keys', () => {
        expect(service.publicKey.length).toBeGreaterThan(60);
        expect(existsSync(join(dataDir, 'vapid.json'))).toBe(true);
    });

    it('stores subscriptions with the encrypted refresh token', async () => {
        const view = await service.subscribe(EMAIL, { subscription: sub(1), refreshToken: 'rt', tz: 'Europe/Rome', lang: 'it', spreadsheetId: 'sheet' });
        expect(view).toMatchObject({ enabled: true, devices: 1, hasRefreshToken: true, tz: 'Europe/Rome' });
        await service.subscribe(EMAIL, { subscription: sub(1), spreadsheetId: 'sheet' });
        expect(service.settings(EMAIL).devices).toBe(1);
        const raw = JSON.parse(readFileSync(join(dataDir, 'push.json'), 'utf8'));
        expect(raw[EMAIL].refreshToken).toBe('enc:rt');
        await expect(service.subscribe(EMAIL, { subscription: { endpoint: 'http://insecure' } })).rejects.toThrow('Invalid subscription');
    });

    it('sends habit reminders only for pending habits, once per day', async () => {
        sheetValues.Weekdays = [['Giorno', 'Date', 'Run', 'Read'], ['Lunedì', '20/10/2026', 'FALSE', 'FALSE']];
        // 08:00 in Rome on Tuesday 20 Oct 2026 = 06:00Z
        let report = await service.tick(new Date('2026-10-20T06:00:00Z'));
        expect(report).toEqual([{ email: EMAIL, kind: 'habit', habit: 'Run', sent: 1, dropped: 0 }]);
        const body = JSON.parse(sendNotification.mock.calls[0][1]);
        expect(body.title).toBe('⏰ Run');
        expect(body.url).toBe('/#Focus');
        expect(body.actions.map(a => a.action)).toEqual(['done', 'skip']);
        const applied = await service.applyAction(body.token, 'done');
        expect(applied).toMatchObject({ ok: true, status: 200, habit: 'Run' });
        expect(updates.at(-1)).toMatchObject({ range: 'Weekdays!C2', requestBody: { values: [['TRUE']] } });
        expect(await service.applyAction(body.token, 'dance')).toMatchObject({ ok: false, status: 400 });
        expect(await service.applyAction('nope', 'done')).toMatchObject({ ok: false, status: 401 });
        report = await service.tick(new Date('2026-10-20T06:00:30Z'));
        expect(report).toEqual([]);
    });

    it('skips a reminder when the habit is already done or muted', async () => {
        sheetValues.Weekdays = [['Giorno', 'Date', 'Run', 'Read'], ['Mercoledì', '21/10/2026', 'TRUE', 'FALSE']];
        expect(await service.tick(new Date('2026-10-21T06:00:00Z'))).toEqual([]);
        await service.updatePrefs(EMAIL, { muted: ['Read'], eveningTime: '22:00' });
        expect(await service.tick(new Date('2026-10-21T19:00:00Z'))).toEqual([]);
    });

    it('sends the evening nudge with the number of habits left', async () => {
        sheetValues.Weekdays = [['Giorno', 'Date', 'Run', 'Read', 'Water'], ['Mercoledì', '21/10/2026', 'TRUE', 'FALSE', 'FALSE']];
        const report = await service.tick(new Date('2026-10-21T20:00:00Z'));
        expect(report).toEqual([{ email: EMAIL, kind: 'evening', pending: 1, sent: 1, dropped: 0 }]);
        expect(JSON.parse(sendNotification.mock.calls.at(-1)[1]).title).toBe('Ti manca 1 abitudine');
    });

    it('drops subscriptions the push service reports as gone', async () => {
        await service.subscribe(EMAIL, { subscription: sub(2), spreadsheetId: 'sheet' });
        sendNotification.mockImplementationOnce(async () => { throw Object.assign(new Error('gone'), { statusCode: 410 }); });
        const r = await service.sendTest(EMAIL);
        expect(r).toEqual({ sent: 1, dropped: 1 });
        expect(service.settings(EMAIL).devices).toBe(1);
    });

    it('removes everything on unsubscribe and purge', async () => {
        await service.unsubscribe(EMAIL, null);
        expect(service.settings(EMAIL).enabled).toBe(false);
        await service.subscribe('other@example.com', { subscription: sub(3), spreadsheetId: 's' });
        expect(await service.purgeDisallowed()).toBe(1);
    });
});
