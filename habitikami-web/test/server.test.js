// Route tests for server.js (vitest + supertest).
//
// The app is imported once with a temporary DATA_DIR and dummy credentials;
// every outbound call to Google goes through a stubbed global fetch so no
// network is needed.
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const OWNER = 'owner@example.com';
const VALID_API_KEY = 'hk_' + 'a'.repeat(64);

let app;
let dataDir;
const fetchMock = vi.fn();

// What the stubbed Google endpoints answer; tests override per case.
const google = {
    token: { access_token: 'ya29.test', expires_in: 3599, id_token: 'not.a.jwt' },
    tokeninfo: { aud: CLIENT_ID, expires_in: '3599', email: OWNER, email_verified: 'true' },
};

function jsonResponse(body, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'habitikami-test-'));
    writeFileSync(join(dataDir, 'apikeys.json'), JSON.stringify({
        [createHash('sha256').update(VALID_API_KEY).digest('hex')]: {
            email: OWNER, spreadsheetId: 'sheet-owner', prefix: VALID_API_KEY.slice(0, 7), createdAt: '2026-01-01T00:00:00Z',
        },
    }));
    writeFileSync(join(dataDir, 'users.json'), JSON.stringify({ [OWNER]: { spreadsheetId: 'sheet-owner' } }));

    Object.assign(process.env, {
        DATA_DIR: dataDir,
        NODE_ENV: 'test',
        VITE_GOOGLE_CLIENT_ID: CLIENT_ID,
        VITE_SPREADSHEET_ID: 'sheet-owner',
        GOOGLE_CLIENT_SECRET: 'test-secret',
        ALLOWED_ORIGINS: 'https://habitikami.test',
        OWNER_EMAIL: OWNER,
    });

    fetchMock.mockImplementation(async (url) => {
        const u = String(url);
        if (u.startsWith('https://oauth2.googleapis.com/tokeninfo')) return jsonResponse(google.tokeninfo);
        if (u === 'https://oauth2.googleapis.com/token') return jsonResponse(google.token);
        throw new Error(`Unexpected fetch in test: ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    app = (await import('../server.js')).default;
});

afterAll(() => {
    vi.unstubAllGlobals();
    rmSync(dataDir, { recursive: true, force: true });
});

describe('POST /api/auth/exchange', () => {
    it('rejects a missing authorization code with 400', async () => {
        const res = await request(app).post('/api/auth/exchange').send({});
        expect(res.status).toBe(400);
    });

    it('rejects an invalid id_token with 400 instead of 500', async () => {
        google.token = { access_token: 'ya29.test', expires_in: 3599, id_token: 'not.a.jwt' };
        const res = await request(app)
            .post('/api/auth/exchange')
            .send({ code: 'auth-code', code_verifier: 'verifier', redirect_uri: 'https://habitikami.test' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid id_token');
    });

    it('rejects a request from a foreign origin with 403', async () => {
        const res = await request(app)
            .post('/api/auth/exchange')
            .set('Origin', 'https://evil.example')
            .send({ code: 'auth-code' });
        expect(res.status).toBe(403);
    });
});

describe('Bearer token verification', () => {
    it('rejects a token issued to another OAuth client (aud mismatch) with 401', async () => {
        google.tokeninfo = { aud: 'another-client.apps.googleusercontent.com', expires_in: '3599', email: OWNER, email_verified: 'true' };
        const res = await request(app).get('/api/user/apikey').set('Authorization', 'Bearer foreign-token');
        expect(res.status).toBe(401);
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('tokeninfo?access_token=foreign-token'));
    });

    it('accepts a token issued to this client', async () => {
        google.tokeninfo = { aud: CLIENT_ID, expires_in: '3599', email: OWNER, email_verified: 'true' };
        const res = await request(app).get('/api/user/apikey').set('Authorization', 'Bearer own-token');
        expect(res.status).toBe(200);
        expect(res.body.has_key).toBe(true);
    });
});

describe('API key authentication', () => {
    it('rejects an unknown X-API-Token with 401', async () => {
        const res = await request(app).get('/api/export').set('X-API-Token', 'hk_' + 'f'.repeat(64));
        expect(res.status).toBe(401);
    });

    it('rejects a request without credentials with 401', async () => {
        const res = await request(app).get('/api/export');
        expect(res.status).toBe(401);
    });
});

describe('POST /api/counter/increment', () => {
    it('rejects a counter name with forbidden characters with 400', async () => {
        const res = await request(app)
            .post('/api/counter/increment')
            .set('X-API-Token', VALID_API_KEY)
            .send({ counter: 'bad|name' });
        expect(res.status).toBe(400);
    });

    it('rejects the reserved _config prefix with 400', async () => {
        const res = await request(app)
            .post('/api/counter/increment')
            .set('X-API-Token', VALID_API_KEY)
            .send({ counter: '_config x' });
        expect(res.status).toBe(400);
    });

    it('rejects a missing counter name with 400', async () => {
        const res = await request(app)
            .post('/api/counter/increment')
            .set('X-API-Token', VALID_API_KEY)
            .send({});
        expect(res.status).toBe(400);
    });
});

describe('id_token edge cases', () => {
    it('rejects an id_token whose header and payload decode to JSON null with 400', async () => {
        const nullSegment = Buffer.from('null').toString('base64url');
        google.token = { access_token: 'ya29.test', expires_in: 3599, id_token: `${nullSegment}.${nullSegment}.sig` };
        const res = await request(app)
            .post('/api/auth/exchange')
            .send({ code: 'auth-code', redirect_uri: 'https://habitikami.test' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid id_token');
    });
});

describe('push endpoints', () => {
    it('serves the VAPID public key', async () => {
        const res = await request(app).get('/api/push/public-key');
        expect(res.status).toBe(200);
        expect(res.body.key.length).toBeGreaterThan(60);
    });

    it('subscribes the signed-in user and reports the settings', async () => {
        const subscription = { endpoint: 'https://push.example/dev1', keys: { p256dh: 'k', auth: 'a' } };
        const res = await request(app)
            .post('/api/push/subscribe')
            .set('Authorization', 'Bearer own-token')
            .set('Origin', 'https://habitikami.test')
            .send({ subscription, refresh_token: 'rt', tz: 'Europe/Rome', lang: 'it' });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ enabled: true, devices: 1, hasRefreshToken: true });

        const settings = await request(app).get('/api/push/settings').set('Authorization', 'Bearer own-token');
        expect(settings.body.prefs.eveningTime).toBe('21:00');

        const off = await request(app)
            .post('/api/push/unsubscribe')
            .set('Authorization', 'Bearer own-token')
            .set('Origin', 'https://habitikami.test')
            .send({ endpoint: subscription.endpoint });
        expect(off.body.enabled).toBe(false);
    });

    it('rejects an anonymous subscribe', async () => {
        const res = await request(app).post('/api/push/subscribe').set('Origin', 'https://habitikami.test').send({});
        expect(res.status).toBe(401);
    });
});

describe('AI shared key and validation', () => {
    it('reports no shared key when the environment has none', async () => {
        const res = await request(app).get('/api/ai/status').set('Authorization', 'Bearer own-token');
        expect(res.status).toBe(200);
        expect(res.body.shared).toBeNull();
    });

    it('refuses a chat without a key when no shared key exists', async () => {
        const res = await request(app)
            .post('/api/gemini/chat')
            .set('Authorization', 'Bearer own-token')
            .set('Origin', 'https://habitikami.test')
            .send({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('no_key');
    });

    it('uses the shared key within the daily quota, then says so', async () => {
        process.env.SERVER_AI_PROVIDER = 'gemini';
        process.env.SERVER_AI_KEY = 'shared-key';
        process.env.SERVER_AI_DAILY_QUOTA = '2';
        const seen = [];
        fetchMock.mockImplementation(async (url) => {
            const u = String(url);
            if (u.startsWith('https://oauth2.googleapis.com/tokeninfo')) return jsonResponse(google.tokeninfo);
            if (u.includes('generativelanguage.googleapis.com')) { seen.push(u); return jsonResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }); }
            throw new Error(`Unexpected fetch in test: ${u}`);
        });
        const send = () => request(app).post('/api/gemini/chat').set('Authorization', 'Bearer own-token').set('Origin', 'https://habitikami.test').send({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] });
        let res = await send();
        expect(res.status).toBe(200);
        expect(res.headers['x-ai-shared-remaining']).toBe('1');
        expect(seen[0]).toContain('key=shared-key');
        const status = await request(app).get('/api/ai/status').set('Authorization', 'Bearer own-token');
        expect(status.body.shared).toEqual({ provider: 'gemini', quota: 2, remaining: 1 });
        await send();
        res = await send();
        expect(res.status).toBe(429);
        expect(res.body.code).toBe('quota_exceeded');
        // an own key still works when the quota is spent
        res = await request(app).post('/api/gemini/chat').set('Authorization', 'Bearer own-token').set('Origin', 'https://habitikami.test').send({ apiKey: 'mine', contents: [{ role: 'user', parts: [{ text: 'hi' }] }] });
        expect(res.status).toBe(200);
        expect(seen.at(-1)).toContain('key=mine');
        delete process.env.SERVER_AI_PROVIDER; delete process.env.SERVER_AI_KEY; delete process.env.SERVER_AI_DAILY_QUOTA;
    });

    it('validates a key with one small call', async () => {
        fetchMock.mockImplementation(async (url) => {
            const u = String(url);
            if (u.startsWith('https://oauth2.googleapis.com/tokeninfo')) return jsonResponse(google.tokeninfo);
            if (u.includes('api.anthropic.com')) return jsonResponse({ type: 'error', error: { message: 'invalid x-api-key' } }, 401);
            throw new Error(`Unexpected fetch in test: ${u}`);
        });
        const res = await request(app).post('/api/ai/validate').set('Authorization', 'Bearer own-token').set('Origin', 'https://habitikami.test').send({ provider: 'anthropic', apiKey: 'sk-ant-bad' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ valid: false, status: 401, error: 'invalid x-api-key' });
        const bad = await request(app).post('/api/ai/validate').set('Authorization', 'Bearer own-token').set('Origin', 'https://habitikami.test').send({ provider: 'nope', apiKey: 'x' });
        expect(bad.status).toBe(400);
    });
});
