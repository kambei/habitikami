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
const PORT = process.env.PORT || 80;

// ─── User store (email → spreadsheetId) ──────────────────────────────────────
// Persisted to data/users.json mounted as a Docker volume.
// User preferences (e.g. enabled tabs) stored in data/preferences.json

const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const PREFS_FILE = path.join(__dirname, 'data', 'preferences.json');
const APIKEYS_FILE = path.join(__dirname, 'data', 'apikeys.json');

// Ensure data directory exists
fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });

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
// apikeys.json maps: { [apiKey]: { email, spreadsheetId, createdAt } }

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

function generateApiKey() {
    return 'hk_' + crypto.randomBytes(32).toString('hex');
}

// ─── Refresh token encryption ────────────────────────────────────────────────
// Encrypt user refresh tokens at rest using a server-side key derived from
// VITE_GOOGLE_CLIENT_SECRET (always available). AES-256-GCM.

function getEncryptionKey() {
    const secret = process.env.VITE_GOOGLE_CLIENT_SECRET;
    if (!secret) throw new Error('Cannot encrypt: VITE_GOOGLE_CLIENT_SECRET not set');
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
// OWNER_EMAIL is required; VITE_SPREADSHEET_ID is the owner's sheet
{
    const ownerEmail = process.env.OWNER_EMAIL;
    const ownerSpreadsheetId = process.env.VITE_SPREADSHEET_ID;
    if (ownerEmail && ownerSpreadsheetId) {
        const users = loadUsers();
        // Always update owner entry in case spreadsheet ID changed in env
        const existing = users[ownerEmail] || {};
        users[ownerEmail] = { ...(typeof existing === 'object' ? existing : {}), spreadsheetId: ownerSpreadsheetId };
        saveUsers(users);
        console.log(`Owner account seeded: ${ownerEmail}`);
    } else {
        console.warn('OWNER_EMAIL or VITE_SPREADSHEET_ID not set — owner account not seeded.');
    }
}

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
app.use(express.json());

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

// Fetch the Google email for an access token (fallback if no id_token)
async function getEmailFromToken(accessToken) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch user info from Google');
    const data = await res.json();
    if (!data.email) throw new Error('Google userinfo did not return an email');
    return data.email;
}

// Extract Bearer token from Authorization header
function extractBearer(req) {
    const auth = req.headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
    return null;
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
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Missing authorization code' });

        const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
        const clientSecret = process.env.VITE_GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            return res.status(500).json({ error: 'Server misconfiguration' });
        }

        // Validate redirect_uri — require explicit APP_ORIGIN in production
        const redirectUri = req.headers.origin || process.env.APP_ORIGIN;
        if (!redirectUri) {
            return res.status(400).json({ error: 'Missing origin' });
        }

        const params = new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        });

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

        // Look up spreadsheetId for this user; fall back to env for owner
        const users = loadUsers();
        const spreadsheetId = getUserSpreadsheetId(users, email) || (email === process.env.OWNER_EMAIL ? process.env.VITE_SPREADSHEET_ID : null) || null;

        console.log(`Auth exchange: email=${email}, spreadsheet_id=${spreadsheetId ? 'found' : 'not found'}`);

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
        const clientSecret = process.env.VITE_GOOGLE_CLIENT_SECRET;
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

        const users = loadUsers();
        const spreadsheetId = (email && getUserSpreadsheetId(users, email)) || (email === process.env.OWNER_EMAIL ? process.env.VITE_SPREADSHEET_ID : null) || null;

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

        const email = await getEmailFromToken(accessToken);
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

        console.log(`Registered spreadsheet for ${email}`);
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
        const accessToken = extractBearer(req);
        if (!accessToken) return res.status(401).json({ error: 'Missing access token' });

        const email = await getEmailFromToken(accessToken);
        const users = loadUsers();
        const userEntry = users[email] || {};

        res.json({
            enabled_tabs: userEntry.enabled_tabs || null,
            default_tab: userEntry.default_tab || null,
        });
    } catch (error) {
        console.error('Get preferences error:', error);
        res.status(500).json({ error: 'Failed to get preferences' });
    }
});

