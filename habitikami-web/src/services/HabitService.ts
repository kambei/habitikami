import { gapi } from 'gapi-script';
// We use gapi-script for loading, but types come from @types/gapi
// and we need to initialize the client.
import { hexToSheetColor, sheetColorToHex } from '../utils/colors';
import { findHeaderRowIndex } from '../utils/parser';
import type { HabitMeta, HabitNote, MoodEntry, PushPrefs, PushSettings, TemptationConfig, CounterData, SheetRow } from '../types';
import { ACHIEVEMENTS_SHEET, ACHIEVEMENTS_COLUMNS, ACHIEVEMENTS_RANGE, rowsToUnlocked } from '../utils/achievements';
import { HABIT_NOTES_COLUMNS, HABIT_NOTES_RANGE, HABIT_NOTES_SHEET, noteKey, rowsToHabitNotes } from '../utils/habitNotes';
import { MOOD_COLUMNS, MOOD_RANGE, MOOD_SHEET, moodEntryToRow, rowsToMoodEntries } from '../utils/mood';
import { HABIT_META_COLUMNS, HABIT_META_RANGE, mergeHabitMeta, rowToHabitMeta, habitMetaToRow } from '../utils/habitMeta';
import { errorMessage, errorStatus } from '../utils/errors';

// CLIENT_SECRET must never be referenced here; token exchange is backend-only
const CLIENT_ID = window.config?.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID;

const DISCOVERY_DOCS = [
    "https://sheets.googleapis.com/$discovery/rest?version=v4",
    "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"
];
const SCOPES = "https://www.googleapis.com/auth/drive.file openid email";

/** Shapes of the Sheets API objects this service inspects (the client is untyped). */
type SheetMeta = { properties?: { title?: string; sheetId?: number } };
type CellDataLike = { userEnteredValue?: { stringValue?: string }; formattedValue?: string; userEnteredFormat?: { backgroundColor?: import('../utils/colors').Color } };

const SESSION_KEY = 'habitikami_session_v3';

interface SessionData {
    access_token: string;
    refresh_token?: string;
    expiry_date: number;
    email: string;
    spreadsheet_id: string;
}

class HabitServiceImpl {
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private tokenExpiry: number = 0;
    private authError: string | null = null;
    private codeVerifier: string | null = null;
    private email: string | null = null;
    private spreadsheetId: string | null = null;
    private redirectPromise: Promise<void> | null = null;

    constructor() {
        this.loadGapi();
    }

    isAuthenticated(): boolean {
        return !!this.accessToken && Date.now() < this.tokenExpiry;
    }

    getAccessToken(): string | null {
        return this.accessToken;
    }

    getEmail(): string | null {
        return this.email;
    }

    getAuthError(): string | null {
        return this.authError;
    }

    /** Returns spreadsheetId regardless of whether email is also set. */
    getStoredSpreadsheetId(): string | null {
        return this.spreadsheetId;
    }

    getUserProfile(): { email: string; spreadsheetId: string } | null {
        if (this.email && this.spreadsheetId) {
            return { email: this.email, spreadsheetId: this.spreadsheetId };
        }
        return null;
    }

    /** Called by OnboardingPage after user registers their spreadsheet. */
    setSpreadsheetId(id: string) {
        this.spreadsheetId = id;
        // Persist to session storage
        try {
            const stored = localStorage.getItem(SESSION_KEY);
            if (stored) {
                const session: SessionData = JSON.parse(stored);
                session.spreadsheet_id = id;
                localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            }
        } catch { /* ignore */ }
    }

    private initError: string | null = null;

    private async generatePKCE() {
        const array = new Uint32Array(56);
        window.crypto.getRandomValues(array);
        const verifier = Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
        this.codeVerifier = verifier;
        sessionStorage.setItem('habitikami_code_verifier', verifier);

        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const hash = await window.crypto.subtle.digest('SHA-256', data);
        
        // Base64Url encode
        const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        
        return base64;
    }

    private loadGapi() {
        const script = document.createElement('script');
        script.src = "https://apis.google.com/js/api.js";
        script.onload = () => {
            gapi.load('client', async () => {
                try {
                    console.log("Initializing GAPI client...");
                    await gapi.client.init({ discoveryDocs: DISCOVERY_DOCS });
                    console.log("GAPI client initialized.");
                } catch (e: unknown) {
                    console.error("GAPI init error:", e);
                    this.initError = (errorMessage(e) || JSON.stringify(e));
                }
            });
        };
        script.onerror = () => { this.initError = "Failed to load Google API script."; };
        document.body.appendChild(script);

        // Check for Auth code in URL (Redirect Flow)
        this.redirectPromise = this.handleRedirectCallback();
    }

    private async handleRedirectCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const storedState = sessionStorage.getItem('habitikami_oauth_state');

