/** Shape of a Google Sheets file id. */
export const SPREADSHEET_ID_PATTERN = /^[a-zA-Z0-9_-]{10,100}$/;

/**
 * Accepts either a bare spreadsheet id or any Google Sheets URL
 * (`https://docs.google.com/spreadsheets/d/<id>/edit#gid=0`, also with
 * `/u/0/` or query strings) and returns the id, or null when neither matches.
 * Users usually copy the whole address bar, which is where linking failed.
 */
export function extractSpreadsheetId(input: string): string | null {
    const value = (input ?? '').trim();
    if (!value) return null;
    if (SPREADSHEET_ID_PATTERN.test(value)) return value;

    const fromUrl = value.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{10,100})(?:[/?#]|$)/);
    if (fromUrl) return fromUrl[1];

    // Generic ".../d/<id>" fallback (e.g. a shortened or copied path)
    const generic = value.match(/\/d\/([a-zA-Z0-9_-]{10,100})(?:[/?#]|$)/);
    return generic ? generic[1] : null;
}
