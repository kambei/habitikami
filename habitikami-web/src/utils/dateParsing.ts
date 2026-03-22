/**
 * Parses a date string into a Date object.
 * Supports:
 * - DD/MM/YYYY (common in Italy/EU)
 * - YYYY-MM-DD (ISO)
 * - Standard Date.parse formats
 *
 * Returns null if the string cannot be parsed, so callers can handle the
 * error explicitly rather than silently receiving epoch (new Date(0)).
 */
export function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    // Check for DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const euPattern = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/;
    const match = dateStr.match(euPattern);

    if (match) {
        const d = parseInt(match[1], 10);
        const m = parseInt(match[2], 10) - 1; // Month is 0-indexed
        let y = parseInt(match[3], 10);

        if (y < 100) y += 2000;

        const date = new Date(y, m, d);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    // Try standard parsing
    const standardDate = new Date(dateStr);
    if (!isNaN(standardDate.getTime())) {
        return standardDate;
    }

    console.warn(`parseDate: Could not parse date string "${dateStr}".`);
    return null;
}