        if (code) {
            // Remove code from URL for cleaner UX
            window.history.replaceState({}, document.title, window.location.pathname);

            if (state && state !== storedState) {
                console.error("OAuth state mismatch");
                this.authError = "Security error: State mismatch";
                return;
            }

            console.log("Authorization code found in URL, exchanging...");
            await this.exchangeCodeForTokens(code);
        }
    }

    async auth(): Promise<{ success?: boolean, error?: string }> {
        if (!CLIENT_ID) return { error: "Missing CLIENT_ID environment variable" };

        const challenge = await this.generatePKCE();
        const state = crypto.randomUUID();
        sessionStorage.setItem('habitikami_oauth_state', state);

        const redirectUri = window.location.origin + window.location.pathname;
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${CLIENT_ID}&` +
            `response_type=code&` +
            `scope=${encodeURIComponent(SCOPES)}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `state=${state}&` +
            `code_challenge=${challenge}&` +
            `code_challenge_method=S256&` +
            `access_type=offline&` +
            `prompt=consent&` +
            `include_granted_scopes=true`;

        window.location.href = authUrl;

        // Return a promise that will never resolve here because the page redirects
        return new Promise(() => {});
    }

    private async exchangeCodeForTokens(code: string) {
        try {
            const redirectUri = window.location.origin + window.location.pathname;
            const verifier = this.codeVerifier || sessionStorage.getItem('habitikami_code_verifier');
            const response = await fetch('/api/auth/exchange', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, code_verifier: verifier, redirect_uri: redirectUri }),
            });

            const data = await response.json();
            if (data.code === 'access_restricted') {
                // Private mode: the account is not in the server allowlist
                this.authError = 'access_restricted';
                return;
            }
            if (!response.ok || data.error) throw new Error(data.error || 'Token exchange failed');

            this.saveSession(data);
        } catch (e) {
            console.error('Error exchanging code:', e);
            this.authError = e instanceof Error ? errorMessage(e) : 'Authentication failed';
        }
    }

    private async refreshAccessToken(): Promise<boolean> {
        if (!this.refreshToken) return false;

        try {
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: this.refreshToken, email: this.email }),
            });

            const data = await response.json();
            if (!response.ok || data.error) {
                console.error("Refresh error:", data);
                if (data.code === 'invalid_grant' || data.code === 'access_restricted') {
                    this.clearSession();
                }
                if (data.code === 'access_restricted') {
                    this.authError = 'access_restricted';
                }
                return false;
            }

            this.saveSession({
                ...data,
                refresh_token: data.refresh_token || this.refreshToken,
            });
            return true;

        } catch (e) {
            console.error("Error refreshing token:", e);
            return false;
        }
    }

    private saveSession(data: { access_token: string; refresh_token?: string; email?: string; spreadsheet_id?: string | null; expires_in?: number }) {
        this.accessToken = data.access_token;
        if (data.refresh_token) this.refreshToken = data.refresh_token;
        if (data.email) this.email = data.email;
        if (data.spreadsheet_id) this.spreadsheetId = data.spreadsheet_id;

        const expires_in = data.expires_in || 3599;
        this.tokenExpiry = Date.now() + (expires_in * 1000);

        if (gapi.client) gapi.client.setToken({ access_token: this.accessToken });

        const session: SessionData = {
            access_token: this.accessToken!,
            refresh_token: this.refreshToken || undefined,
            expiry_date: this.tokenExpiry,
            email: this.email || '',
            spreadsheet_id: this.spreadsheetId || '',
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }

    clearSession() {
        // Best-effort: ask the server to revoke the refresh token at Google
        // before forgetting it. Fire-and-forget; keepalive lets the request
        // complete even if the page unloads right after logout.
        if (this.refreshToken) {
            try {
                fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: this.refreshToken }),
                    keepalive: true,
                }).catch(() => { /* ignore */ });
            } catch { /* ignore */ }
        }
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = 0;
        this.email = null;
        this.spreadsheetId = null;
        localStorage.removeItem(SESSION_KEY);
        // Clean up legacy keys
        localStorage.removeItem('habitikami_token_v2');
        localStorage.removeItem('habitikami_token');
    }

    async tryRestoreSession(): Promise<boolean> {
        if (this.redirectPromise) await this.redirectPromise;

        return new Promise((resolve) => {
            const checkGapi = async () => {
                let attempts = 0;
                while (!gapi.client && attempts < 20) {
                    await new Promise(r => setTimeout(r, 100));
                    attempts++;
                }
                if (!gapi.client) { resolve(false); return; }

                try {
                    const stored = localStorage.getItem(SESSION_KEY);
                    if (stored) {
                        const session: SessionData = JSON.parse(stored);
                        this.accessToken = session.access_token;
                        this.refreshToken = session.refresh_token || null;
                        this.tokenExpiry = session.expiry_date;
                        this.email = session.email || null;
                        this.spreadsheetId = session.spreadsheet_id || null;

                        if (Date.now() >= this.tokenExpiry - 60000) {
                            const refreshed = await this.refreshAccessToken();
                            resolve(refreshed);
                        } else {
                            gapi.client.setToken({ access_token: this.accessToken });
                            // If spreadsheetId missing (stale session), try fetching from server
                            if (!this.spreadsheetId && this.accessToken) {
                                try {
                                    const r = await fetch('/api/auth/refresh', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ refresh_token: this.refreshToken, email: this.email }),
                                    });
                                    const d = await r.json();
                                    if (d.spreadsheet_id) {
                                        this.spreadsheetId = d.spreadsheet_id;
                                        this.saveSession({ ...d, refresh_token: d.refresh_token || this.refreshToken });
                                    }
                                } catch { /* non-fatal */ }
                            }
                            resolve(true);
                        }
                    } else {
                        resolve(false);
                    }
                } catch (e) {
                    console.error('Error restoring session', e);
                    resolve(false);
                }
            };
            checkGapi();
        });
    }

    private getSpreadsheetId(): string {
        if (!this.spreadsheetId) throw new Error("No spreadsheet configured. Please complete onboarding.");
        return this.spreadsheetId;
    }

    private async ensureClient() {
        if (this.initError) throw new Error("GAPI failed to initialize: " + this.initError);

        // Check expiry and refresh if needed
        if (this.refreshToken && Date.now() >= this.tokenExpiry - 60000) {
            console.log("Token expiring soon, refreshing...");
            await this.refreshAccessToken();
        }

        if (this.accessToken && gapi.client && gapi.client.sheets && gapi.client.drive) return;

        let retries = 0;
        while ((!gapi.client || !gapi.client.sheets || !gapi.client.drive) && retries < 50) {
            if (this.initError) throw new Error("GAPI failed to initialize: " + this.initError);
            await new Promise(r => setTimeout(r, 100));
            retries++;
        }
        if (!gapi.client || !gapi.client.sheets || !gapi.client.drive) throw new Error("Google APIs not initialized");
    }

    async createInitialTemplate(): Promise<{ spreadsheetId?: string; error?: string }> {
        try {
            await this.ensureClient();
            
            // 1. Create a new blank spreadsheet
            const createRes = await gapi.client.drive.files.create({
                resource: {
                    name: "Habitikami Tracker",
                    mimeType: "application/vnd.google-apps.spreadsheet"
                }
            });
            
            const spreadsheetId = createRes.result.id;
            if (!spreadsheetId) throw new Error("Failed to create spreadsheet");
            
            const initialSheetsListRes = await gapi.client.sheets.spreadsheets.get({ spreadsheetId });
            const defaultSheetId = initialSheetsListRes.result.sheets?.[0]?.properties?.sheetId || 0;

            // 2. Setup the required sheets and headers
            const today = new Date();
            // DD/MM/YYYY
            const pad = (n: number) => n < 10 ? '0' + n : n;
            const _dateStr = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
            const _dayStr = "Lun"; // Just a placeholder day

            const requests: Array<Record<string, unknown>> = [
                // Weekdays Sheet
                { addSheet: { properties: { title: "Weekdays", gridProperties: { frozenRowCount: 1 } } } },
                // Weekend Sheet
                { addSheet: { properties: { title: "Weekend", gridProperties: { frozenRowCount: 1 } } } },
                // Focus Sheet
                { addSheet: { properties: { title: "Focus", gridProperties: { frozenRowCount: 1 } } } },
                // Counters Sheet
                { addSheet: { properties: { title: "Counters", gridProperties: { frozenRowCount: 1 } } } },
                // MobNotes Sheet
                { addSheet: { properties: { title: "MobNotes", gridProperties: { frozenRowCount: 1 } } } },
                // Delete the default initial "Sheet1"
                { deleteSheet: { sheetId: defaultSheetId } }
            ];

            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: { requests }
            });

            // 3. Populate headers 
            const headerUpdates = [
                {
                    range: "Weekdays!A1:D1",
                    values: [["Giorno", "Data", "Esempio Abitudine", ""]]
                },
                {
                    range: "Weekdays!A2:D2",
                    values: [[_dayStr, _dateStr, "FALSE", ""]]
                },
                {
                    range: "Weekend!A1:D1",
                    values: [["Giorno", "Data", "Esempio Weekend", ""]]
                },
                {
                    range: "Focus!A1:D1",
                    values: [["Giorno", "Data", "Obiettivo Principale", ""]]
                },
                {
                    range: "Counters!A1:D1",
                    values: [["Date", "smoke", "smoked", "coffee"]]
                },
                {
                    range: "MobNotes!A1:C1",
                    values: [["Date", "Content", "Links"]]
                }
            ];

            await gapi.client.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                resource: {
                    valueInputOption: "USER_ENTERED",
                    data: headerUpdates
                }
            });

            // Set background colors for the example habits so they look nice
            const sheetsListRes = await gapi.client.sheets.spreadsheets.get({ spreadsheetId });
            const sheets = sheetsListRes.result.sheets || [];
            
            const formatRequests: Array<Record<string, unknown>> = [];
            
            const weekdaysSheet = sheets.find((s: SheetMeta) => s.properties?.title === 'Weekdays');
            if (weekdaysSheet) {
                formatRequests.push({
                    repeatCell: {
                        range: { sheetId: weekdaysSheet.properties?.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 2, endColumnIndex: 3 },
                        cell: { userEnteredFormat: { backgroundColor: hexToSheetColor('#8b5cf6') } },
                        fields: "userEnteredFormat.backgroundColor"
                    }
                });
            }
            
            const weekendSheet = sheets.find((s: SheetMeta) => s.properties?.title === 'Weekend');
            if (weekendSheet) {
                formatRequests.push({
                    repeatCell: {
                        range: { sheetId: weekendSheet.properties?.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 2, endColumnIndex: 3 },
                        cell: { userEnteredFormat: { backgroundColor: hexToSheetColor('#10b981') } },
                        fields: "userEnteredFormat.backgroundColor"
                    }
                });
            }
            
            if (formatRequests.length > 0) {
                 await gapi.client.sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    resource: { requests: formatRequests }
                });
            }
            
            return { spreadsheetId };

        } catch (e: unknown) {
            console.error("Error creating template", e);
            return { error: errorMessage(e) || "Failed to create tracker" };
        }
    }

    async getData(sheetName: string) {
        try {
            await this.ensureClient();
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.getSpreadsheetId(),
                range: sheetName,
            });
            return response.result.values;
        } catch (e: unknown) {
            console.error("Error fetching data", e);
            if (errorStatus(e) === 401 || errorStatus(e) === 403) {
                // If we get 401, maybe token was revoked or generic error.
                // Try one refresh if we haven't just cleared it?
                if (this.refreshToken) {
                    console.log("Got 401, trying one force refresh...");
                    const refreshed = await this.refreshAccessToken();
                    if (refreshed) {
                        // Retry the call? Recursion risk if not careful.
                        // For now, rely on ensureClient having done its job, or user reload.
                        return { error: "Session refreshed, please try again." };
                    }
                }
                return { error: "Unauthorized. Please sign in again." };
            }
            return { error: errorMessage(e) };
        }
    }

    async getDataSubset(sheetName: string, year: number, month: number): Promise<
        { values: SheetRow[], dataStartRow: number, headerRowIndex: number } | { error: string }
    > { // month is 0-indexed (0=Jan)
        return this.fetchRowsWhere(sheetName, d => d.y === year && d.m === month);
    }

    /**
     * Rows whose date falls within [from, to] (inclusive, local calendar days),
     * in one request for the whole span. Used for streaks, analytics and
     * exports that need more than one month.
     */
    async getRangeData(sheetName: string, from: Date, to: Date): Promise<
        { values: SheetRow[], dataStartRow: number, headerRowIndex: number } | { error: string }
    > {
        const fromKey = from.getFullYear() * 10000 + from.getMonth() * 100 + from.getDate();
        const toKey = to.getFullYear() * 10000 + to.getMonth() * 100 + to.getDate();
        return this.fetchRowsWhere(sheetName, d => {
            const key = d.y * 10000 + d.m * 100 + d.d;
            return key >= fromKey && key <= toKey;
        });
    }

    /**
     * Shared reader: finds the header row, scans the date column and fetches
     * the contiguous block of rows whose date satisfies `matches`.
     * Returns `[headerRow, ...rows]` plus `dataStartRow`, the 1-based sheet row
     * of the first returned data row (the append position when nothing matched).
     */
    private async fetchRowsWhere(
        sheetName: string,
        matches: (d: { y: number, m: number, d: number }) => boolean,
    ): Promise<{ values: SheetRow[], dataStartRow: number, headerRowIndex: number } | { error: string }> {
        try {
            await this.ensureClient();

            // 1. Fetch Header + Determine Header Row Index & Date Column
            // Fetch first 20 rows to be safe
            const headerRes = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.getSpreadsheetId(),
                range: `${sheetName}!A1:Z20`,
            });
            const headerValues = headerRes.result.values;
            if (!headerValues) return { error: "No data found" };

            const headerRowIndex = findHeaderRowIndex(headerValues);

            const headerRow = headerValues[headerRowIndex];
            // Find Date Column Index (in the sheet, A=0)
            // Heuristic: look for 'Data' or 'Date' or just assume index 1 if not found
            let dateColIndex = headerRow.findIndex((c: unknown) => typeof c === 'string' && /data|date/i.test(c));
            if (dateColIndex === -1) dateColIndex = 1; // Default to column B (index 1)

            const dateColLetter = this.getColumnLetter(dateColIndex);

            // 2. Fetch All Dates (Column only) to find boundaries
            // Data starts at headerRowIndex + 2 (1-based): header is at headerRowIndex + 1
            const dataStartRow = headerRowIndex + 1 + 1;
            const dateRange = `${sheetName}!${dateColLetter}${dataStartRow}:${dateColLetter}`;

            const datesRes = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.getSpreadsheetId(),
                range: dateRange,
            });

            const dateValues = datesRes.result.values; // Array of [dateStr]
            if (!dateValues) {
                // No data rows? Just return header
                return {
                    values: [headerRow],
                    dataStartRow: dataStartRow - 1,
                    headerRowIndex: headerRowIndex
                };
            }

            // 3. Find the first and last matching row ("DD/MM/YYYY")
            const parseDate = (d: string) => {
                if (!d) return null;
                const parts = d.split(/[-/]/);
                if (parts.length < 3) return null;
                // parts[2] = year, parts[1] = month (1-based), parts[0] = day
                return {
                    y: parseInt(parts[2]),
                    m: parseInt(parts[1]) - 1,
                    d: parseInt(parts[0])
                };
            };

            let startRowOffset = -1;
            let endRowOffset = -1;

            // dateValues[i] corresponds to sheet row (dataStartRow + i), 1-based
            for (let i = 0; i < dateValues.length; i++) {
                const d = parseDate(dateValues[i][0]);
                if (!d) continue;

                if (matches(d)) {
                    if (startRowOffset === -1) startRowOffset = i;
                    endRowOffset = i;
                }
            }

            // Nothing matched: header only, dataStartRow is where a new row would go
            if (startRowOffset === -1) {
                return {
                    values: [headerRow],
                    dataStartRow: dataStartRow + (dateValues.length),
                    headerRowIndex: headerRowIndex
                };
            }

            // 4. Fetch the matching block (rows are date-ordered, so it is contiguous)
            const fetchStart = dataStartRow + startRowOffset;
            const fetchEnd = dataStartRow + endRowOffset;

            const dataRange = `${sheetName}!A${fetchStart}:ZZ${fetchEnd}`;
            const subsetRes = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.getSpreadsheetId(),
                range: dataRange
            });

            const subsetValues = subsetRes.result.values || [];

            return {
                values: [headerRow, ...subsetValues],
                dataStartRow: fetchStart, // 1-based index of the first data row in this result
                headerRowIndex: headerRowIndex
            };

        } catch (e: unknown) {
            console.error("Error fetching subset", e);
            return { error: errorMessage(e) };
        }
    }

    private getColumnLetter(colIndex: number): string {
        let temp, letter = '';
        while (colIndex >= 0) {
            temp = (colIndex) % 26;
            letter = String.fromCharCode(temp + 65) + letter;
            colIndex = (colIndex - temp - 1) / 26;
        }
        return letter;
    }

    /** Raw value of one cell (used by the offline replay to detect conflicts). */
    async getCellValue(sheetName: string, rowIndex: number, colIndex: number): Promise<{ value: string } | { error: string }> {
        try {
            await this.ensureClient();
            const range = `${sheetName}!${this.getColumnLetter(colIndex)}${rowIndex}`;
            const res = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: this.getSpreadsheetId(), range });
            return { value: String(res.result.values?.[0]?.[0] ?? '') };
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    async updateCell(sheetName: string, rowIndex: number, colIndex: number, value: boolean | 'SKIP' | 'HALF' | number) {
        try {
            await this.ensureClient();
            const colLetter = this.getColumnLetter(colIndex);
            const range = `${sheetName}!${colLetter}${rowIndex}`;

            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.getSpreadsheetId(),
                range: range,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[value]]
                }
            });
            return { success: true };
        } catch (e: unknown) {
            if (errorStatus(e) === 401) await this.refreshAccessToken(); // Naive retry hook
            return { error: errorMessage(e) };
        }
    }

    async addHabit(sheetName: string, habitName: string) {
        try {
            await this.ensureClient();
            // 1. Get current data to find header row
            const values = await this.getData(sheetName);
            if (!Array.isArray(values)) throw new Error("Could not fetch sheet data");

            const headerRowIndex = findHeaderRowIndex(values);

            const headerRow = values[headerRowIndex];
            const nextColIndex = headerRow.length;
            const colLetter = this.getColumnLetter(nextColIndex);

            // Header is at headerRowIndex (0-based). Sheets API uses 1-based for A1 notation?
            // "A1" is row 1. So headerRowIndex + 1.
            const range = `${sheetName}!${colLetter}${headerRowIndex + 1}`;

            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.getSpreadsheetId(),
                range: range,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[habitName]]
                }
            });
            return { success: true };

        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    async addDay(sheetName: string) {
        try {
            await this.ensureClient();
            const spreadsheetId = this.getSpreadsheetId();

            // 1. Fetch only the header area to find the date column
            const headerRes = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A1:Z10`,
            });
            const headerValues = headerRes.result.values;
            if (!headerValues) throw new Error("No data found");

            const headerRowIndex = findHeaderRowIndex(headerValues);
            const headerRow = headerValues[headerRowIndex];
            let dateColIndex = headerRow.findIndex((c: unknown) => typeof c === 'string' && /data|date/i.test(c));
            if (dateColIndex === -1) dateColIndex = 1;
            const dateColLetter = this.getColumnLetter(dateColIndex);

            // 2. Fetch only the date column (lightweight even with thousands of rows)
            const dataStartRow = headerRowIndex + 2; // 1-based, first data row
            const dateRange = `${sheetName}!${dateColLetter}${dataStartRow}:${dateColLetter}`;
            const datesRes = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: dateRange,
            });
            const dateValues = datesRes.result.values; // [[date], [date], ...]

            // 3. Find the last date and the next empty row
            let nextDate: Date;
            const totalDataRows = dateValues?.length ?? 0;
            const nextRowIndex = dataStartRow + totalDataRows; // 1-based, append after last

            if (dateValues && dateValues.length > 0) {
                // Walk backwards to find last non-empty date
                let lastDateStr: string | null = null;
                for (let i = dateValues.length - 1; i >= 0; i--) {
                    const cell = dateValues[i]?.[0];
                    if (cell && typeof cell === 'string' && cell.trim()) {
                        lastDateStr = cell.trim();
                        break;
                    }
                }

                if (lastDateStr) {
                    const parts = lastDateStr.split(/[-/]/);
                    if (parts.length === 3) {
                        const lastDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                        nextDate = new Date(lastDate);
                        nextDate.setDate(lastDate.getDate() + 1);
                    } else {
                        nextDate = new Date();
                    }
                } else {
                    nextDate = new Date();
                }
            } else {
                nextDate = new Date();
            }

            // 4. Skip to next valid day for this sheet type
            const isWeekendDay = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
            if (sheetName === 'Weekdays') {
                while (isWeekendDay(nextDate)) nextDate.setDate(nextDate.getDate() + 1);
            } else if (sheetName === 'Weekend') {
                while (!isWeekendDay(nextDate)) nextDate.setDate(nextDate.getDate() + 1);
            }

            // 5. Format day and date
            const italianDays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
            const dayStr = italianDays[nextDate.getDay()];
            const pad = (n: number) => n < 10 ? '0' + n : '' + n;
            const dateStr = `${pad(nextDate.getDate())}/${pad(nextDate.getMonth() + 1)}/${nextDate.getFullYear()}`;

            // 6. Write to sheet
            const range = `${sheetName}!A${nextRowIndex}:B${nextRowIndex}`;
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[dayStr, dateStr]]
                }
            });
            return { success: true };
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    private async getSheetId(sheetName: string): Promise<number | null> {
        await this.ensureClient();
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: this.getSpreadsheetId(),
            fields: 'sheets(properties(sheetId,title))'
        });
        const sheet = response.result.sheets?.find((s: SheetMeta) => s.properties?.title === sheetName);
        return sheet?.properties?.sheetId || null;
    }

    async moveColumn(sheetName: string, fromIndex: number, toIndex: number) {
        try {
            const sheetId = await this.getSheetId(sheetName);
            if (sheetId === null) throw new Error("Sheet not found");

            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.getSpreadsheetId(),
                resource: {
                    requests: [{
                        moveDimension: {
                            source: {
                                sheetId: sheetId,
                                dimension: 'COLUMNS',
                                startIndex: fromIndex,
                                endIndex: fromIndex + 1
                            },
                            destinationIndex: toIndex
                        }
                    }]
                }
            });
            return { success: true };
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    async deleteColumn(sheetName: string, colIndex: number) {
        try {
            const sheetId = await this.getSheetId(sheetName);
            if (sheetId === null) throw new Error("Sheet not found");

            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.getSpreadsheetId(),
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'COLUMNS',
                                startIndex: colIndex,
                                endIndex: colIndex + 1
                            }
                        }
                    }]
                }
            });
            return { success: true };
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    async deleteCounterColumnsByName(columnNames: string[]) {
        try {
            await this.ensureClient();
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.getSpreadsheetId(),
                range: "Counters!1:1",
            });
            const headers = response.result.values?.[0] || [];
            const indexes: number[] = [];
            for (const name of columnNames) {
                const idx = headers.findIndex((h: unknown) => typeof h === 'string' && h.toLowerCase() === name.toLowerCase());
                if (idx > 0) indexes.push(idx);
            }
            // Sort descending so deleting from right to left doesn't shift earlier indexes
            indexes.sort((a, b) => b - a);
            for (const idx of indexes) {
                await this.deleteColumn("Counters", idx);
            }
            return { success: true, deleted: indexes.length };
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    async getHabitColors(sheetName: string): Promise<Record<string, string> | { error: string }> {
        try {
            await this.ensureClient();
            const response = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: this.getSpreadsheetId(),
                ranges: [`${sheetName}!A1:Z5`], // First 5 rows shd be enough to find header
                includeGridData: true
            });

            const sheetEntry = response.result.sheets?.[0];
            if (!sheetEntry || !sheetEntry.data) return {};

            const rowData = sheetEntry.data[0].rowData;
            if (!rowData) return {};

            const colors: Record<string, string> = {};

            // Find header row in rich cell data (different shape from values array)
            const HEADER_PATTERN = /giorno|date|day/i;
            let headerRowIndex = 1;
            for (let i = 0; i < rowData.length; i++) {
                const row = rowData[i];
                if (row.values?.some((cell: CellDataLike) => {
                    const val = cell.userEnteredValue?.stringValue || cell.formattedValue;
                    return val && HEADER_PATTERN.test(val);
                })) {
                    headerRowIndex = i;
                    break;
                }
            }

            // Now parse colors from this row
            const headerRow = rowData[headerRowIndex];
            if (headerRow && headerRow.values) {
                headerRow.values.forEach((cell: CellDataLike) => {
                    const val = cell.userEnteredValue?.stringValue || cell.formattedValue;
                    if (val) {
                        const bgColor = cell.userEnteredFormat?.backgroundColor;
                        if (bgColor) {
                            colors[val] = sheetColorToHex(bgColor);
                        }
                    }
                });
            }

            return colors;

        } catch (e: unknown) {
            console.error("Error fetching colors", e);
            return { error: errorMessage(e) };
        }
    }

    async renameHabit(sheetName: string, oldName: string, newName: string) {
        try {
            await this.ensureClient();
            const trimmed = newName.trim();
            if (!trimmed) throw new Error("Habit name cannot be empty");
            if (trimmed === oldName) return { success: true };

            const values = await this.getData(sheetName);
            if (!Array.isArray(values)) throw new Error("Could not fetch sheet data");

            const headerRowIndex = findHeaderRowIndex(values);
            const headerRow = values[headerRowIndex];
            const colIndex = headerRow.indexOf(oldName);
            if (colIndex === -1) throw new Error(`Habit "${oldName}" not found in header`);

            // Reject duplicate header name
            if (headerRow.some((h: unknown, i: number) => i !== colIndex && typeof h === 'string' && h === trimmed)) {
                throw new Error(`A habit named "${trimmed}" already exists`);
            }

            const colLetter = this.getColumnLetter(colIndex);
            const range = `${sheetName}!${colLetter}${headerRowIndex + 1}`;
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.getSpreadsheetId(),
                range,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[trimmed]] }
            });

            // Migrate the meta description row, if any
            try {
                const meta = await this.getHabitMeta();
                if (!('error' in meta) && meta[oldName] !== undefined) {
                    await this.setHabitMeta(trimmed, meta[oldName]);
                    await this.deleteHabitMeta(oldName);
                }
            } catch { /* meta migration is best-effort */ }

            return { success: true };
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    private async ensureHabitMetaSheet(): Promise<void> {
        const spreadsheetId = this.getSpreadsheetId();
        const meta = await gapi.client.sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(title))' });
        const exists = meta.result.sheets?.some((s: SheetMeta) => s.properties?.title === 'HabitMeta');

        if (!exists) {
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{ addSheet: { properties: { title: 'HabitMeta', gridProperties: { frozenRowCount: 1 } } } }]
                }
            });
        }

        // Header row: write the full column set (also upgrades the legacy "Habit | Description" header)
        const header = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId, range: 'HabitMeta!A1:G1' });
        const current = header.result.values?.[0] ?? [];
        if (current.length < HABIT_META_COLUMNS.length) {
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId,
                range: 'HabitMeta!A1:G1',
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[...HABIT_META_COLUMNS]] }
            });
        }
    }

    /** All habit metadata, keyed by habit name. A missing sheet reads as {}. */
    async getHabitMeta(): Promise<Record<string, HabitMeta> | { error: string }> {
        try {
            await this.ensureClient();
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.getSpreadsheetId(),
                range: HABIT_META_RANGE,
            });
            const rows = response.result.values || [];
            const out: Record<string, HabitMeta> = {};
            const start = rows[0] && typeof rows[0][0] === 'string' && /habit/i.test(rows[0][0]) ? 1 : 0;
            for (let i = start; i < rows.length; i++) {
                const name = rows[i]?.[0];
                if (name) out[name] = rowToHabitMeta(rows[i]);
            }
            return out;
        } catch (e: unknown) {
            // Sheet missing → empty meta (lazy: don't create yet)
            const msg: string = errorMessage(e) || '';
            if (errorStatus(e) === 400 || /Unable to parse range/i.test(msg)) return {};
            return { error: msg };
        }
    }

    /**
     * Merges `patch` into the habit's metadata and writes the whole row
     * (Habit | Description | Type | Target | Unit | Slot | Time).
     */
    async setHabitMeta(habitName: string, patch: Partial<HabitMeta>): Promise<{ success: boolean } | { error: string }> {
        try {
            await this.ensureClient();
            await this.ensureHabitMetaSheet();
            const spreadsheetId = this.getSpreadsheetId();

            const res = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: HABIT_META_RANGE,
            });
            const rows = res.result.values || [];
            const start = rows[0] && typeof rows[0][0] === 'string' && /habit/i.test(rows[0][0]) ? 1 : 0;

            let rowIndex = -1;
            for (let i = start; i < rows.length; i++) {
                if (rows[i]?.[0] === habitName) { rowIndex = i; break; }
            }

            const existing = rowIndex !== -1 ? rowToHabitMeta(rows[rowIndex]) : undefined;
            const row = habitMetaToRow(habitName, mergeHabitMeta(existing, patch));

            if (rowIndex !== -1) {
                const range = `HabitMeta!A${rowIndex + 1}:G${rowIndex + 1}`;
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [row] }
                });
            } else {
                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId,
                    range: HABIT_META_RANGE,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [row] }
                });
            }
            return { success: true };
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    async deleteHabitMeta(habitName: string): Promise<{ success: boolean } | { error: string }> {
        try {
            await this.ensureClient();
            const spreadsheetId = this.getSpreadsheetId();
            const res = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'HabitMeta!A:B',
            });
            const rows = res.result.values || [];
            const start = rows[0] && typeof rows[0][0] === 'string' && /habit/i.test(rows[0][0]) ? 1 : 0;
            let rowIndex = -1;
            for (let i = start; i < rows.length; i++) {
                if (rows[i]?.[0] === habitName) { rowIndex = i; break; }
            }
            if (rowIndex === -1) return { success: true };

            const sheetId = await this.getSheetId('HabitMeta');
            if (sheetId === null) return { success: true };
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 }
                        }
                    }]
                }
            });
            return { success: true };
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    async setHabitColor(sheetName: string, habitName: string, colorHex: string) {
        try {
            await this.ensureClient();
            const sheetId = await this.getSheetId(sheetName);
            if (sheetId === null) throw new Error("Sheet not found");

            // Need to find coordinate (row/col) of the habit header
            const values = await this.getData(sheetName);
            if (!Array.isArray(values) && 'error' in values) throw new Error(values.error);

            const headerRowIndex = findHeaderRowIndex(values);
            const headerRow = values[headerRowIndex];
            const colIndex = headerRow.indexOf(habitName);

            if (colIndex === -1) throw new Error(`Habit "${habitName}" not found in header`);

            const color = hexToSheetColor(colorHex);

            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.getSpreadsheetId(),
                resource: {
                    requests: [{
                        repeatCell: {
                            range: {
                                sheetId: sheetId,
                                startRowIndex: headerRowIndex,
                                endRowIndex: headerRowIndex + 1,
                                startColumnIndex: colIndex,
                                endColumnIndex: colIndex + 1
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: color
                                }
                            },
                            fields: "userEnteredFormat.backgroundColor"
                        }
                    }]
                }
            });
            return { success: true };

        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }
    async getNotes(): Promise<import('../types').NoteData[] | { error: string }> {
        try {
            await this.ensureClient();
            // Assume "MobNotes" sheet has columns: Date, Content, Links (comma separated)
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.getSpreadsheetId(),
                range: "MobNotes!A:C",
            });
            const rows = response.result.values;
            if (!rows || rows.length === 0) return [];

            // Skip header if present (heuristic)
            const start = (rows[0][0] === "Date") ? 1 : 0;

            return rows.slice(start).map((r: SheetRow) => ({
                date: String(r[0] ?? ""),
                content: String(r[1] ?? ""),
                links: r[2] ? String(r[2]).split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0) : []
            }));
        } catch (e: unknown) {
            console.error("Error fetching notes", e);
            return { error: errorMessage(e) };
        }
    }

    async saveNote(date: string, content: string, links: string[]) {
        try {
            await this.ensureClient();
            // 1. Fetch all notes to find if row exists
            let values = await this.getData("MobNotes");

            if (!Array.isArray(values) && values && 'error' in values) {
                // Try to create the sheet
                console.log("Sheet MobNotes not found, attempting to create...");
                try {
                    await gapi.client.sheets.spreadsheets.batchUpdate({
                        spreadsheetId: this.getSpreadsheetId(),
                        resource: {
                            requests: [{
                                addSheet: {
                                    properties: {
                                        title: "MobNotes",
                                        gridProperties: {
                                            columnCount: 3,
                                            frozenRowCount: 1
                                        }
                                    }
                                }
                            }]
                        }
                    });
                    // Create header
                    await gapi.client.sheets.spreadsheets.values.update({
                        spreadsheetId: this.getSpreadsheetId(),
                        range: "MobNotes!A1:C1",
                        valueInputOption: 'USER_ENTERED',
                        resource: {
                            values: [["Date", "Content", "Links"]]
                        }
                    });

                    // Retry fetch
                    values = await this.getData("MobNotes");
                } catch (createError: unknown) {
                    console.error("Failed to create sheet", createError);
                    throw new Error("Could not create MobNotes sheet: " + (errorMessage(createError)));
                }
            }

            if (!Array.isArray(values) && values && 'error' in values) throw new Error(values.error);

            let rowIndex = -1;
            if (Array.isArray(values)) {
                for (let i = 0; i < values.length; i++) {
                    if (values[i][0] === date) {
                        rowIndex = i;
                        break;
                    }
                }
            }

            const linksStr = links.join(',');

            if (rowIndex !== -1) {
                // Update
                const range = `MobNotes!A${rowIndex + 1}:C${rowIndex + 1}`; // 1-based index
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: this.getSpreadsheetId(),
                    range: range,
                    valueInputOption: 'USER_ENTERED',
                    resource: {
                        values: [[date, content, linksStr]]
                    }
                });
            } else {
                // Append
                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId: this.getSpreadsheetId(),
                    range: "MobNotes",
                    valueInputOption: 'USER_ENTERED',
                    resource: {
                        values: [[date, content, linksStr]]
                    }
                });
            }
            return { success: true };

        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    async incrementCounter(counterName: string) {
        console.log("Incrementing counter:", counterName);
        try {
            await this.ensureClient();
            const sheetName = "Counters";
            const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

            // Fetch current data to find headers and today's row
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.getSpreadsheetId(),
                range: `${sheetName}!A:Z`,
            });

            const rows = response.result.values || [];

            // Initialize sheet if empty
            if (rows.length === 0) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: this.getSpreadsheetId(),
                    range: `${sheetName}!A1:B1`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [["Date", counterName]] }
                });
                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId: this.getSpreadsheetId(),
                    range: sheetName,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[dateStr, 1]] }
                });
                return { success: true };
            }

            const headers = rows[0];
            const dateIdx = headers.findIndex((h: unknown) => typeof h === 'string' && /date/i.test(h));
            let counterIdx = headers.findIndex((h: unknown) => typeof h === 'string' && h.toLowerCase() === counterName.toLowerCase());

            // If counter column doesn't exist, add it
            if (counterIdx === -1) {
                counterIdx = headers.length;
                const colLetter = this.getColumnLetter(counterIdx);
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: this.getSpreadsheetId(),
                    range: `${sheetName}!${colLetter}1`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[counterName]] }
                });
            }

            const todayRowIndex = rows.findIndex((r: SheetRow) => r[dateIdx] === dateStr);
            const colLetter = this.getColumnLetter(counterIdx);

            if (todayRowIndex !== -1) {
                const currentVal = parseInt(rows[todayRowIndex][counterIdx] || "0");
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: this.getSpreadsheetId(),
                    range: `${sheetName}!${colLetter}${todayRowIndex + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[currentVal + 1]] }
                });
            } else {
                const newRow = new Array(headers.length).fill(0);
                newRow[dateIdx] = dateStr;
                newRow[counterIdx] = 1;
                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId: this.getSpreadsheetId(),
                    range: sheetName,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [newRow] }
                });
            }

            return { success: true };

        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    async getPreferences(): Promise<{ enabled_tabs: string[] | null; default_tab: string | null; temptations?: TemptationConfig[] | null } | { error: string }> {
        try {
            const response = await fetch('/api/user/preferences', {
                headers: { Authorization: `Bearer ${this.accessToken}` },
            });
            if (!response.ok) {
                const data = await response.json();
                return { error: data.error || 'Failed to fetch preferences' };
            }
            return await response.json();
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    async savePreferences(enabledTabs: string[], defaultTab?: string, temptations?: TemptationConfig[]): Promise<{ success: boolean } | { error: string }> {
        try {
            const response = await fetch('/api/user/preferences', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.accessToken}`,
                },
                body: JSON.stringify({ 
                    enabled_tabs: enabledTabs, 
                    default_tab: defaultTab || null,
                    temptations: temptations || null
                }),
            });
            if (!response.ok) {
                const data = await response.json();
                return { error: data.error || 'Failed to save preferences' };
            }
            return await response.json();
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    // ─── API Key management ──────────────────────────────────────────────────

    async getApiKeyInfo(): Promise<{ has_key: boolean; masked_key?: string; created_at?: string } | { error: string }> {
        try {
            const response = await fetch('/api/user/apikey', {
                headers: { Authorization: `Bearer ${this.accessToken}` },
            });
            if (!response.ok) {
                const data = await response.json();
                return { error: data.error || 'Failed to get API key info' };
            }
            return await response.json();
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    // ─── Achievements sheet (Id | UnlockedAt) ────────────────────────────────

    private async ensureAchievementsSheet(): Promise<void> {
        const spreadsheetId = this.getSpreadsheetId();
        const meta = await gapi.client.sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(title))' });
        if (meta.result.sheets?.some((s: SheetMeta) => s.properties?.title === ACHIEVEMENTS_SHEET)) return;
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: { requests: [{ addSheet: { properties: { title: ACHIEVEMENTS_SHEET, gridProperties: { frozenRowCount: 1 } } } }] }
        });
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${ACHIEVEMENTS_SHEET}!A1:B1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[...ACHIEVEMENTS_COLUMNS]] }
        });
    }

    /** Unlocked achievements (id → ISO date). A missing sheet reads as {}. */
    async getAchievements(): Promise<{ unlocked: Record<string, string> } | { error: string }> {
        try {
            await this.ensureClient();
            const res = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: this.getSpreadsheetId(), range: ACHIEVEMENTS_RANGE });
            return { unlocked: rowsToUnlocked(res.result.values || []) };
        } catch (e: unknown) {
            const msg: string = errorMessage(e) || '';
            if (errorStatus(e) === 400 || /Unable to parse range/i.test(msg)) return { unlocked: {} };
            return { error: msg };
        }
    }

    /** Appends the given ids with the current time (creating the sheet on first use). */
    async unlockAchievements(ids: string[]): Promise<{ success: boolean } | { error: string }> {
        if (ids.length === 0) return { success: true };
        try {
            await this.ensureClient();
            await this.ensureAchievementsSheet();
            const now = new Date().toISOString();
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: this.getSpreadsheetId(),
                range: ACHIEVEMENTS_RANGE,
                valueInputOption: 'USER_ENTERED',
                resource: { values: ids.map(id => [id, now]) }
            });
            return { success: true };
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    // ─── Web push (server push.js) ───────────────────────────────────────────

    private async pushRequest<T>(path: string, body?: unknown): Promise<T | { error: string }> {
        try {
            const response = await fetch(path, {
                method: body === undefined ? 'GET' : 'POST',
                headers: { Authorization: `Bearer ${this.accessToken}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
                body: body === undefined ? undefined : JSON.stringify(body),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return { error: data.error || `HTTP ${response.status}` };
            return data as T;
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    getPushPublicKey() { return this.pushRequest<{ key: string }>('/api/push/public-key'); }
    getPushSettings() { return this.pushRequest<PushSettings>('/api/push/settings'); }
    /** Registers this browser; the refresh token lets the server read the sheet for reminders. */
    subscribePush(subscription: PushSubscriptionJSON, lang: string) {
        return this.pushRequest<PushSettings>('/api/push/subscribe', {
            subscription, refresh_token: this.refreshToken || undefined, lang,
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
    }
    unsubscribePush(endpoint: string | null) { return this.pushRequest<PushSettings>('/api/push/unsubscribe', { endpoint }); }
    savePushPrefs(prefs: Partial<PushPrefs>) { return this.pushRequest<PushSettings>('/api/push/settings', { prefs }); }
    sendTestPush() { return this.pushRequest<{ sent: number; dropped: number }>('/api/push/test', {}); }

    async getChangelog(): Promise<{ content: string; hash: string }> {
        const response = await fetch(`/api/changelog?t=${Date.now()}`);
        if (!response.ok) {
            throw new Error('Failed to fetch changelog');
        }
        return response.json();
    }

    async generateApiKey(): Promise<{ success: boolean; api_key: string } | { error: string }> {
        try {
            const response = await fetch('/api/user/apikey', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.accessToken}`,
                },
                body: JSON.stringify({ spreadsheet_id: this.spreadsheetId, refresh_token: this.refreshToken }),
            });
            if (!response.ok) {
                const data = await response.json();
                return { error: data.error || 'Failed to generate API key' };
            }
            return await response.json();
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    async revokeApiKey(): Promise<{ success: boolean } | { error: string }> {
        try {
            const response = await fetch('/api/user/apikey', {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                },
            });
            if (!response.ok) {
                const data = await response.json();
                return { error: data.error || 'Failed to revoke API key' };
            }
            return await response.json();
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    async getCounters(): Promise<CounterData[] | { error: string }> {
        try {
            await this.ensureClient();
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.getSpreadsheetId(),
                range: "Counters!A:Z",
            });
            const rows = response.result.values;
            if (!rows || rows.length === 0) return [];

            const headers = rows[0];
            const dateIdx = headers.findIndex((h: unknown) => typeof h === 'string' && /date/i.test(h));
            
            const colMap: Record<string, number> = {};
            headers.forEach((h: unknown, i: number) => {
                if (i !== dateIdx && typeof h === 'string' && h) colMap[h.toLowerCase()] = i;
            });

            const data = rows.slice(1).map((row: SheetRow) => {
                const entry: CounterData = { date: String(row[dateIdx] ?? "") };
                Object.keys(colMap).forEach(key => {
                    entry[key] = parseInt(String(row[colMap[key]] ?? "0")) || 0;
                });
                return entry;
            });

            return data.reverse();

        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    /**
     * Find or create the "habitikami-worksheets" folder on Google Drive.
     * Returns the folder ID.
     */
    private async findOrCreateWorksheetFolder(): Promise<string> {
        const folderName = 'habitikami-worksheets';

        // Search for existing folder
        const searchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
                `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
            )}&fields=files(id)&spaces=drive`,
            {
                headers: { 'Authorization': `Bearer ${this.accessToken}` },
            }
        );

        if (searchRes.ok) {
            const data = await searchRes.json();
            if (data.files?.length > 0) {
                return data.files[0].id;
            }
        }

        // Create the folder
        const createRes = await fetch(
            'https://www.googleapis.com/drive/v3/files',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                }),
            }
        );

        if (!createRes.ok) {
            throw new Error('Failed to create worksheets folder');
        }

        const folder = await createRes.json();
        return folder.id;
    }

    private async findOrCreateArchiveFolder(): Promise<string> {
        await this.ensureClient();
        const mainFolderId = await this.findOrCreateWorksheetFolder();
        const searchQuery = `name = 'habitikami-archive' and '${mainFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const res = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id)&spaces=drive`,
            {
                headers: { 'Authorization': `Bearer ${this.accessToken}` },
            }
        );

        if (res.ok) {
            const data = await res.json();
            if (data.files && data.files.length > 0) return data.files[0].id;
        }

        // Create it
        const createRes = await fetch(
            'https://www.googleapis.com/drive/v3/files',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: 'habitikami-archive',
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [mainFolderId],
                }),
            }
        );

        const folder = await createRes.json();
        return folder.id;
    }

    /**
     * Count how many documents with a given title prefix exist in a folder today,
     * to generate sequential naming (e.g. "Title - 2026-03-20 (2)").
     */
    private async countTodayDocuments(folderId: string, titlePrefix: string, dateStr: string): Promise<number> {
        const searchQuery = `'${folderId}' in parents and name contains '${titlePrefix} - ${dateStr}' and trashed=false`;
        const res = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id)&spaces=drive`,
            {
                headers: { 'Authorization': `Bearer ${this.accessToken}` },
            }
        );

        if (!res.ok) return 0;
        const data = await res.json();
        return data.files?.length || 0;
    }

    async createDriveDocument(title: string, htmlContent: string): Promise<{ fileId?: string; fileUrl?: string; error?: string }> {
        try {
            await this.ensureClient();

            // Find or create the worksheets folder
            const folderId = await this.findOrCreateWorksheetFolder();

            // Check for duplicates today and adjust title
            const now = new Date();
            const pad = (n: number) => n < 10 ? '0' + n : String(n);
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            // title is already "SchedaTitle - YYYY-MM-DD", extract the base
            const baseName = title.replace(` - ${dateStr}`, '');
            const existing = await this.countTodayDocuments(folderId, baseName, dateStr);
            const finalTitle = existing > 0 ? `${baseName} - ${dateStr} (${existing + 1})` : title;

            const boundary = 'habitikami_doc_boundary';
            const metadata = {
                name: finalTitle,
                mimeType: 'application/vnd.google-apps.document',
                parents: [folderId],
            };

            const body =
                `--${boundary}\r\n` +
                `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
                `${JSON.stringify(metadata)}\r\n` +
                `--${boundary}\r\n` +
                `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
                `${htmlContent}\r\n` +
                `--${boundary}--`;

            const response = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': `multipart/related; boundary=${boundary}`,
                    },
                    body,
                }
            );

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || 'Failed to create document');
            }

            const result = await response.json();
            console.log(`[HabitService] Document saved successfully. ID: ${result.id}`);
            return { fileId: result.id, fileUrl: result.webViewLink };
        } catch (e: unknown) {
            return { error: errorMessage(e) || 'Failed to create Drive document' };
        }
    }

    async getRecentWorksheets(limit: number = 5): Promise<{ id: string; title: string; content: string }[] | { error: string }> {
        try {
            await this.ensureClient();
            const folderId = await this.findOrCreateWorksheetFolder();

            const listRes = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
                    `'${folderId}' in parents and trashed=false`
                )}&orderBy=createdTime desc&pageSize=${limit}&fields=files(id,name,mimeType)&spaces=drive`,
                { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
            );

            if (!listRes.ok) throw new Error('Failed to list worksheets');
            const listData = await listRes.json();
            const files = listData.files || [];

            const results = [];
            for (const file of files) {
                let url = '';
                if (file.mimeType === 'application/vnd.google-apps.document') {
                    // Export Google Doc as plain text
                    url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`;
                } else {
                    // Regular file download (e.g. text/html)
                    url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
                }

                const exportRes = await fetch(url, { headers: { 'Authorization': `Bearer ${this.accessToken}` } });
                
                if (exportRes.ok) {
                    const content = await exportRes.text();
                    results.push({ id: file.id, title: file.name, content });
                } else {
                    const err = await exportRes.text();
                    console.error("Failed to download file:", file.id, file.name, err);
                }
            }
            return results;
        } catch (e: unknown) {
            return { error: errorMessage(e) || 'Failed to fetch worksheets' };
        }
    }

    async getWorksheetMetadata(limit: number = 10): Promise<{ id: string; name: string }[] | { error: string }> {
        try {
            await this.ensureClient();
            const folderId = await this.findOrCreateWorksheetFolder();

            const listRes = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
                    `'${folderId}' in parents and trashed=false`
                )}&orderBy=createdTime desc&pageSize=${limit}&fields=files(id,name)&spaces=drive`,
                { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
            );

            if (!listRes.ok) throw new Error('Failed to list worksheets');
            const listData = await listRes.json();
            return listData.files || [];
        } catch (e: unknown) {
            return { error: errorMessage(e) || 'Failed to fetch worksheet metadata' };
        }
    }

    async getLatestConsolidatedSummary(): Promise<{ content: string; date: string; data?: unknown } | null> {
        try {
            await this.ensureClient();
            const folderId = await this.findOrCreateWorksheetFolder();
            
            // Search for summary documents
            const searchQuery = `'${folderId}' in parents and name contains 'Riepilogo Consolidato -' and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=1&spaces=drive`;
            
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${this.accessToken}` } });

            if (!res.ok) return null;
            const data = await res.json();
            if (!data.files || data.files.length === 0) return null;

            const file = data.files[0];
            const exportUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`;
            const contentRes = await fetch(exportUrl, { headers: { 'Authorization': `Bearer ${this.accessToken}` } });
            
            if (contentRes.ok) {
                let content = await contentRes.text();
                let jsonData: unknown = undefined;

                // Extract embedded JSON if present
                const dataMatch = content.match(/--- JSON_DATA ---\s*([\s\S]*?)\s*--- END_JSON_DATA ---/);
                if (dataMatch) {
                    try {
                        jsonData = JSON.parse(dataMatch[1]);
                        // Remove the JSON block from visible content
                        content = content.replace(dataMatch[0], '').trim();
                    } catch (e) {
                        console.error("Failed to parse embedded JSON", e);
                    }
                }

                return { 
                    content, 
                    date: file.name.replace('Riepilogo Consolidato - ', ''),
                    data: jsonData
                };
            }
            return null;
        } catch (e) {
            console.error("Failed to fetch latest summary:", e);
            return null;
        }
    }

    async archiveWorksheets(fileIds: string[]): Promise<{ success: boolean } | { error: string }> {
        try {
            await this.ensureClient();
            const folderId = await this.findOrCreateWorksheetFolder();
            const archiveId = await this.findOrCreateArchiveFolder();

            console.log(`[HabitService] Archiving ${fileIds.length} worksheets to folder: ${archiveId}`);

            for (const fileId of fileIds) {
                // To move a file, we remove current parent and add new parent
                const patchRes = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${fileId}?removeParents=${folderId}&addParents=${archiveId}`,
                    {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${this.accessToken}` },
                    }
                );
                if (!patchRes.ok) {
                    console.error(`[HabitService] Failed to archive file: ${fileId}`);
                }
            }
            return { success: true };
        } catch (e: unknown) {
            return { error: errorMessage(e) || 'Failed to archive worksheets' };
        }
    }

    async getTemptations(): Promise<TemptationConfig[]> {
        const prefs = await this.getPreferences();
        if (!('error' in prefs) && prefs.temptations) {
            return prefs.temptations;
        }

        // Default seeding for "Temptations" if no config exists
        return [
            {
                id: "Temptations",
                label: "Temptations",
                icon: "Shield",
                actions: [
                    { id: "smoke", label: "Resisted", icon: "ShieldCheck", color: "#10b981", type: "positive" },
                    { id: "smoked", label: "Smoked", icon: "Flame", color: "#ef4444", type: "negative" },
                    { id: "coffee", label: "Coffee", icon: "Coffee", color: "#b45309", type: "neutral" }
                ]
            }
        ];
    }

    async saveTemptations(temptations: TemptationConfig[]): Promise<{ success: boolean } | { error: string }> {
        const prefs = await this.getPreferences();
        if (!('error' in prefs)) {
            return this.savePreferences(prefs.enabled_tabs ?? [], prefs.default_tab ?? undefined, temptations);
        }
        return { error: "Could not fetch current preferences" };
    }

    // ═══ TRAINING ═══

    /**
     * Ensure the Training sheet exists; create it if missing.
     * Headers: Date | Section | Exercise | Session | Duration
     */
    // ─── HabitNotes sheet ─────────────────────────────────────────────────────
    // Date | Habit | Note, one row per (date, habit); see utils/habitNotes.ts

    private async ensureHabitNotesSheet(): Promise<void> {
        const spreadsheetId = this.getSpreadsheetId();
        const meta = await gapi.client.sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(title))' });
        if (meta.result.sheets?.some((s: SheetMeta) => s.properties?.title === HABIT_NOTES_SHEET)) return;
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: { requests: [{ addSheet: { properties: { title: HABIT_NOTES_SHEET, gridProperties: { frozenRowCount: 1 } } } }] }
        });
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${HABIT_NOTES_SHEET}!A1:C1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[...HABIT_NOTES_COLUMNS]] }
        });
    }

    /** All notes keyed by `date|habit`. A missing sheet reads as {}. */
    async getHabitNotes(): Promise<{ notes: Record<string, HabitNote> } | { error: string }> {
        try {
            await this.ensureClient();
            const res = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: this.getSpreadsheetId(), range: HABIT_NOTES_RANGE });
            const notes: Record<string, HabitNote> = {};
            for (const [key, { date, habit, note }] of rowsToHabitNotes(res.result.values || [])) {
                if (note) notes[key] = { date, habit, note };
            }
            return { notes };
        } catch (e: unknown) {
            const msg: string = errorMessage(e) || '';
            if (errorStatus(e) === 400 || /Unable to parse range/i.test(msg)) return { notes: {} };
            return { error: msg };
        }
    }

    /** Writes the note of one habit on one day; an empty note removes the row. */
    async setHabitNote(date: string, habit: string, note: string): Promise<{ success: boolean } | { error: string }> {
        try {
            await this.ensureClient();
            await this.ensureHabitNotesSheet();
            const spreadsheetId = this.getSpreadsheetId();
            const res = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId, range: HABIT_NOTES_RANGE });
            const existing = rowsToHabitNotes(res.result.values || []).get(noteKey(date, habit));
            const text = note.trim();

            if (existing && !text) {
                const sheetId = await this.getSheetId(HABIT_NOTES_SHEET);
                if (sheetId === null) return { success: true };
                await gapi.client.sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    resource: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: existing.rowIndex, endIndex: existing.rowIndex + 1 } } }] }
                });
            } else if (existing) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${HABIT_NOTES_SHEET}!A${existing.rowIndex + 1}:C${existing.rowIndex + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[date, habit, text]] }
                });
            } else if (text) {
                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId,
                    range: HABIT_NOTES_RANGE,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[date, habit, text]] }
                });
            }
            return { success: true };
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    // ─── Mood sheet ───────────────────────────────────────────────────────────
    // Date | Timestamp | Mood | Anxiety | Label | Source (see utils/mood.ts)

    private async ensureMoodSheet(): Promise<void> {
        const spreadsheetId = this.getSpreadsheetId();
        const meta = await gapi.client.sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(title))' });
        const exists = meta.result.sheets?.some((s: SheetMeta) => s.properties?.title === MOOD_SHEET);
        if (exists) return;

        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [{ addSheet: { properties: { title: MOOD_SHEET, gridProperties: { frozenRowCount: 1 } } } }]
            }
        });
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${MOOD_SHEET}!A1:F1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[...MOOD_COLUMNS]] }
        });
    }

    /** All mood entries, oldest first. A missing sheet reads as an empty list. */
    async getMoodEntries(): Promise<{ entries: MoodEntry[] } | { error: string }> {
        try {
            await this.ensureClient();
            const res = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.getSpreadsheetId(),
                range: MOOD_RANGE,
            });
            return { entries: rowsToMoodEntries(res.result.values || []) };
        } catch (e: unknown) {
            const msg: string = errorMessage(e) || '';
            if (errorStatus(e) === 400 || /Unable to parse range/i.test(msg)) return { entries: [] };
            return { error: msg };
        }
    }

    /** Appends entries (creating the sheet on first use). */
    async appendMoodEntries(entries: MoodEntry[]): Promise<{ success: boolean } | { error: string }> {
        if (entries.length === 0) return { success: true };
        try {
            await this.ensureClient();
            await this.ensureMoodSheet();
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: this.getSpreadsheetId(),
                range: MOOD_RANGE,
                valueInputOption: 'USER_ENTERED',
                resource: { values: entries.map(moodEntryToRow) }
            });
            return { success: true };
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    /** Removes every entry, keeping the header row. */
    async clearMoodEntries(): Promise<{ success: boolean } | { error: string }> {
        try {
            await this.ensureClient();
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: this.getSpreadsheetId(),
                range: `${MOOD_SHEET}!A2:F`,
                resource: {}
            });
            return { success: true };
        } catch (e: unknown) {
            const msg: string = errorMessage(e) || '';
            if (errorStatus(e) === 400 || /Unable to parse range/i.test(msg)) return { success: true };
            return { error: msg };
        }
    }

    async ensureTrainingSheet(): Promise<{ success: boolean } | { error: string }> {
        try {
            await this.ensureClient();
            const spreadsheetId = this.getSpreadsheetId();

            // Check if sheet already exists
            const meta = await gapi.client.sheets.spreadsheets.get({ spreadsheetId });
            const exists = meta.result.sheets?.some((s: SheetMeta) => s.properties?.title === 'Training');
            if (exists) return { success: true };

            // Create sheet
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{ addSheet: { properties: { title: 'Training', gridProperties: { frozenRowCount: 1 } } } }]
                }
            });

            // Add headers
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId,
                range: 'Training!A1:E1',
                valueInputOption: 'USER_ENTERED',
                resource: { values: [['Date', 'Section', 'Exercise', 'Session', 'Duration']] }
            });

            return { success: true };
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    /**
     * Log an exercise as completed. Appends a row to the Training sheet.
     */
    async logTrainingExercise(date: string, section: string, exercise: string, session: string, duration: string): Promise<{ success: boolean } | { error: string }> {
        try {
            await this.ensureClient();
            const spreadsheetId = this.getSpreadsheetId();

            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId,
                range: 'Training!A:E',
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: { values: [[date, section, exercise, session, duration]] }
            });

            return { success: true };
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    /**
     * Remove a training log entry (undo). Finds and deletes the matching row.
     */
    async removeTrainingExercise(date: string, section: string, exercise: string, session: string): Promise<{ success: boolean } | { error: string }> {
        try {
            await this.ensureClient();
            const spreadsheetId = this.getSpreadsheetId();

            // Fetch all training data to find the row
            const res = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'Training!A:E',
            });
            const values = res.result.values || [];

            // Find the row (skip header at index 0)
            let rowToDelete = -1;
            for (let i = 1; i < values.length; i++) {
                const row = values[i];
                if (row[0] === date && row[1] === section && row[2] === exercise && row[3] === session) {
                    rowToDelete = i;
                    break;
                }
            }

            if (rowToDelete === -1) return { error: 'Entry not found' };

            // Get the sheetId for Training
            const meta = await gapi.client.sheets.spreadsheets.get({ spreadsheetId });
            const trainingSheet = meta.result.sheets?.find((s: SheetMeta) => s.properties?.title === 'Training');
            if (!trainingSheet) return { error: 'Training sheet not found' };

            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: trainingSheet.properties?.sheetId,
                                dimension: 'ROWS',
                                startIndex: rowToDelete,
                                endIndex: rowToDelete + 1
                            }
                        }
                    }]
                }
            });

            return { success: true };
        } catch (e: unknown) {
            return { error: errorMessage(e) };
        }
    }

    /**
     * Get all training log entries, optionally filtered by year/month.
     */
    async getTrainingLog(year?: number, month?: number): Promise<{ entries: string[][] } | { error: string }> {
        try {
            await this.ensureClient();
            const spreadsheetId = this.getSpreadsheetId();

            const res = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'Training!A:E',
            });

            const values = res.result.values || [];
            if (values.length <= 1) return { entries: [] }; // Only header or empty

            let entries = values.slice(1); // Skip header

            // Filter by year/month if specified
            if (year !== undefined && month !== undefined) {
                entries = entries.filter((row: SheetRow) => {
                    if (!row[0]) return false;
                    const parts = String(row[0]).split('/');
                    if (parts.length < 3) return false;
                    const m = parseInt(parts[1]) - 1; // 0-indexed
                    const y = parseInt(parts[2]);
                    return y === year && m === month;
                });
            }

            return { entries };
        } catch (e: unknown) {
            // If sheet doesn't exist yet, return empty
            if (errorStatus(e) === 400 || (errorMessage(e) || '').includes('Unable to parse range')) {
                return { entries: [] };
            }
            return { error: errorMessage(e) };
        }
    }
}

export const habitService = new HabitServiceImpl();
