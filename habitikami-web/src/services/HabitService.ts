import { gapi } from 'gapi-script';
// We use gapi-script for loading, but types come from @types/gapi
// and we need to initialize the client.
import { hexToSheetColor, sheetColorToHex } from '../utils/colors';
import { findHeaderRowIndex } from '../utils/parser';

// CLIENT_SECRET must never be referenced here; token exchange is backend-only
const CLIENT_ID = (window as any).config?.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID;

const DISCOVERY_DOCS = [
    "https://sheets.googleapis.com/$discovery/rest?version=v4",
    "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"
];
const SCOPES = "https://www.googleapis.com/auth/drive.file openid email";

const SESSION_KEY = 'habitikami_session_v3';

interface SessionData {
    access_token: string;
    refresh_token?: string;
    expiry_date: number;
    email: string;
    spreadsheet_id: string;
}

class HabitServiceImpl {
    private tokenClient: any;
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private tokenExpiry: number = 0;
    private authError: string | null = null;
    private oauthState: string | null = null;
    private email: string | null = null;
    private spreadsheetId: string | null = null;

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

    private loadGapi() {
        const script = document.createElement('script');
        script.src = "https://apis.google.com/js/api.js";
        script.onload = () => {
            gapi.load('client', async () => {
                try {
                    console.log("Initializing GAPI client...");
                    await gapi.client.init({
                        // apiKey: API_KEY, // Optional if we use OAuth
                        discoveryDocs: DISCOVERY_DOCS,
                    });
                    console.log("GAPI client initialized.");
                } catch (e: any) {
                    console.error("GAPI init error:", e);
                    this.initError = e.result?.error?.message || e.message || JSON.stringify(e);
                }
            });
        };
        script.onerror = () => {
            this.initError = "Failed to load Google API script.";
        };
        document.body.appendChild(script);

        // Initialize GIS (Google Identity Services) for Auth
        const gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.async = true;
        gisScript.defer = true;
        gisScript.onload = () => {
            try {
                // Generate a random state token for CSRF protection
                this.oauthState = crypto.randomUUID();

                this.tokenClient = (window as any).google.accounts.oauth2.initCodeClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    ux_mode: 'popup',
                    include_granted_scopes: true,
                    state: this.oauthState,
                    callback: async (response: any) => {
                        if (response.error) {
                            console.error("Auth Error:", response);
                            return;
                        }
                        // Verify state to prevent CSRF attacks
                        if (response.state !== this.oauthState) {
                            console.error("OAuth state mismatch — possible CSRF attack");
                            this.authError = "Security error: OAuth state mismatch";
                            return;
                        }
                        if (response.code) {
                            await this.exchangeCodeForTokens(response.code);
                        }
                    },
                });
            } catch (e: any) {
                console.error("GIS init error:", e);
                this.initError = "GIS init error: " + e.message;
            }
        };
        document.body.appendChild(gisScript);
    }

    /**
     * Trigger the Login Popup (Code Flow)
     */
    async auth(): Promise<{ success?: boolean, error?: string }> {
        if (!CLIENT_ID) {
            return { error: "Missing CLIENT_ID environment variable" };
        }

        return new Promise((resolve) => {
            if (!this.tokenClient) {
                return resolve({ error: "Google Identity Services not loaded yet. Try again in a moment." });
            }

            // Hook into the callback execution flow by waiting for internal state change
            // This is a bit tricky with code flow as the callback is defined in init.
            // We can wrap the exchangeCodeForTokens or assume success if no error thrown.
            // For better UX, we'll return a promise that resolves when tokens are set.

            this.authError = null;

            const checkToken = setInterval(() => {
                if (this.accessToken) {
                    clearInterval(checkToken);
                    resolve({ success: true });
                } else if (this.authError) {
                    clearInterval(checkToken);
                    resolve({ error: this.authError });
                }
            }, 500);

            // Timeout after 60s
            setTimeout(() => {
                clearInterval(checkToken);
                if (!this.accessToken) resolve({ error: this.authError || "Auth timed out" });
            }, 60000);

            this.tokenClient.requestCode();
        });
    }

    private async exchangeCodeForTokens(code: string) {
        try {
            const response = await fetch('/api/auth/exchange', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });

            const data = await response.json();
            if (!response.ok || data.error) throw new Error(data.error || 'Token exchange failed');

            this.saveSession(data);
        } catch (e) {
            console.error('Error exchanging code:', e);
            this.authError = e instanceof Error ? e.message : 'Authentication failed';
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
                if (data.code === 'invalid_grant') {
                    this.clearSession();
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

    private saveSession(data: any) {
        this.accessToken = data.access_token;
        if (data.refresh_token) this.refreshToken = data.refresh_token;
        if (data.email) this.email = data.email;
        if (data.spreadsheet_id) this.spreadsheetId = data.spreadsheet_id;

        const expires_in = data.expires_in || 3599;
        this.tokenExpiry = Date.now() + (expires_in * 1000);

        if (gapi.client) (gapi.client as any).setToken({ access_token: this.accessToken });

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
                            (gapi.client as any).setToken({ access_token: this.accessToken });
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

            const requests: any[] = [
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
            
            const formatRequests: any[] = [];
            
            const weekdaysSheet = sheets.find((s: any) => s.properties?.title === 'Weekdays');
            if (weekdaysSheet) {
                formatRequests.push({
                    repeatCell: {
                        range: { sheetId: weekdaysSheet.properties?.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 2, endColumnIndex: 3 },
                        cell: { userEnteredFormat: { backgroundColor: hexToSheetColor('#8b5cf6') } },
                        fields: "userEnteredFormat.backgroundColor"
                    }
                });
            }
            
            const weekendSheet = sheets.find((s: any) => s.properties?.title === 'Weekend');
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

        } catch (e: any) {
            console.error("Error creating template", e);
            return { error: e.result?.error?.message || e.message || "Failed to create tracker" };
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
        } catch (e: any) {
            console.error("Error fetching data", e);
            if (e.status === 401 || e.status === 403) {
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
            return { error: e.result?.error?.message || e.message };
        }
    }

    async getDataSubset(sheetName: string, year: number, month: number): Promise<
        { values: any[][], dataStartRow: number, headerRowIndex: number } | { error: string }
    > { // month is 0-indexed (0=Jan)
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
            let dateColIndex = headerRow.findIndex((c: any) => typeof c === 'string' && /data|date/i.test(c));
            if (dateColIndex === -1) dateColIndex = 1; // Default to column B (index 1)

            const dateColLetter = this.getColumnLetter(dateColIndex);

            // 2. Fetch All Dates (Column only) to find boundaries
            // We fetch from headerRowIndex + 2 (start of data) to end
            // Range: e.g. "Weekdays!B3:B"
            const dataStartRow = headerRowIndex + 1 + 1; // 1-based index for API. Header is at headerRowIndex+1. Data starts at headerRowIndex+2
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

            // 3. Filter for Start and End Index
            // We need to parse dates "DD/MM/YYYY"
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

            // dateValues is array of arrays [[dateStr], [dateStr]...]
            // The index i here corresponds to (dataStartRow + i) in 1-based sheet row

            for (let i = 0; i < dateValues.length; i++) {
                const dateStr = dateValues[i][0];
                const d = parseDate(dateStr);
                if (!d) continue;

                if (d.y === year && d.m === month) {
                    if (startRowOffset === -1) startRowOffset = i;
                    endRowOffset = i;
                }
            }

            // If no data for this month found:
            if (startRowOffset === -1) {
                // Return just header? Or return empty data
                return {
                    values: [headerRow],
                    dataStartRow: dataStartRow + (dateValues.length), // Append at end?
                    headerRowIndex: headerRowIndex
                };
            }

            // 4. Fetch the actual data subset (Columns A to Z or whatever)
            // Range 1-based:
            // Start Row = dataStartRow + startRowOffset
            // End Row = dataStartRow + endRowOffset
            const fetchStart = dataStartRow + startRowOffset;
            const fetchEnd = dataStartRow + endRowOffset;

            const dataRange = `${sheetName}!A${fetchStart}:ZZ${fetchEnd}`;
            const subsetRes = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.getSpreadsheetId(),
                range: dataRange
            });

            const subsetValues = subsetRes.result.values || [];

            // Combine Header + Subset
            // But wait, the parser expects [Header, Data...]
            // So we return [headerRow, ...subsetValues]
            // AND we need to tell the consumer what the 'offset' is for updating cells.
            // The 'offset' is how many rows were skipped BEFORE the first data row in this subset.
            // The first row in subsetValues corresponds to sheet row `fetchStart`.
            // The standard 'getData' returns rows starting at row 1 (or whatever).
            // parseSheetData calculates index based on the array it receives.
            // data[0] -> sheet row `fetchStart`.
            // In original `getData`: data[0] -> sheet row `headerRowIndex + 2`.

            // We need to return `startRowIndex` which is the 0-based index of the first data row in the real sheet?
            // No, let's return `offset`. 
            // `offset` = (fetchStart) - (headerRowIndex + 2) ?
            // Let's just return `fetchStart` (1-based index of first data row).

            return {
                values: [headerRow, ...subsetValues],
                dataStartRow: fetchStart, // 1-based index of the first data row in this result
                headerRowIndex: headerRowIndex
            };

        } catch (e: any) {
            console.error("Error fetching subset", e);
            return { error: e.result?.error?.message || e.message };
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

    async updateCell(sheetName: string, rowIndex: number, colIndex: number, value: boolean) {
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
        } catch (e: any) {
            if (e.status === 401) await this.refreshAccessToken(); // Naive retry hook
            return { error: e.result?.error?.message || e.message };
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

        } catch (e: any) {
            return { error: e.result?.error?.message || e.message };
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
            let dateColIndex = headerRow.findIndex((c: any) => typeof c === 'string' && /data|date/i.test(c));
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
        } catch (e: any) {
            return { error: e.result?.error?.message || e.message };
        }
    }

    private async getSheetId(sheetName: string): Promise<number | null> {
        await this.ensureClient();
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: this.getSpreadsheetId(),
            fields: 'sheets(properties(sheetId,title))'
        });
        const sheet = response.result.sheets?.find((s: any) => s.properties.title === sheetName);
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
        } catch (e: any) {
            return { error: e.result?.error?.message || e.message };
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
        } catch (e: any) {
            return { error: e.result?.error?.message || e.message };
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
                if (row.values?.some((cell: any) => {
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
                headerRow.values.forEach((cell: any) => {
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

        } catch (e: any) {
            console.error("Error fetching colors", e);
            return { error: e.result?.error?.message || e.message };
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

        } catch (e: any) {
            return { error: e.result?.error?.message || e.message };
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

            return rows.slice(start).map((r: any[]) => ({
                date: r[0] || "",
                content: r[1] || "",
                links: r[2] ? r[2].split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0) : []
            }));
        } catch (e: any) {
            console.error("Error fetching notes", e);
            return { error: e.result?.error?.message || e.message };
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
                } catch (createError: any) {
                    console.error("Failed to create sheet", createError);
                    throw new Error("Could not create MobNotes sheet: " + (createError.result?.error?.message || createError.message));
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

        } catch (e: any) {
            return { error: e.result?.error?.message || e.message };
        }
    }

    async incrementCounter(counterName: string) {
        console.log("Incrementing counter:", counterName);
        try {
            await this.ensureClient();
            const sheetName = "Counters";
            const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

            // 1. Fetch all data to find if row exists for today
            let values: any = await this.getData(sheetName);

            // Check if sheet exists or needs creation
            if (!Array.isArray(values) && values && 'error' in values) {
                console.log(`Sheet ${sheetName} maybe missing, attempting to create...`);
                try {
                    await gapi.client.sheets.spreadsheets.batchUpdate({
                        spreadsheetId: this.getSpreadsheetId(),
                        resource: {
                            requests: [{
                                addSheet: {
                                    properties: {
                                        title: sheetName,
                                        gridProperties: {
                                            columnCount: 4,
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
                        range: `${sheetName}!A1:B1`,
                        valueInputOption: 'USER_ENTERED',
                        resource: {
                            values: [["Date", "Smoke", "Smoked", "Coffee"]]
                        }
                    });
                    // Retry fetch
                    values = await this.getData(sheetName);
                } catch (e) {
                    // If sheet already exists, batchUpdate will fail, that's fine.
                    // But if values was error, we needed it.
                    console.log("Sheet creation skipped or failed", e);
                }
            }
            if (!Array.isArray(values) && values && 'error' in values) throw new Error(values.error);

            // Find row for today
            let rowIndex = -1;
            let currentVal = 0;

            if (Array.isArray(values)) {
                for (let i = 0; i < values.length; i++) {
                    if (values[i][0] === dateStr) {
                        rowIndex = i;
                        // assuming Smoke is col 1 (B), Smoked is col 2 (C)
                        if (counterName === 'smoke') {
                            currentVal = parseInt(values[i][1] || "0");
                        } else if (counterName === 'smoked') {
                            currentVal = parseInt(values[i][2] || "0");
                        } else if (counterName === 'coffee') {
                            currentVal = parseInt(values[i][3] || "0");
                        }
                        break;
                    }
                }
            }

            if (rowIndex !== -1) {
                let range = `${sheetName}!B${rowIndex + 1}`;
                if (counterName === 'smoked') {
                    range = `${sheetName}!C${rowIndex + 1}`;
                } else if (counterName === 'coffee') {
                    range = `${sheetName}!D${rowIndex + 1}`;
                }
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: this.getSpreadsheetId(),
                    range: range,
                    valueInputOption: 'USER_ENTERED',
                    resource: {
                        values: [[currentVal + 1]]
                    }
                });
            } else {
                // Append
                // If today's row doesn't exist, we create it.
                // If counter is 'smoke', we put [date, 1, 0]
                // If counter is 'smoked', we put [date, 0, 1]
                const newRow = [dateStr, 0, 0];
                if (counterName === 'smoke') newRow[1] = 1;
                else if (counterName === 'smoked') newRow[2] = 1;
                else if (counterName === 'coffee') newRow[3] = 1;

                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId: this.getSpreadsheetId(),
                    range: sheetName,
                    valueInputOption: 'USER_ENTERED',
                    resource: {
                        values: [newRow]
                    }
                });
            }

            return { success: true };

        } catch (e: any) {
            return { error: e.result?.error?.message || e.message };
        }
    }

    async getPreferences(): Promise<{ enabled_tabs: string[] | null; default_tab: string | null } | { error: string }> {
        try {
            const response = await fetch('/api/user/preferences', {
                headers: { Authorization: `Bearer ${this.accessToken}` },
            });
            if (!response.ok) {
                const data = await response.json();
                return { error: data.error || 'Failed to fetch preferences' };
            }
            return await response.json();
        } catch (e: any) {
            return { error: e.message };
        }
    }

    async savePreferences(enabledTabs: string[], defaultTab?: string): Promise<{ success: boolean } | { error: string }> {
        try {
            const response = await fetch('/api/user/preferences', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.accessToken}`,
                },
                body: JSON.stringify({ enabled_tabs: enabledTabs, default_tab: defaultTab || null }),
            });
            if (!response.ok) {
                const data = await response.json();
                return { error: data.error || 'Failed to save preferences' };
            }
            return await response.json();
        } catch (e: any) {
            return { error: e.message };
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
        } catch (e: any) {
            return { error: e.message };
        }
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
        } catch (e: any) {
            return { error: e.message };
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
        } catch (e: any) {
            return { error: e.message };
        }
    }

    async getCounters(): Promise<import('../types').CounterData[] | { error: string }> {
        try {
            await this.ensureClient();
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.getSpreadsheetId(),
                range: "Counters!A:D",
            });
            const rows = response.result.values;
            if (!rows || rows.length === 0) return [];

            // Skip header if present
            const start = (rows[0][0] === "Date") ? 1 : 0;

            const data = rows.slice(start).map((r: any[]) => ({
                date: r[0] || "",
                smoke: parseInt(r[1] || "0"),
                smoked: parseInt(r[2] || "0"),
                coffee: parseInt(r[3] || "0")
            }));
            // Return reversed to show latest first?
            return data.reverse();

        } catch (e: any) {
            // console.error("Error fetching counters", e);
            return { error: e.result?.error?.message || e.message };
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
            return { fileId: result.id, fileUrl: result.webViewLink };
        } catch (e: any) {
            return { error: e.message || 'Failed to create Drive document' };
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
        } catch (e: any) {
            return { error: e.message || 'Failed to fetch worksheets' };
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
        } catch (e: any) {
            return { error: e.message || 'Failed to fetch worksheet metadata' };
        }
    }

    async archiveWorksheets(fileIds: string[]): Promise<{ success: boolean } | { error: string }> {
        try {
            await this.ensureClient();
            const folderId = await this.findOrCreateWorksheetFolder();
            const archiveId = await this.findOrCreateArchiveFolder();

            for (const fileId of fileIds) {
                // To move a file, we remove current parent and add new parent
                await fetch(
                    `https://www.googleapis.com/drive/v3/files/${fileId}?removeParents=${folderId}&addParents=${archiveId}`,
                    {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${this.accessToken}` },
                    }
                );
            }
            return { success: true };
        } catch (e: any) {
            return { error: e.message || 'Failed to archive worksheets' };
        }
    }
}

export const habitService = new HabitServiceImpl();
