// Pure helpers for reading and writing single habit cells (issue #123):
// the Android "Today" widget reads today's row through GET /api/today and
// writes one cell through POST /api/cell. No I/O here, so it is unit-tested.

const HEADER_PATTERN = /giorno|date|day/i;
const META_COLUMNS = /^(date|data|giorno|day|jour|fecha)$/i;
const VALUE_WORDS = new Set(['TRUE', 'FALSE', 'HALF', 'SKIP']);

/** Index of the header row (first row with a day/date column) or -1. */
export function findHeaderRowIndex(rows, limit = 10) {
    for (let i = 0; i < Math.min(rows.length, limit); i++) {
        if (rows[i]?.some(c => typeof c === 'string' && HEADER_PATTERN.test(c))) return i;
    }
    return -1;
}

/** "YYYY-MM-DD" or "DD/MM/YYYY" → "DD/MM/YYYY" as the sheets store it; null when unparsable. */
export function toSheetDate(input) {
    const s = String(input ?? '').trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
    return null;
}

/** Weekdays or Weekend for a "DD/MM/YYYY" date. */
export function sheetForDate(sheetDate) {
    const [d, m, y] = sheetDate.split('/').map(Number);
    const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return day === 0 || day === 6 ? 'Weekend' : 'Weekdays';
}

/** Column letter(s) of a 0-based index. */
export function columnLetter(idx) {
    let s = '';
    let n = idx;
    while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
    return s;
}

/**
 * Where a habit's cell for a date is in `rows` (raw values of a sheet).
 * Returns { rowIndex, colIndex } (0-based) or { error } naming what is missing.
 */
export function locateCell(rows, sheetDate, habit) {
    const headerRowIndex = findHeaderRowIndex(rows);
    if (headerRowIndex === -1) return { error: 'header row not found' };
    const header = rows[headerRowIndex];
    const dateCol = header.findIndex(c => typeof c === 'string' && /^(date|data)$/i.test(c.trim()));
    const colIndex = header.findIndex(c => typeof c === 'string' && c.trim().toLowerCase() === String(habit).trim().toLowerCase());
    if (dateCol === -1) return { error: 'date column not found' };
    if (colIndex === -1 || META_COLUMNS.test(String(header[colIndex]).trim())) return { error: 'habit not found' };
    const rowIndex = rows.findIndex((r, i) => i > headerRowIndex && String(r?.[dateCol] ?? '').trim() === sheetDate);
    if (rowIndex === -1) return { error: 'row not found' };
    return { rowIndex, colIndex, headerRowIndex };
}

/** Accepts TRUE/FALSE/HALF/SKIP (any case), booleans and numbers; null otherwise. */
export function normalizeCellValue(value) {
    if (value === true) return 'TRUE';
    if (value === false) return 'FALSE';
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
    const s = String(value ?? '').trim().toUpperCase();
    if (VALUE_WORDS.has(s)) return s;
    const n = Number(s.replace(',', '.'));
    if (s !== '' && Number.isFinite(n) && n >= 0) return n;
    return null;
}

function isDone(raw, meta) {
    const s = String(raw ?? '').trim().toUpperCase();
    if (s === 'TRUE' || s === 'HALF') return true;
    if (s === 'FALSE' || s === 'SKIP' || s === '') return false;
    const n = parseFloat(s.replace(',', '.'));
    if (!Number.isFinite(n)) return false;
    return meta?.target ? n >= meta.target : n > 0;
}

/**
 * Today's habits from the raw rows: name, raw value, done flag and the
 * HabitMeta/colour of each. `found` is false when the date has no row.
 */
export function todaySummary(rows, sheetDate, habitMeta = {}, colors = {}) {
    const headerRowIndex = findHeaderRowIndex(rows);
    if (headerRowIndex === -1) return { found: false, habits: [] };
    const header = rows[headerRowIndex];
    const dateCol = header.findIndex(c => typeof c === 'string' && /^(date|data)$/i.test(c.trim()));
    const row = rows.find((r, i) => i > headerRowIndex && String(r?.[dateCol] ?? '').trim() === sheetDate);
    const habits = [];
    header.forEach((name, i) => {
        if (typeof name !== 'string' || !name.trim() || META_COLUMNS.test(name.trim())) return;
        const meta = habitMeta[name] || {};
        const raw = row ? (row[i] ?? '') : '';
        habits.push({
            name,
            value: raw === '' ? null : String(raw),
            done: isDone(raw, meta),
            type: meta.type || 'check',
            target: meta.target ?? null,
            unit: meta.unit ?? null,
            slot: meta.slot || 'any',
            time: meta.time ?? null,
            color: colors[name] || null,
        });
    });
    return { found: !!row, habits };
}
