import express from 'express';
import { google } from 'googleapis';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import lockfile from 'proper-lockfile';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1); // for express-rate-limit behind reverse proxy
const PORT = process.env.PORT || 80;

// ─── User store (email → spreadsheetId) ──────────────────────────────────────
// Persisted to data/users.json mounted as a Docker volume.
// User preferences (e.g. enabled tabs) stored in data/preferences.json

const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const PREFS_FILE = path.join(__dirname, 'data', 'preferences.json');
const APIKEYS_FILE = path.join(__dirname, 'data', 'apikeys.json');

// Ensure data directory exists
fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });

// Non-reversible identifier for log lines: never write account emails to logs.
function logId(email) {
    if (!email || typeof email !== 'string') return 'none';
    return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 8);
}

// Atomic read-modify-write with file locking to prevent race conditions
async function withJsonFile(filePath, modifier) {
    // Ensure file exists for locking
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '{}', 'utf8');
    }
    let release;
    try {
        release = await lockfile.lock(filePath, { retries: { retries: 5, minTimeout: 50, maxTimeout: 500 } });
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!modifier) {
            return data;
        }
        const updated = modifier(data);
        // Write to temp file then rename for atomicity
        const tmpFile = filePath + '.tmp';
        fs.writeFileSync(tmpFile, JSON.stringify(updated, null, 2), 'utf8');
        fs.renameSync(tmpFile, filePath);
        return updated;
    } finally {
        if (release) await release();
    }
}

function loadPreferences() {
    try {
        if (fs.existsSync(PREFS_FILE)) {
            return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Failed to load preferences.json:', e);
    }
    return {};
}

async function savePreferencesAtomic(modifier) {
    return withJsonFile(PREFS_FILE, modifier);
}

// users.json format: { email: { spreadsheetId, enabled_tabs?, default_tab? } }
// Migration: old format was { email: "spreadsheetId" (string) }

function migrateUsers(users) {
    let migrated = false;
    for (const [email, value] of Object.entries(users)) {
        if (typeof value === 'string') {
            users[email] = { spreadsheetId: value };
            migrated = true;
        }
    }
    return migrated;
}

function mergePreferencesIntoUsers(users) {
    // One-time migration: merge preferences.json into users.json
    try {
        if (fs.existsSync(PREFS_FILE)) {
            const prefs = JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8'));
            let merged = false;
            for (const [email, prefData] of Object.entries(prefs)) {
                if (users[email] && typeof users[email] === 'object') {
                    if (prefData.enabled_tabs && !users[email].enabled_tabs) {
                        users[email].enabled_tabs = prefData.enabled_tabs;
                        merged = true;
                    }
                    if (prefData.default_tab && !users[email].default_tab) {
                        users[email].default_tab = prefData.default_tab;
                        merged = true;
                    }
                }
            }
            if (merged) {
                console.log('Migrated preferences.json into users.json');
            }
            return merged;
        }
    } catch (e) {
        console.error('Failed to merge preferences:', e);
    }
    return false;
}

function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            const formatMigrated = migrateUsers(users);
            const prefsMigrated = mergePreferencesIntoUsers(users);
            if (formatMigrated || prefsMigrated) {
                fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
            }
            return users;
        }
    } catch (e) {
        console.error('Failed to load users.json:', e);
    }
    return {};
}

async function saveUsersAtomic(modifier) {
    return withJsonFile(USERS_FILE, modifier);
}

function saveUsers(users) {
    try {
        fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save users.json:', e);
    }
}

// Helper: get spreadsheetId from user entry (handles both old string and new object format)
function getUserSpreadsheetId(users, email) {
    const entry = users[email];
    if (!entry) return null;
    if (typeof entry === 'string') return entry; // legacy (pre-migration)
    return entry.spreadsheetId || null;
}

// ─── API key store helpers ────────────────────────────────────────────────────
// apikeys.json maps: { [sha256(apiKey) hex]: { email, spreadsheetId, createdAt, prefix, refreshToken? } }
// Keys are stored hashed so a leaked data file cannot be replayed against the
// API. `prefix` keeps the first characters of the plaintext key for masking.
// Legacy records keyed by the plaintext key ("hk_...") are migrated on startup.

const API_KEY_PREFIX_LEN = 7;

function hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function loadApiKeys() {
    try {
        if (fs.existsSync(APIKEYS_FILE)) {
            return JSON.parse(fs.readFileSync(APIKEYS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Failed to load apikeys.json:', e);
    }
    return {};
}

async function saveApiKeysAtomic(modifier) {
    return withJsonFile(APIKEYS_FILE, modifier);
}

// Look up the record for a plaintext API key presented by a client
function findApiKeyRecord(apiKeys, apiKey) {
    if (!apiKey || typeof apiKey !== 'string') return null;
    return apiKeys[hashApiKey(apiKey)] || null;
}

function generateApiKey() {
    return 'hk_' + crypto.randomBytes(32).toString('hex');
}

// One-time migration: rehash any record still keyed by its plaintext key.
// Keys already handed out to widgets keep working because lookups hash the
// received value.
async function migrateApiKeysToHashed() {
    if (!fs.existsSync(APIKEYS_FILE)) return;
    const needsMigration = Object.keys(loadApiKeys()).some(k => k.startsWith('hk_'));
    if (!needsMigration) return;
    let migrated = 0;
    try {
        await saveApiKeysAtomic(apiKeys => {
            for (const [key, meta] of Object.entries(apiKeys)) {
                if (!key.startsWith('hk_')) continue;
                delete apiKeys[key];
                apiKeys[hashApiKey(key)] = { ...meta, prefix: key.slice(0, API_KEY_PREFIX_LEN) };
                migrated++;
            }
            return apiKeys;
        });
    } catch (e) {
        console.error('Failed to migrate apikeys.json to hashed keys:', e);
        return;
    }
    if (migrated > 0) console.log(`Migrated ${migrated} API key(s) to hashed storage`);
}

// ─── OAuth client secret ─────────────────────────────────────────────────────
// The secret is server-only, so it must not carry the VITE_ prefix (Vite
// exposes VITE_* variables to the client bundle). The legacy name is still
// honoured so existing deployments keep working — and keep the same value,
// which matters because the refresh-token encryption key is derived from it.

let clientSecretDeprecationWarned = false;
function getClientSecret() {
    if (process.env.GOOGLE_CLIENT_SECRET) return process.env.GOOGLE_CLIENT_SECRET;
    const legacy = process.env.VITE_GOOGLE_CLIENT_SECRET;
    if (legacy) {
        if (!clientSecretDeprecationWarned) {
            clientSecretDeprecationWarned = true;
            console.warn('DEPRECATED: VITE_GOOGLE_CLIENT_SECRET is set but GOOGLE_CLIENT_SECRET is not. Rename the variable to GOOGLE_CLIENT_SECRET (same value); the VITE_ name will stop being read in a future release.');
        }
        return legacy;
    }
    return undefined;
}

// ─── Refresh token encryption ────────────────────────────────────────────────
// Encrypt user refresh tokens at rest using a server-side key derived from
// GOOGLE_CLIENT_SECRET (always available). AES-256-GCM.

function getEncryptionKey() {
    const secret = getClientSecret();
    if (!secret) throw new Error('Cannot encrypt: GOOGLE_CLIENT_SECRET not set');
    return crypto.createHash('sha256').update(secret).digest();
}

function encryptToken(plaintext) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptToken(ciphertext) {
    const key = getEncryptionKey();
    const [ivHex, tagHex, encHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// Seed owner account from env on startup
// OWNER_EMAIL is required; VITE_SPREADSHEET_ID is the owner's sheet (only used if not already registered)
{
    const ownerEmail = process.env.OWNER_EMAIL;
    const ownerSpreadsheetId = process.env.VITE_SPREADSHEET_ID;
    if (ownerEmail) {
        const users = loadUsers();
        const existing = users[ownerEmail] || {};
        const existingId = getUserSpreadsheetId(users, ownerEmail);
        if (!existingId && ownerSpreadsheetId) {
            // Only seed if no spreadsheet registered yet
            users[ownerEmail] = { ...(typeof existing === 'object' ? existing : {}), spreadsheetId: ownerSpreadsheetId };
            saveUsers(users);
            console.log(`Owner account seeded: user=${logId(ownerEmail)} (spreadsheet from env)`);
        } else if (existingId) {
            console.log(`Owner account already registered: user=${logId(ownerEmail)} (spreadsheet: ${existingId})`);
        } else {
            console.log(`Owner account user=${logId(ownerEmail)} has no spreadsheet (VITE_SPREADSHEET_ID not set, will use app-generated sheet)`);
        }
    } else {
        console.warn('OWNER_EMAIL not set — owner account not seeded.');
    }
}

// Surface secret misconfiguration (and the VITE_ deprecation warning) at startup
if (!getClientSecret()) {
    console.warn('GOOGLE_CLIENT_SECRET not set — OAuth code exchange, token refresh and API key encryption will fail.');
}

// Rehash legacy plaintext API keys before serving any request
await migrateApiKeysToHashed();

// ─── Security headers ────────────────────────────────────────────────────────

app.use(helmet({
    // CSP disabled — gapi (apis.google.com) dynamically loads scripts and XHRs
    // from numerous Google subdomains that change over time, making a static
    // whitelist impractical. The other helmet protections remain active.
    contentSecurityPolicy: false,
    // Must be same-origin-allow-popups for Google OAuth popup flow
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    // Disable COEP — Google's scripts don't send CORP headers
    crossOriginEmbedderPolicy: false,
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : null;

if (!allowedOrigins && process.env.NODE_ENV === 'production') {
    console.error('FATAL: ALLOWED_ORIGINS must be set in production. Exiting.');
    process.exit(1);
}

app.use(cors({
    origin: (origin, callback) => {
        // Allow server-to-server (no origin) but reject unknown browser origins
        if (!origin) return callback(null, true);
        if (allowedOrigins && allowedOrigins.includes(origin)) return callback(null, true);
        // In development without ALLOWED_ORIGINS, allow all
        if (!allowedOrigins) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
// AI chat endpoints carry multimodal payloads (base64 image/PDF attachments),
// so they need a much larger JSON body limit than the rest of the API.
const AI_CHAT_PATHS = new Set(['/api/anthropic/chat', '/api/gemini/chat']);
const standardJson = express.json();
const largeJson = express.json({ limit: '25mb' });
app.use((req, res, next) => {
    if (AI_CHAT_PATHS.has(req.path)) return largeJson(req, res, next);
    return standardJson(req, res, next);
});

// ─── Rate limiting ───────────────────────────────────────────────────────────

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { error: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Google's public keys for JWT verification (cached with TTL)
let googleCertsCache = null;
let googleCertsCacheExpiry = 0;

async function getGooglePublicKeys() {
    if (googleCertsCache && Date.now() < googleCertsCacheExpiry) {
        return googleCertsCache;
    }
    const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    if (!res.ok) throw new Error('Failed to fetch Google public keys');
    const data = await res.json();
    googleCertsCache = data;
    // Cache for 1 hour
    googleCertsCacheExpiry = Date.now() + 60 * 60 * 1000;
    return data;
}

function base64UrlDecode(str) {
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// Verify and decode email from Google id_token (JWT) with full signature check
async function getEmailFromIdToken(idToken) {
    if (!idToken) throw new Error('No id_token provided');
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new Error('Invalid id_token format');

    // Decode header to find key ID
    const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));

    // Validate issuer
    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
        throw new Error('Invalid id_token issuer');
    }

    // Validate audience matches our client ID
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
    if (payload.aud !== clientId) {
        throw new Error('Invalid id_token audience');
    }

    // Validate expiration
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('id_token has expired');
    }

    // Verify signature using Google's public keys
    const certs = await getGooglePublicKeys();
    const key = certs.keys?.find(k => k.kid === header.kid);
    if (!key) throw new Error('id_token signed with unknown key');

    const publicKey = crypto.createPublicKey({ key, format: 'jwk' });
    const signatureValid = crypto.verify(
        header.alg === 'RS256' ? 'sha256' : 'sha256',
        Buffer.from(parts[0] + '.' + parts[1]),
        publicKey,
        base64UrlDecode(parts[2])
    );
    if (!signatureValid) throw new Error('id_token signature verification failed');

    if (!payload.email) throw new Error('id_token does not contain email');
    return payload.email;
}

// Fetch the Google email for an access token. Only used as a fallback right
// after a code exchange / refresh when Google returned no id_token: the token
// was just issued to us, so its audience is known. Never use this for tokens
// presented by clients — use verifyAccessToken() instead.
async function getEmailFromToken(accessToken) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch user info from Google');
    const data = await res.json();
    if (!data.email) throw new Error('Google userinfo did not return an email');
    return data.email;
}

// ─── Access token verification (audience check) ─────────────────────────────
// Any Google access token with the email scope can call userinfo, even one
// issued to a different application (token substitution). Incoming Bearer
// tokens are therefore validated against Google's tokeninfo endpoint and the
// audience must be our own OAuth client. Results are cached in memory until
// the token expires so Google is not called on every request.

const TOKEN_CACHE_MAX = 5000;
const tokenCache = new Map(); // token → { email, expiresAt }

function pruneTokenCache(now) {
    for (const [token, entry] of tokenCache) {
        if (entry.expiresAt <= now) tokenCache.delete(token);
    }
    // Still too big (many live tokens): drop the oldest entries (insertion order)
    while (tokenCache.size >= TOKEN_CACHE_MAX) {
        const oldest = tokenCache.keys().next().value;
        if (oldest === undefined) break;
        tokenCache.delete(oldest);
    }
}

class TokenVerificationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TokenVerificationError';
    }
}

async function verifyAccessToken(token) {
    if (!token || typeof token !== 'string') throw new TokenVerificationError('Missing access token');

    const now = Date.now();
    const cached = tokenCache.get(token);
    if (cached) {
        if (cached.expiresAt > now) return cached.email;
        tokenCache.delete(token);
    }

    const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error('VITE_GOOGLE_CLIENT_ID not set');

    const res = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token));
    let info = null;
    try { info = await res.json(); } catch { /* non-JSON body */ }
    if (!res.ok || !info || info.error) {
        throw new TokenVerificationError('Invalid access token');
    }

    const audience = info.aud || info.azp;
    if (audience !== clientId) {
        throw new TokenVerificationError('Access token audience mismatch');
    }
    const expiresIn = parseInt(info.expires_in, 10);
    if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
        throw new TokenVerificationError('Access token has expired');
    }
    if (info.email_verified !== true && info.email_verified !== 'true') {
        throw new TokenVerificationError('Access token email not verified');
    }
    if (!info.email) throw new TokenVerificationError('Access token has no email');

    if (tokenCache.size >= TOKEN_CACHE_MAX) pruneTokenCache(now);
    tokenCache.set(token, { email: info.email, expiresAt: now + expiresIn * 1000 });
    return info.email;
}

// Periodic cleanup of expired cache entries
setInterval(() => pruneTokenCache(Date.now()), 5 * 60 * 1000).unref();

// Extract Bearer token from Authorization header
function extractBearer(req) {
    const auth = req.headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
    return null;
}

// ─── Access allowlist (private / maintenance mode) ───────────────────────────
// ALLOWED_EMAILS: comma-separated list of Google accounts. When set, only these
// accounts can sign in, refresh a session or use a widget API key.
// Unset or empty = open access (default).

const allowedEmails = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

if (allowedEmails.length > 0) {
    console.log(`Access restricted: only ${allowedEmails.length} allowed account(s) can sign in.`);
}

function isAllowedEmail(email) {
    if (allowedEmails.length === 0) return true;
    return !!email && allowedEmails.includes(email.toLowerCase());
}

const ACCESS_RESTRICTED = {
    error: 'Access is temporarily restricted to authorized accounts.',
    code: 'access_restricted',
};

// Resolve the email behind a Bearer access token (verifying its audience) and
// enforce the allowlist. Sends 401 on an invalid/foreign token, 403 when the
// account is not allowed, and returns null in both cases.
async function requireAllowedEmail(accessToken, res) {
    let email;
    try {
        email = await verifyAccessToken(accessToken);
    } catch (err) {
        if (err instanceof TokenVerificationError) {
            res.status(401).json({ error: 'Unauthorized: Invalid Bearer token.' });
            return null;
        }
        throw err;
    }
    if (!isAllowedEmail(email)) {
        res.status(403).json(ACCESS_RESTRICTED);
        return null;
    }
    return email;
}

// ─── Config endpoint ──────────────────────────────────────────────────────────

app.get('/config.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    // Only public, non-secret values go here
    const config = {
        VITE_GOOGLE_CLIENT_ID: process.env.VITE_GOOGLE_CLIENT_ID,
    };

    const safeJson = JSON.stringify(config).replace(/</g, '\\u003c');
    res.send(`window.config = ${safeJson};`);
});

// ─── CSRF-like origin check for state-changing requests ──────────────────────

function validateOrigin(req, res, next) {
    const origin = req.headers['origin'];
    // If ALLOWED_ORIGINS is set, validate. Otherwise skip (dev mode).
    if (allowedOrigins && origin && !allowedOrigins.includes(origin)) {
        return res.status(403).json({ error: 'Forbidden: invalid origin' });
    }
    next();
}

// ─── Auth: exchange code → tokens + user profile ──────────────────────────────

app.post('/api/auth/exchange', authLimiter, validateOrigin, async (req, res) => {
    try {
        const { code, code_verifier, redirect_uri } = req.body;
        if (!code) return res.status(400).json({ error: 'Missing authorization code' });

        const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
        const clientSecret = getClientSecret();
        if (!clientId || !clientSecret) {
            return res.status(500).json({ error: 'Server misconfiguration' });
        }

        // Use redirect_uri from request if provided, otherwise fall back to header or env
        const redirectUriUsed = redirect_uri || req.headers.origin || process.env.APP_ORIGIN;
        if (!redirectUriUsed) {
            return res.status(400).json({ error: 'Missing redirect_uri' });
        }

        const params = new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUriUsed,
            grant_type: 'authorization_code',
        });

        if (code_verifier) {
            params.append('code_verifier', code_verifier);
        }

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params,
        });

        const tokenData = await tokenRes.json();
        if (tokenData.error) return res.status(400).json({ error: tokenData.error_description || tokenData.error });

        // Verify and decode email from id_token (JWT) with signature validation
        // id_token is present when openid email scopes are requested
        let email;
        if (tokenData.id_token) {
            email = await getEmailFromIdToken(tokenData.id_token);
        } else {
            // Fallback: fetch from userinfo (requires outbound network to Google)
            email = await getEmailFromToken(tokenData.access_token);
        }

        // Check if user is revoked by RISC (Cross-Account Protection)
        if (isUserRevoked(email)) {
            console.log(`Auth exchange blocked: user=${logId(email)} is revoked by RISC`);
            return res.status(403).json({ error: 'Account access revoked due to a security event. Please contact support.' });
        }

        // Private mode: reject accounts outside ALLOWED_EMAILS before anything is stored
        if (!isAllowedEmail(email)) {
            console.log('Auth exchange blocked: account not in ALLOWED_EMAILS');
            return res.status(403).json(ACCESS_RESTRICTED);
        }

        // Look up spreadsheetId for this user; fall back to env for owner
        const users = loadUsers();
        const spreadsheetId = getUserSpreadsheetId(users, email) || (email === process.env.OWNER_EMAIL ? process.env.VITE_SPREADSHEET_ID : null) || null;

        console.log(`Auth exchange: user=${logId(email)}, spreadsheet_id=${spreadsheetId ? 'found' : 'not found'}`);

        // Update refresh token in existing API key so /api/export keeps working
        if (tokenData.refresh_token) {
            try {
                const encryptedRefreshToken = encryptToken(tokenData.refresh_token);
                await saveApiKeysAtomic(apiKeys => {
                    for (const [, meta] of Object.entries(apiKeys)) {
                        if (meta.email === email) {
                            meta.refreshToken = encryptedRefreshToken;
                        }
                    }
                    return apiKeys;
                });
            } catch (e) {
                console.error('Failed to update refresh token in API key:', e);
            }
        }

        res.json({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_in: tokenData.expires_in,
            email,
            spreadsheet_id: spreadsheetId,
        });
    } catch (error) {
        console.error('Auth exchange error:', error);
        res.status(500).json({ error: 'Failed to exchange authorization code' });
    }
});