app.post('/api/user/preferences', apiLimiter, validateOrigin, async (req, res) => {
    try {
        const accessToken = extractBearer(req);
        if (!accessToken) return res.status(401).json({ error: 'Missing access token' });

        const { enabled_tabs, default_tab } = req.body;
        if (!Array.isArray(enabled_tabs) || enabled_tabs.length === 0) {
            return res.status(400).json({ error: 'enabled_tabs must be a non-empty array' });
        }
        const invalid = enabled_tabs.filter(t => !ALL_TABS.includes(t));
        if (invalid.length > 0) {
            return res.status(400).json({ error: 'Invalid tab names provided' });
        }
        if (default_tab && !ALL_TABS.includes(default_tab)) {
            return res.status(400).json({ error: 'Invalid default_tab value' });
        }

        const email = await getEmailFromToken(accessToken);
        await saveUsersAtomic(users => {
            const existing = users[email] || {};
            users[email] = { ...(typeof existing === 'object' ? existing : {}), enabled_tabs, default_tab: default_tab || null };
            return users;
        });

        console.log(`Preferences saved for ${email}`);
        res.json({ success: true, enabled_tabs, default_tab: default_tab || null });
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

        const email = await getEmailFromToken(accessToken);
        const apiKeys = loadApiKeys();

        // Find existing key for this user
        const existingKey = Object.entries(apiKeys).find(([, v]) => v.email === email);
        if (existingKey) {
            // Show masked key + metadata
            const [key, meta] = existingKey;
            const masked = key.slice(0, 7) + '...' + key.slice(-4);
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

        const email = await getEmailFromToken(accessToken);
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
            // Add new key
            const entry = { email, spreadsheetId, createdAt: new Date().toISOString() };
            if (encryptedRefreshToken) entry.refreshToken = encryptedRefreshToken;
            apiKeys[newKey] = entry;
            return apiKeys;
        });

        console.log(`API key generated for ${email}`);
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

        const email = await getEmailFromToken(accessToken);

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

        console.log(`API key revoked for ${email}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Revoke API key error:', error);
        res.status(500).json({ error: 'Failed to revoke API key' });
    }
});

// ─── Static files ─────────────────────────────────────────────────────────────

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
        const apiKeys = loadApiKeys();
        if (apiKeys[apiToken]) {
            req.apiKeyUser = apiKeys[apiToken]; // { email, spreadsheetId, createdAt }
            return next();
        }

        return res.status(401).json({ error: 'Unauthorized: Invalid API key.' });
    }

    // 2. OAuth Bearer token — use user's own Google credentials
    if (bearer) {
        try {
            const email = await getEmailFromToken(bearer);
            req.oauthUser = { email, accessToken: bearer };
            return next();
        } catch (err) {
            return res.status(401).json({ error: 'Unauthorized: Invalid Bearer token.' });
        }
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
    const clientSecret = process.env.VITE_GOOGLE_CLIENT_SECRET;
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
                else if (range.startsWith('Counters')) result.counters = filterData(rowsToObjects(rangeData.values), oldest, newest);
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

        const counterIndexMap = { smoke: 1, smoked: 2, coffee: 3 };

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:D`,
        });

        const rows = response.data.values || [];
        const startIdx = (rows.length > 0 && rows[0][0] === 'Date') ? 1 : 0;

        // If no date params, return today only (backwards-compatible for Zepp)
        if (!oldest && !newest) {
            const result = { smoke: 0, smoked: 0, coffee: 0 };
            for (let i = startIdx; i < rows.length; i++) {
                if (rows[i][0] === todayStr) {
                    result.smoke = parseInt(rows[i][counterIndexMap.smoke] || '0', 10);
                    result.smoked = parseInt(rows[i][counterIndexMap.smoked] || '0', 10);
                    result.coffee = parseInt(rows[i][counterIndexMap.coffee] || '0', 10);
                    break;
                }
            }
            return res.json({ success: true, date: todayStr, counters: result });
        }

        // With date params, return array of daily entries
        const entries = [];
        for (let i = startIdx; i < rows.length; i++) {
            const rowDate = rows[i][0];
            if (!rowDate) continue;
            if (oldest && rowDate < oldest) continue;
            if (newest && rowDate > newest) continue;
            entries.push({
                date: rowDate,
                smoke: parseInt(rows[i][counterIndexMap.smoke] || '0', 10),
                smoked: parseInt(rows[i][counterIndexMap.smoked] || '0', 10),
                coffee: parseInt(rows[i][counterIndexMap.coffee] || '0', 10),
            });
        }

        res.json({ success: true, entries });
    } catch (error) {
        console.error('Counter GET Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─── Counter increment endpoint ───────────────────────────────────────────────

app.post('/api/counter/increment', authenticate, async (req, res) => {
    try {
        const { counter } = req.body;
        const validCounters = ['smoke', 'smoked', 'coffee'];

        if (!counter || !validCounters.includes(counter)) {
            return res.status(400).json({ error: `Invalid counter. Must be one of: ${validCounters.join(', ')}` });
        }

        const spreadsheetId = await resolveSpreadsheetId(req);
        const sheets = await getSheetsClientForRequest(req);
        const sheetName = 'Counters';
        const dateStr = new Date().toISOString().split('T')[0];

        const counterColMap = { smoke: 'B', smoked: 'C', coffee: 'D' };
        const counterIndexMap = { smoke: 1, smoked: 2, coffee: 3 };

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:D`,
        });

        const rows = response.data.values || [];
        let rowNumber = -1;
        let currentVal = 0;
        const startIdx = (rows.length > 0 && rows[0][0] === 'Date') ? 1 : 0;

        for (let i = startIdx; i < rows.length; i++) {
            if (rows[i][0] === dateStr) {
                rowNumber = i + 1;
                currentVal = parseInt(rows[i][counterIndexMap[counter]] || '0', 10);
                break;
            }
        }

        let newValue;
        if (rowNumber !== -1) {
            newValue = currentVal + 1;
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!${counterColMap[counter]}${rowNumber}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[newValue]] },
            });
        } else {
            const newRow = [dateStr, 0, 0, 0];
            newRow[counterIndexMap[counter]] = 1;
            newValue = 1;
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
        await getEmailFromToken(accessToken);

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
        await getEmailFromToken(accessToken);

        const { apiKey, system, messages, max_tokens } = req.body;
        if (!apiKey || !messages) {
            return res.status(400).json({ error: 'Missing apiKey or messages' });
        }

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

// ─── SPA fallback ─────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
