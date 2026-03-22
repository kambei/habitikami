import type { HabitData } from "../types";

/** Header row detection pattern — shared with HabitService */
const HEADER_PATTERN = /giorno|date|day/i;

/**
 * Finds the index of the header row within the first `limit` rows.
 * Falls back to 1 if not found (matches legacy sheet layouts).
 */
export function findHeaderRowIndex(rows: any[][], limit = 10): number {
    for (let i = 0; i < Math.min(rows.length, limit); i++) {
        const row = rows[i];
        if (row?.some((cell: any) => typeof cell === 'string' && HEADER_PATTERN.test(cell))) {
            return i;
        }
    }
    return 1;
}

export function parseSheetData(values: any[][]): {
    headers: string[],
    data: HabitData[],
    meta: { headerRowIndex: number, startCol: number }
} {
    if (!values || values.length === 0) return { headers: [], data: [], meta: { headerRowIndex: 0, startCol: 2 } };

    const headerRowIndex = findHeaderRowIndex(values);

    const headerRow = values[headerRowIndex];
    if (!headerRow) return { headers: [], data: [], meta: { headerRowIndex: 0, startCol: 2 } };

    // Find "Giorno" column index to be sure
    const dayColIndex = headerRow.findIndex((c: any) => typeof c === 'string' && /giorno|day/i.test(c));
    const dateColIndex = headerRow.findIndex((c: any) => typeof c === 'string' && /data|date/i.test(c));

    // If we can't find columns, assume standard 0 and 1 ??
    // Let's rely on standard structure if finding fails, but use what we found if possible.
    const startCol = (dayColIndex !== -1 && dateColIndex !== -1) ? Math.max(dayColIndex, dateColIndex) + 1 : 2;

    // Also "Wake up" might be the first habit
    // Let's strict it: Habits start after "Data"

    const headers = headerRow.slice(startCol);

    const data: HabitData[] = [];

    for (let i = headerRowIndex + 1; i < values.length; i++) {
        const row = values[i];
        if (!row || row.length === 0) continue;

        const day = (dayColIndex !== -1 ? row[dayColIndex] : row[0]) || '';
        const date = (dateColIndex !== -1 ? row[dateColIndex] : row[1]) || '';

        // Stop if no date (empty row)
        if (!date) continue;

        const habits: Record<string, boolean> = {};

        headers.forEach((h: string, index: number) => {
            const colIndex = startCol + index;
            const val = row[colIndex];
            habits[h] = val === true || val === 'TRUE';
        });

        data.push({
            day,
            date,
            habits
        });
    }

    return { headers, data, meta: { headerRowIndex, startCol } };
}