// ─── Auth: refresh token ──────────────────────────────────────────────────────

app.post('/api/auth/refresh', authLimiter, validateOrigin, async (req, res) => {
    try {
        const { refresh_token } = req.body;
        if (!refresh_token) return res.status(400).json({ error: 'Missing refresh token' });

        const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
        const clientSecret = getClientSecret();
        if (!clientId || !clientSecret) {
            return res.status(500).json({ error: 'Server misconfiguration' });
        }

        const params = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token,
            grant_type: 'refresh_token',
        });

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params,
        });

        const data = await tokenRes.json();
        if (data.error) {
            return res.status(400).json({ error: data.error_description || data.error, code: data.error });
        }

        // Derive email from the new access token — never trust client-supplied email
        let email = null;
        if (data.id_token) {
            try { email = await getEmailFromIdToken(data.id_token); } catch { /* fallback below */ }
        }
        if (!email) {
            try { email = await getEmailFromToken(data.access_token); } catch { /* no email available */ }
        }

        // Check if user is revoked by RISC (Cross-Account Protection)
        if (isUserRevoked(email)) {
            console.log(`Auth refresh blocked: user=${logId(email)} is revoked by RISC`);
            return res.status(403).json({ error: 'Account access revoked due to a security event. Please contact support.' });
        }

        // Private mode: existing sessions of non-allowed accounts cannot be renewed
        if (!isAllowedEmail(email)) {
            console.log('Auth refresh blocked: account not in ALLOWED_EMAILS');
            return res.status(403).json(ACCESS_RESTRICTED);
        }

        const users = loadUsers();
        const spreadsheetId = (email && getUserSpreadsheetId(users, email)) || (email === process.env.OWNER_EMAIL ? process.env.VITE_SPREADSHEET_ID : null) || null;
        console.log(`Auth refresh: user=${logId(email)}, spreadsheet_id=${spreadsheetId ? 'found' : 'MISSING'}, has_refresh_token=${!!data.refresh_token}`);

        res.json({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in,
            email,
            spreadsheet_id: spreadsheetId,
        });
    } catch (error) {
        console.error('Auth refresh error:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

// ─── Auth: logout (best-effort Google token revocation) ──────────────────────
// Revokes the refresh token at Google so a copy left in a browser's storage
// cannot mint new access tokens. Always 204: the client clears its session
// regardless of whether Google accepted the revocation.

app.post('/api/auth/logout', apiLimiter, validateOrigin, async (req, res) => {
    const token = req.body?.refresh_token;
    if (token && typeof token === 'string' && token.length <= 2048) {
        try {
            const r = await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(token), {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            if (!r.ok) console.warn(`Logout: Google token revocation returned ${r.status}`);
        } catch (err) {
            console.warn('Logout: Google token revocation failed:', err.message);
        }
    }
    res.status(204).end();
});

// ─── User: register / update spreadsheet ID ───────────────────────────────────

const SPREADSHEET_ID_PATTERN = /^[a-zA-Z0-9_-]{10,100}$/;

app.post('/api/user/spreadsheet', apiLimiter, validateOrigin, async (req, res) => {
    try {
        const accessToken = extractBearer(req);
        if (!accessToken) return res.status(401).json({ error: 'Missing access token' });

        const { spreadsheet_id } = req.body;
        if (!spreadsheet_id || typeof spreadsheet_id !== 'string' || !spreadsheet_id.trim()) {
            return res.status(400).json({ error: 'Missing or invalid spreadsheet_id' });
        }
        const trimmedId = spreadsheet_id.trim();
        if (!SPREADSHEET_ID_PATTERN.test(trimmedId)) {
            return res.status(400).json({ error: 'Invalid spreadsheet_id format' });
        }

        const email = await requireAllowedEmail(accessToken, res);
        if (!email) return;
        await saveUsersAtomic(users => {
            const existing = users[email] || {};
            users[email] = { ...(typeof existing === 'object' ? existing : {}), spreadsheetId: trimmedId };
            return users;
        });

        // Also update spreadsheetId in any existing API key for this user
        await saveApiKeysAtomic(apiKeys => {
            for (const [, meta] of Object.entries(apiKeys)) {
                if (meta.email === email) {
                    meta.spreadsheetId = trimmedId;
                }
            }
            return apiKeys;
        });

        console.log(`Registered spreadsheet for user=${logId(email)}`);
        res.json({ success: true, email, spreadsheet_id: trimmedId });
    } catch (error) {
        console.error('Register spreadsheet error:', error);
        res.status(500).json({ error: 'Failed to register spreadsheet' });
    }
});

// ─── User preferences (enabled tabs) ─────────────────────────────────────────

const ALL_TABS = ['Weekdays', 'Weekend', 'Focus', 'Graphs', 'MobNotes', 'SmokeTemptation', 'Counters', 'Help'];

app.get('/api/user/preferences', apiLimiter, async (req, res) => {
    try {
        // Support both OAuth Bearer and API key auth
        let email = null;
        const apiToken = req.headers['x-api-token'];
        const bearer = extractBearer(req);

        if (apiToken) {
            const record = findApiKeyRecord(loadApiKeys(), apiToken);
            if (record) {
                req.apiKeyUser = record;
                email = req.apiKeyUser.email;
                if (!isAllowedEmail(email)) return res.status(403).json(ACCESS_RESTRICTED);
            } else {
                return res.status(401).json({ error: 'Invalid API key' });
            }
        } else if (bearer) {
            email = await requireAllowedEmail(bearer, res);
            if (!email) return;
            req.oauthUser = { email, accessToken: bearer };
        } else {
            return res.status(401).json({ error: 'Missing access token' });
        }

        const users = loadUsers();
        const userEntry = email ? (users[email] || {}) : {};

        // 1. Try to fetch from Spreadsheet headers first (for privacy)
        try {
            const spreadsheetId = await resolveSpreadsheetId(req);
            const sheets = await getSheetsClientForRequest(req);
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'Counters!1:1',
            });

            const headers = response.data.values?.[0] || [];
            if (headers.length > 0) {
                const sheetPrefs = parseHeadersForConfig(headers);
                if (sheetPrefs.temptations?.length > 0 || sheetPrefs.enabled_tabs) {
                    return res.json({
                        enabled_tabs: sheetPrefs.enabled_tabs || userEntry.enabled_tabs || null,
                        default_tab: sheetPrefs.default_tab || userEntry.default_tab || null,
                        temptations: sheetPrefs.temptations || userEntry.temptations || null,
                    });
                }
            }
        } catch (err) {
            console.warn('Failed to read preferences from sheet, using local:', err.message);
        }

        res.json({
            enabled_tabs: userEntry.enabled_tabs || null,
            default_tab: userEntry.default_tab || null,
            temptations: userEntry.temptations || null,
        });
    } catch (error) {
        console.error('Get preferences error:', error);
        res.status(500).json({ error: 'Failed to get preferences' });
    }
});

function parseHeadersForConfig(headers) {
    const temptationsMap = {};
    let enabled_tabs = null;
    let default_tab = null;

    headers.forEach(h => {
        if (!h || typeof h !== 'string') return;

        if (h.startsWith('_config|')) {
            const parts = h.split('|');
            parts.forEach(p => {
                if (p.startsWith('tabs:')) enabled_tabs = p.replace('tabs:', '').split(',').filter(Boolean);
                if (p.startsWith('default:')) default_tab = p.replace('default:', '');
            });
        } else if (h.includes('|')) {
            const [actionId, icon, color, label, categoryId, categoryLabel, type] = h.split('|');
            if (actionId && icon && color) {
                const catId = categoryId || 'shared';
                if (!temptationsMap[catId]) {
                    temptationsMap[catId] = {
                        id: catId,
                        label: categoryLabel || 'Temptations',
                        icon: icon,
                        actions: []
                    };
                }
                temptationsMap[catId].actions.push({ id: actionId, label: label || actionId, color, type: type || 'other' });
            }
        }
    });

    return {
        temptations: Object.values(temptationsMap),
        enabled_tabs,
        default_tab
    };
}

app.post('/api/user/preferences', apiLimiter, validateOrigin, async (req, res) => {
    try {
        const accessToken = extractBearer(req);
        if (!accessToken) return res.status(401).json({ error: 'Missing access token' });

        const { enabled_tabs, default_tab, temptations } = req.body;
        const email = await requireAllowedEmail(accessToken, res);
        if (!email) return;

        // 1. Update Sheet Headers (Privacy First)
        try {
            const spreadsheetId = await resolveSpreadsheetId(req);
            const sheets = await getSheetsClientForRequest(req);

            // Get current rows to preserve data columns
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'Counters!1:1',
            });
            const currentHeaders = response.data.values?.[0] || ['Date'];

            // Reconstruct headers
            const newHeaders = ['Date'];
            const actionIdToHeader = {};

            if (temptations && Array.isArray(temptations)) {
                temptations.forEach(t => {
                    t.actions.forEach(a => {
                        actionIdToHeader[a.id] = `${a.id}|${t.icon}|${a.color}|${a.label}|${t.id}|${t.label}|${a.type || 'other'}`;
                    });
                });
            }

            // Map existing columns to their new encoded names if they exist, or keep encoded ones
            currentHeaders.forEach(h => {
                if (!h || h === 'Date' || h.startsWith('_config')) return;
                const id = h.split('|')[0];
                if (actionIdToHeader[id]) {
                    newHeaders.push(actionIdToHeader[id]);
                    delete actionIdToHeader[id];
                } else {
                    newHeaders.push(h); // Keep unknown columns
                }
            });

            // Append brand new actions
            Object.values(actionIdToHeader).forEach(h => newHeaders.push(h));

            // Add config column
            const configColumn = [`_config|tabs:${(enabled_tabs || []).join(',')}|default:${default_tab || ''}`];
            newHeaders.push(configColumn[0]);

            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: 'Counters!1:1',
                valueInputOption: 'RAW',
                requestBody: { values: [newHeaders] }
            });
        } catch (err) {
            console.warn('Failed to save preferences to sheet:', err.message);
        }

        // 2. Keep local copy for fallback (optional but safe)
        await saveUsersAtomic(users => {
            const existing = users[email] || {};
            users[email] = {
                ...(typeof existing === 'object' ? existing : {}),
                enabled_tabs: enabled_tabs || existing.enabled_tabs,
                default_tab: default_tab || existing.default_tab,
                temptations: temptations || existing.temptations || null
            };
            return users;
        });

        res.json({ success: true, enabled_tabs, default_tab, temptations });
    } catch (error) {
        console.error('Save preferences error:', error);
        res.status(500).json({ error: 'Failed to save preferences' });
    }
});

// ─── User API key management ──────────────────────────────────────────────────

// GET current user's API key (if any)
app.get('/api/user/apikey', apiLimiter, async (req, res) => {
    try {
        const accessToken = extractBearer(req);
        if (!accessToken) return res.status(401).json({ error: 'Missing access token' });

        const email = await requireAllowedEmail(accessToken, res);
        if (!email) return;
        const apiKeys = loadApiKeys();

        // Find existing key for this user
        const existingKey = Object.entries(apiKeys).find(([, v]) => v.email === email);
        if (existingKey) {
            // Show masked key + metadata (only the plaintext prefix is stored)
            const [, meta] = existingKey;
            const masked = (meta.prefix || 'hk_') + '...';
            return res.json({ has_key: true, masked_key: masked, created_at: meta.createdAt });
        }

        res.json({ has_key: false });
    } catch (error) {
        console.error('Get API key error:', error);
        res.status(500).json({ error: 'Failed to get API key info' });
    }
});

// POST generate a new API key for the current user (revokes existing one)
app.post('/api/user/apikey', apiLimiter, validateOrigin, async (req, res) => {
    try {
        const accessToken = extractBearer(req);
        if (!accessToken) return res.status(401).json({ error: 'Missing access token' });

        const email = await requireAllowedEmail(accessToken, res);
        if (!email) return;
        const users = loadUsers();

        // Accept spreadsheet_id from client (the client always has it in session)
        const clientSpreadsheetId = req.body?.spreadsheet_id;
        if (clientSpreadsheetId && typeof clientSpreadsheetId === 'string' && SPREADSHEET_ID_PATTERN.test(clientSpreadsheetId.trim())) {
            const trimmedId = clientSpreadsheetId.trim();
            // Sync to users.json if missing or different
            if (getUserSpreadsheetId(users, email) !== trimmedId) {
                await saveUsersAtomic(u => {
                    const existing = u[email] || {};
                    u[email] = { ...(typeof existing === 'object' ? existing : {}), spreadsheetId: trimmedId };
                    return u;
                });
                if (!users[email] || typeof users[email] !== 'object') users[email] = {};
                users[email].spreadsheetId = trimmedId;
            }
        }

        const spreadsheetId = getUserSpreadsheetId(users, email)
            || (email === process.env.OWNER_EMAIL ? (process.env.VITE_SPREADSHEET_ID || process.env.SPREADSHEET_ID) : null);
        if (!spreadsheetId) {
            return res.status(400).json({ error: 'No spreadsheet registered. Set up your spreadsheet first.' });
        }

        // Encrypt and store the user's refresh token so API key requests
        // can use the user's own OAuth credentials (no service account needed)
        const refreshToken = req.body?.refresh_token;
        let encryptedRefreshToken = null;
        if (refreshToken && typeof refreshToken === 'string') {
            try {
                encryptedRefreshToken = encryptToken(refreshToken);
            } catch (e) {
                console.error('Failed to encrypt refresh token:', e);
            }
        }

        const newKey = generateApiKey();

        await saveApiKeysAtomic(apiKeys => {
            // Remove any existing key for this user
            for (const [existingKey, meta] of Object.entries(apiKeys)) {
                if (meta.email === email) {
                    delete apiKeys[existingKey];
                }
            }
            // Add new key (stored hashed; plaintext is returned to the client once)
            const entry = {
                email,
                spreadsheetId,
                createdAt: new Date().toISOString(),
                prefix: newKey.slice(0, API_KEY_PREFIX_LEN),
            };
            if (encryptedRefreshToken) {
                entry.refreshToken = encryptedRefreshToken;
                console.log(`API key generated for user=${logId(email)} WITH refresh token`);
            } else {
                console.log(`API key generated for user=${logId(email)} WITHOUT refresh token!`);
            }
            apiKeys[hashApiKey(newKey)] = entry;
            return apiKeys;
        });

        res.json({ success: true, api_key: newKey });
    } catch (error) {
        console.error('Generate API key error:', error);
        res.status(500).json({ error: 'Failed to generate API key' });
    }
});

// DELETE revoke the current user's API key
app.delete('/api/user/apikey', apiLimiter, validateOrigin, async (req, res) => {
    try {
        const accessToken = extractBearer(req);
        if (!accessToken) return res.status(401).json({ error: 'Missing access token' });

        const email = await requireAllowedEmail(accessToken, res);
        if (!email) return;

        let found = false;
        await saveApiKeysAtomic(apiKeys => {
            for (const [existingKey, meta] of Object.entries(apiKeys)) {
                if (meta.email === email) {
                    delete apiKeys[existingKey];
                    found = true;
                }
            }
            return apiKeys;
        });

        if (!found) {
            return res.status(404).json({ error: 'No API key found' });
        }

        console.log(`API key revoked for user=${logId(email)}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Revoke API key error:', error);
        res.status(500).json({ error: 'Failed to revoke API key' });
    }
});

// ─── Static files ─────────────────────────────────────────────────────────────

// /.well-known (Digital Asset Links for the Android TWA, RFC 8615) must be served
// explicitly: serve-static 2.x (Express 5) ignores dotfile paths by default, so
// the generic handler below answers 404 for /.well-known/assetlinks.json. Chrome
// then fails the TWA verification and shows the browser address bar in the app.
app.use('/.well-known', express.static(path.join(__dirname, 'dist', '.well-known'), {
    dotfiles: 'allow',
    index: false,
}));

app.use(express.static(path.join(__dirname, 'dist')));

// ─── API token middleware (for export / counter endpoints) ────────────────────
// Supports two auth methods (checked in order):
// 1. Per-user API key via X-API-Token header (looked up in apikeys.json)
// 2. OAuth Bearer token via Authorization header (user's own Google token)

const authenticate = async (req, res, next) => {
    const apiToken = req.headers['x-api-token'];
    const bearer = extractBearer(req);

    // 1. Per-user API key
    if (apiToken) {
        const record = findApiKeyRecord(loadApiKeys(), apiToken);
        if (record) {
            // Private mode: widget keys of non-allowed accounts stop working too
            if (!isAllowedEmail(record.email)) {
                return res.status(403).json(ACCESS_RESTRICTED);
            }
            req.apiKeyUser = record; // { email, spreadsheetId, createdAt, prefix, refreshToken? }
            return next();
        }

        return res.status(401).json({ error: 'Unauthorized: Invalid API key.' });
    }

    // 2. OAuth Bearer token — use user's own Google credentials
    if (bearer) {
        let email;
        try {
            email = await verifyAccessToken(bearer);
        } catch (err) {
            if (!(err instanceof TokenVerificationError)) {
                console.error('Bearer verification failed:', err.message);
            }
            return res.status(401).json({ error: 'Unauthorized: Invalid Bearer token.' });
        }
        if (!isAllowedEmail(email)) return res.status(403).json(ACCESS_RESTRICTED);
        req.oauthUser = { email, accessToken: bearer };
        return next();
    }

    return res.status(401).json({ error: 'Unauthorized: Missing API key or Bearer token.' });
};

// ─── Google Sheets client ─────────────────────────────────────────────────────

// Service account client (used when authenticating via API key)
const getServiceAccountSheetsClient = async () => {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!email || !privateKey) {
        throw new Error('Missing Google Service Account credentials. When using API key auth, the sheet must be shared with the service account.');
    }

    const auth = new google.auth.JWT(
        email,
        undefined,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets']
    );

    return google.sheets({ version: 'v4', auth });
};

// OAuth client (uses user's own access token — no service account sharing needed)
const getUserSheetsClient = (accessToken) => {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    return google.sheets({ version: 'v4', auth });
};

// Refresh an access token using a refresh_token
async function refreshAccessToken(refreshToken) {
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = getClientSecret();
    if (!clientId || !clientSecret) throw new Error('Missing OAuth client credentials for token refresh');

    const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
    });

    const data = await res.json();
    if (data.error) throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
    return data.access_token;
}

// Get the appropriate Sheets client for the current request
// - OAuth Bearer → user's own token (no sheet sharing needed)
// - API key with refresh token → user's OAuth via refresh (no sheet sharing needed)
// - API key without refresh token → service account (sheet must be shared)
async function getSheetsClientForRequest(req) {
    if (req.oauthUser) {
        return getUserSheetsClient(req.oauthUser.accessToken);
    }
    // API key with stored refresh token — use user's own credentials
    if (req.apiKeyUser?.refreshToken) {
        try {
            const refreshToken = decryptToken(req.apiKeyUser.refreshToken);
            const accessToken = await refreshAccessToken(refreshToken);
            return getUserSheetsClient(accessToken);
        } catch (e) {
            console.error('API key refresh token failed, falling back to service account:', e.message);
        }
    }
    return getServiceAccountSheetsClient();
}

// Resolve spreadsheetId for a request based on auth method
async function resolveSpreadsheetId(req) {
    // 1. Per-user API key — spreadsheetId stored with the key
    if (req.apiKeyUser) {
        return req.apiKeyUser.spreadsheetId;
    }

    // 2. OAuth Bearer — look up by email
    if (req.oauthUser) {
        const users = loadUsers();
        const sid = getUserSpreadsheetId(users, req.oauthUser.email);
        if (sid) return sid;
    }

    throw new Error('No spreadsheet associated with this user.');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HEADER_PATTERN = /giorno|date|day/i;

const parseCounterRows = (rows, oldest, newest) => {
    if (!rows || rows.length === 0) return { entries: [], metadata: {} };

    const headers = rows[0];
    const dateIdx = headers.findIndex(h => h && /date|giorno/i.test(h.split('|')[0]));
    if (dateIdx === -1) return { entries: [], metadata: {} };

    const colMap = {};
    const metadata = {};

    headers.forEach((h, i) => {
        if (i === dateIdx || !h || h.startsWith('_config')) return;

        const parts = h.split('|');
        const id = parts[0].toLowerCase();

        if (parts.length > 1) {
            const [actionId, icon, color, label, categoryId, categoryLabel, type] = parts;
            const resolvedType = type || 'other';
            const resolvedLabel = label || actionId;
            const resolvedCategoryLabel = categoryLabel || 'Temptations';

            // Temptation columns are exported under their real name
            // (category + action), e.g. "Smoking - Resisted". Other counters
            // keep their internal id as the key.
            const isTemptation = resolvedType === 'resist' || resolvedType === 'succumb';
            const exportKey = isTemptation
                ? `${resolvedCategoryLabel} - ${resolvedLabel}`
                : id;

            colMap[exportKey] = i;
            metadata[exportKey] = {
                id,
                icon,
                color,
                label: resolvedLabel,
                categoryId: categoryId || 'shared',
                categoryLabel: resolvedCategoryLabel,
                type: resolvedType
            };
        } else {
            colMap[id] = i;
        }
    });

    const entries = rows.slice(1).filter(row => {
        const rowDate = row[dateIdx];
        if (!rowDate) return false;
        if (oldest && rowDate < oldest) return false;
        if (newest && rowDate > newest) return false;
        return true;
    }).map(row => {
        const entry = { date: row[dateIdx] };
        Object.keys(colMap).forEach(key => {
            entry[key] = parseInt(row[colMap[key]] || '0', 10);
        });
        return entry;
    });

    return { entries, metadata, headers, dateIdx };
};

const rowsToObjects = (rows) => {
    if (!rows || rows.length === 0) return [];

    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        if (rows[i]?.some(c => typeof c === 'string' && HEADER_PATTERN.test(c))) {
            headerRowIndex = i;
            break;
        }
    }

    const headers = rows[headerRowIndex];
    if (!headers || headers.length === 0) return [];

    return rows.slice(headerRowIndex + 1).map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            if (header) obj[header] = row[index];
        });
        return obj;
    });
};

const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return null;
};

const filterData = (data, oldest, newest) => {
    if ((!oldest && !newest) || !data || data.length === 0) return data;
    return data.filter(item => {
        const dateKey = Object.keys(item).find(k => /date|giorno|day/i.test(k));
        if (!dateKey) return true;
        const itemDateStr = parseDate(item[dateKey]);
        if (!itemDateStr) return true;
        if (oldest && itemDateStr < oldest) return false;
        if (newest && itemDateStr > newest) return false;
        return true;
    });
};

// ─── Color extraction helper ─────────────────────────────────────────────────

const sheetColorToHex = (color) => {
    if (!color) return null;
    const r = Math.round((color.red || 0) * 255);
    const g = Math.round((color.green || 0) * 255);
    const b = Math.round((color.blue || 0) * 255);
    // Skip white/default backgrounds
    if (r >= 250 && g >= 250 && b >= 250) return null;
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
};

const extractHabitColors = (sheetData) => {
    if (!sheetData || !sheetData.data) return {};
    const rowData = sheetData.data[0]?.rowData;
    if (!rowData) return {};

    // Find header row
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(rowData.length, 10); i++) {
        const row = rowData[i];
        if (row?.values?.some(cell => {
            const val = cell.userEnteredValue?.stringValue || cell.formattedValue;
            return val && HEADER_PATTERN.test(val);
        })) {
            headerRowIndex = i;
            break;
        }
    }

    const colors = {};
    const headerRow = rowData[headerRowIndex];
    if (headerRow?.values) {
        headerRow.values.forEach(cell => {
            const val = cell.userEnteredValue?.stringValue || cell.formattedValue;
            if (!val) return;
            const bgColor = cell.userEnteredFormat?.backgroundColor;
            const hex = sheetColorToHex(bgColor);
            if (hex) colors[val] = hex;
        });
    }
    return colors;
};

// ─── Export endpoint ──────────────────────────────────────────────────────────

app.get('/api/export', authenticate, async (req, res) => {
    try {
        const spreadsheetId = await resolveSpreadsheetId(req);
        const oldest = req.query.oldest;
        const newest = req.query.newest;

        const sheets = await getSheetsClientForRequest(req);
        const ranges = ['Weekdays!A:Z', 'Weekend!A:Z', 'Counters!A:Z', 'MobNotes!A:Z'];

        // Fetch values and colors in parallel
        const [valuesResponse, colorsResponse] = await Promise.all([
            sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges }),
            sheets.spreadsheets.get({
                spreadsheetId,
                ranges: ['Weekdays!A1:Z5', 'Weekend!A1:Z5'],
                includeGridData: true,
            }),
        ]);

        const valueRanges = valuesResponse.data.valueRanges;

        // Extract colors from grid data
        const colorSheets = colorsResponse.data.sheets || [];
        const colors = { weekdays: {}, weekend: {} };
        colorSheets.forEach(sheet => {
            const title = sheet.properties?.title;
            if (title === 'Weekdays') colors.weekdays = extractHabitColors(sheet);
            else if (title === 'Weekend') colors.weekend = extractHabitColors(sheet);
        });

        const result = {
            timestamp: new Date().toISOString(),
            weekdays: [], weekend: [], counters: [], notes: [],
            colors,
        };

        if (valueRanges) {
            valueRanges.forEach(rangeData => {
                const range = rangeData.range;
                if (!range) return;
                if (range.startsWith('Weekdays')) result.weekdays = filterData(rowsToObjects(rangeData.values), oldest, newest);
                else if (range.startsWith('Weekend')) result.weekend = filterData(rowsToObjects(rangeData.values), oldest, newest);
                else if (range.startsWith('Counters')) {
                    const { entries, metadata } = parseCounterRows(rangeData.values, oldest, newest);
                    result.counters = entries;
                    // Inject counter metadata into the colors object
                    if (!result.colors.counters) result.colors.counters = {};
                    Object.assign(result.colors.counters, metadata);
                }
                else if (range.startsWith('MobNotes')) result.notes = filterData(rowsToObjects(rangeData.values), oldest, newest);
            });
        }

        res.json(result);
    } catch (error) {
        console.error('Export Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─── Habit colors endpoint ────────────────────────────────────────────────────

app.get('/api/colors', authenticate, async (req, res) => {
    try {
        const spreadsheetId = await resolveSpreadsheetId(req);
        const sheets = await getSheetsClientForRequest(req);

        const response = await sheets.spreadsheets.get({
            spreadsheetId,
            ranges: ['Weekdays!A1:Z5', 'Weekend!A1:Z5'],
            includeGridData: true,
        });

        const colorSheets = response.data.sheets || [];
        const colors = { weekdays: {}, weekend: {} };
        colorSheets.forEach(sheet => {
            const title = sheet.properties?.title;
            if (title === 'Weekdays') colors.weekdays = extractHabitColors(sheet);
            else if (title === 'Weekend') colors.weekend = extractHabitColors(sheet);
        });

        res.json(colors);
    } catch (error) {
        console.error('Colors Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─── Counter GET endpoint ─────────────────────────────────────────────────────

app.get('/api/counter', authenticate, async (req, res) => {
    try {
        const spreadsheetId = await resolveSpreadsheetId(req);
        const sheets = await getSheetsClientForRequest(req);
        const sheetName = 'Counters';
        const oldest = req.query.oldest;
        const newest = req.query.newest;
        const todayStr = new Date().toISOString().split('T')[0];

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:Z`,
        });

        const rows = response.data.values || [];
        if (rows.length === 0) return res.json({ success: true, entries: [] });

        const { entries, metadata, headers, dateIdx } = parseCounterRows(rows, oldest, newest);

        // If no date params, return today only
        if (!oldest && !newest) {
            const todayStr = new Date().toISOString().split('T')[0];
            const todayEntry = entries.find(e => e.date === todayStr) || { date: todayStr };
            // Ensure all discovered counters exist in today's entry even if 0
            Object.keys(metadata).forEach(key => {
                if (todayEntry[key] === undefined) todayEntry[key] = 0;
            });
            return res.json({ success: true, date: todayStr, counters: todayEntry, metadata });
        }

        res.json({ success: true, entries, metadata });
    } catch (error) {
        console.error('Counter GET Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─── Counter increment endpoint ───────────────────────────────────────────────

// Counter names end up as sheet column headers: keep them to a safe charset
// and never let a client create/overwrite the reserved `_config` column.
const COUNTER_NAME_PATTERN = /^[A-Za-z0-9 _\-]{1,40}$/;

// 0-based column index → A1 column letters (A..Z, AA..AZ, BA.., ...)
function columnLetter(idx) {
    let n = idx + 1;
    let letters = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        letters = String.fromCharCode(65 + rem) + letters;
        n = Math.floor((n - 1) / 26);
    }
    return letters;
}

app.post('/api/counter/increment', authenticate, async (req, res) => {
    try {
        const { counter } = req.body;
        if (!counter || typeof counter !== 'string' || !COUNTER_NAME_PATTERN.test(counter)) {
            return res.status(400).json({ error: 'Invalid or missing counter name' });
        }
        if (counter.startsWith('_config')) {
            return res.status(400).json({ error: 'Reserved counter name' });
        }

        const spreadsheetId = await resolveSpreadsheetId(req);
        const sheets = await getSheetsClientForRequest(req);
        const sheetName = 'Counters';
        const dateStr = new Date().toISOString().split('T')[0];

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:Z`,
        });

        const rows = response.data.values || [];
        if (rows.length === 0) {
            // Initialize sheet if empty
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!A1:B1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [['Date', counter]] },
            });
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: sheetName,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[dateStr, 1]] },
            });
            return res.json({ success: true, counter, newValue: 1, date: dateStr });
        }

        const headers = rows[0];
        const dateIdx = headers.findIndex(h => h && /date/i.test(h.split('|')[0]));
        let counterIdx = headers.findIndex(h => h && h.split('|')[0].toLowerCase() === counter.toLowerCase());

        // If counter column doesn't exist, add it
        if (counterIdx === -1) {
            counterIdx = headers.length;
            const colLetter = columnLetter(counterIdx);
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!${colLetter}1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[counter]] },
            });
        }

        let rowIndex = rows.findIndex(r => r[dateIdx] === dateStr);
        let newValue = 1;

        if (rowIndex !== -1) {
            const currentVal = parseInt(rows[rowIndex][counterIdx] || '0', 10);
            newValue = currentVal + 1;
            const colLetter = columnLetter(counterIdx);
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!${colLetter}${rowIndex + 1}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[newValue]] },
            });
        } else {
            const newRow = new Array(headers.length).fill(0);
            newRow[dateIdx] = dateStr;
            newRow[counterIdx] = 1;
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: sheetName,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [newRow] },
            });
        }

        console.log(`Counter incremented: ${counter} = ${newValue} on ${dateStr}`);
        res.json({ success: true, counter, newValue, date: dateStr });
    } catch (error) {
        console.error('Counter Increment Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─── Gemini API proxy (bypasses geo-restrictions on client-side calls) ────

const geminiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    message: { error: 'Too many AI requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.post('/api/gemini/chat', geminiLimiter, validateOrigin, async (req, res) => {
    try {
        const accessToken = extractBearer(req);
        if (!accessToken) return res.status(401).json({ error: 'Missing access token' });

        // Verify the user is authenticated with Google
        if (!(await requireAllowedEmail(accessToken, res))) return;

        const { apiKey, contents, generationConfig } = req.body;
        if (!apiKey || !contents) {
            return res.status(400).json({ error: 'Missing apiKey or contents' });
        }

        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents, generationConfig }),
            }
        );

        const data = await geminiRes.json();
        if (!geminiRes.ok) {
            return res.status(geminiRes.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Gemini proxy error:', error);
        res.status(500).json({ error: 'Failed to proxy Gemini request' });
    }
});

// ─── Anthropic API proxy ────────────────────────────────────────────────────

app.post('/api/anthropic/chat', geminiLimiter, validateOrigin, async (req, res) => {
    try {
        const accessToken = extractBearer(req);
        if (!accessToken) return res.status(401).json({ error: 'Missing access token' });

        // Verify the user is authenticated with Google
        if (!(await requireAllowedEmail(accessToken, res))) return;

        const { apiKey, system, messages, max_tokens } = req.body;
        if (!apiKey || !messages) {
            return res.status(400).json({ error: 'Missing apiKey or messages' });
        }

        console.log(`[Anthropic Proxy] Requesting chat: system length=${system?.length}, messages count=${messages?.length}`);

        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: max_tokens || 4096,
                system,
                messages,
            }),
        });

        const data = await anthropicRes.json();
        if (!anthropicRes.ok) {
            return res.status(anthropicRes.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Anthropic proxy error:', error);
        res.status(500).json({ error: 'Failed to proxy Anthropic request' });
    }
});

// ─── RISC: Cross-Account Protection (Security Event Tokens) ──────────────────
// Google sends SETs (Security Event Tokens) when a user's account is compromised,
// disabled, or sessions are revoked. We verify the JWT and revoke local sessions.

const RISC_REVOKED_FILE = path.join(__dirname, 'data', 'risc-revoked.json');

function loadRevokedUsers() {
    try {
        if (fs.existsSync(RISC_REVOKED_FILE)) return JSON.parse(fs.readFileSync(RISC_REVOKED_FILE, 'utf8'));
    } catch { /* empty */ }
    return {};
}

function saveRevokedUsers(data) {
    fs.writeFileSync(RISC_REVOKED_FILE, JSON.stringify(data, null, 2));
}

// Verify a RISC Security Event Token (SET) JWT from Google
async function verifySecurityEventToken(token) {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid SET format');

    const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));

    // Validate issuer — RISC tokens come from accounts.google.com
    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
        throw new Error('Invalid SET issuer');
    }

    // Validate audience — must match our client ID
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
    if (payload.aud !== clientId) {
        throw new Error('Invalid SET audience');
    }

    // Verify signature
    const certs = await getGooglePublicKeys();
    const key = certs.keys?.find(k => k.kid === header.kid);
    if (!key) throw new Error('SET signed with unknown key');

    const publicKey = crypto.createPublicKey({ key, format: 'jwk' });
    const signatureValid = crypto.verify(
        'sha256',
        Buffer.from(parts[0] + '.' + parts[1]),
        publicKey,
        base64UrlDecode(parts[2])
    );
    if (!signatureValid) throw new Error('SET signature verification failed');

    return payload;
}

// Unauthenticated endpoint (Google pushes SETs here): rate limit it so bogus
// tokens cannot be used to hammer JWT verification / cert fetching.
const riscLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.post('/api/risc/events', riscLimiter, express.text({ type: 'application/secevent+jwt' }), async (req, res) => {
    try {
        const token = req.body;
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'Missing SET' });
        }

        const payload = await verifySecurityEventToken(token);
        const events = payload.events || {};
        const subject = payload.sub || null;

        console.log(`[RISC] Received security event for subject=${logId(subject)}`, Object.keys(events));

        const revoked = loadRevokedUsers();

        for (const [eventType, eventData] of Object.entries(events)) {
            const subjectEmail = eventData?.subject?.email || subject;
            console.log(`[RISC] Event: ${eventType}, user=${logId(subjectEmail)}`);

            switch (eventType) {
                case 'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked':
                case 'https://schemas.openid.net/secevent/risc/event-type/tokens-revoked':
                case 'https://schemas.openid.net/secevent/risc/event-type/account-disabled':
                case 'https://schemas.openid.net/secevent/risc/event-type/account-purged':
                case 'https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required':
                    if (subjectEmail) {
                        revoked[subjectEmail] = {
                            event: eventType,
                            timestamp: new Date().toISOString(),
                            reason: eventData?.reason || 'security_event',
                        };
                        console.log(`[RISC] Revoked access for user=${logId(subjectEmail)} due to ${eventType}`);
                    }
                    break;
                case 'https://schemas.openid.net/secevent/risc/event-type/account-enabled':
                    // Account re-enabled — remove from revoked list
                    if (subjectEmail && revoked[subjectEmail]) {
                        delete revoked[subjectEmail];
                        console.log(`[RISC] Restored access for user=${logId(subjectEmail)}`);
                    }
                    break;
                default:
                    console.log(`[RISC] Unhandled event type: ${eventType}`);
            }
        }

        saveRevokedUsers(revoked);

        // Google expects 202 Accepted
        res.status(202).send();
    } catch (error) {
        console.error('[RISC] Error processing security event:', error.message);
        res.status(400).json({ error: 'Invalid security event token' });
    }
});

// Helper: check if a user is revoked by RISC
function isUserRevoked(email) {
    if (!email) return false;
    const revoked = loadRevokedUsers();
    return !!revoked[email];
}

// ─── Changelog ──────────────────────────────────────────────────────────────

app.get('/api/changelog', async (req, res) => {
    try {
        // Build-time copy might put it in dist or app root
        const distPath = path.join(__dirname, 'dist', 'CHANGELOG.md');
        const localPath = path.join(__dirname, 'CHANGELOG.md');
        const rootPath = path.join(__dirname, '..', 'CHANGELOG.md');

        let changelogPath = null;
        if (fs.existsSync(distPath)) changelogPath = distPath;
        else if (fs.existsSync(localPath)) changelogPath = localPath;
        else if (fs.existsSync(rootPath)) changelogPath = rootPath;

        if (!changelogPath) {
            return res.status(404).json({ error: 'Changelog not found' });
        }
        const content = fs.readFileSync(changelogPath, 'utf8');
        const hash = crypto.createHash('md5').update(content).digest('hex');
        res.json({ content, hash });
    } catch (error) {
        console.error('Changelog error:', error);
        res.status(500).json({ error: 'Failed to fetch changelog' });
    }
});

// ─── SPA fallback ─────────────────────────────────────────────────────────────

app.get('/{*splat}', (req, res) => {
    // Prevent SPA fallback for static assets (folders or file-like paths)
    // This ensures that missing assets return 404 instead of index.html,
    // which is required for PWA Widgets / Manifest / Icons to work correctly.
    if (req.path.includes('.') ||
        req.path.startsWith('/assets/') ||
        req.path.startsWith('/icons/') ||
        req.path.startsWith('/widgets/')) {
        return res.status(404).send('Not Found');
    }
    res.sendFile('index.html', { root: path.join(__dirname, 'dist') });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
