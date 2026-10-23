import type { MoodEntry } from '../types';

/**
 * Mood entries live in the `Mood` sheet, one row per assessment:
 *
 *   Date | Timestamp | Mood | Anxiety | Label | Source
 *
 * Date is the ISO timestamp of the assessment, Timestamp its epoch ms,
 * Mood and Anxiety are 0-100, Label the session that produced it and
 * Source where it came from (`chat`, `worksheet`, or `local` for entries
 * migrated from the browser storage used before the sheet existed).
 *
 * The localStorage key that used to hold the history now works as an
 * outbox: entries that could not be written to the sheet (offline, no
 * session) wait there and are flushed on the next read.
 */
export const MOOD_SHEET = 'Mood';
export const MOOD_COLUMNS = ['Date', 'Timestamp', 'Mood', 'Anxiety', 'Label', 'Source'] as const;
export const MOOD_RANGE = `${MOOD_SHEET}!A:F`;
export const MOOD_PENDING_KEY = 'habitikami_mood_history';

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function moodEntryToRow(entry: MoodEntry): (string | number)[] {
    return [
        entry.date,
        entry.timestamp,
        clamp(entry.mood),
        clamp(entry.anxiety),
        entry.label ?? '',
        entry.source ?? '',
    ];
}

/** Parses one data row; returns null when the row has no usable date or scores. */
export function rowToMoodEntry(row: readonly unknown[] | undefined): MoodEntry | null {
    if (!row) return null;
    const cell = (i: number) => (row[i] === undefined || row[i] === null ? '' : String(row[i]).trim());
    const date = cell(0);
    const mood = Number.parseFloat(cell(2));
    const anxiety = Number.parseFloat(cell(3));
    if (!date || !Number.isFinite(mood) || !Number.isFinite(anxiety)) return null;

    let timestamp = Number.parseInt(cell(1), 10);
    if (!Number.isFinite(timestamp)) {
        const parsed = Date.parse(date);
        timestamp = Number.isFinite(parsed) ? parsed : 0;
    }
    const source = cell(5);
    return {
        date,
        timestamp,
        mood: clamp(mood),
        anxiety: clamp(anxiety),
        label: cell(4),
        source: source === 'chat' || source === 'worksheet' || source === 'local' ? source : undefined,
    };
}

/** Rows of the Mood sheet (header included or not) → entries sorted by time. */
export function rowsToMoodEntries(rows: readonly (readonly unknown[])[]): MoodEntry[] {
    const start = rows[0] && typeof rows[0][0] === 'string' && /^date$/i.test(rows[0][0].trim()) ? 1 : 0;
    const out: MoodEntry[] = [];
    for (let i = start; i < rows.length; i++) {
        const entry = rowToMoodEntry(rows[i]);
        if (entry) out.push(entry);
    }
    return out.sort((a, b) => a.timestamp - b.timestamp);
}

function storage(): Storage | null {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
        return null;
    }
}

/** Entries waiting to be written to the sheet (and the pre-sheet history). */
export function readPendingMoodEntries(): MoodEntry[] {
    const raw = storage()?.getItem(MOOD_PENDING_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(e => e && typeof e.mood === 'number' && typeof e.anxiety === 'number') : [];
    } catch {
        return [];
    }
}

export function writePendingMoodEntries(entries: MoodEntry[]): void {
    const s = storage();
    if (!s) return;
    if (entries.length === 0) s.removeItem(MOOD_PENDING_KEY);
    else s.setItem(MOOD_PENDING_KEY, JSON.stringify(entries.slice(-200)));
}

export function queuePendingMoodEntry(entry: MoodEntry): void {
    writePendingMoodEntries([...readPendingMoodEntries(), entry]);
}

/** A mood entry stamped with the current time (kept out of components for the React compiler). */
export function moodEntryNow(mood: number, anxiety: number, label: string, source: MoodEntry['source']): MoodEntry {
    const now = new Date();
    return { date: now.toISOString(), timestamp: now.getTime(), mood: clamp(mood), anxiety: clamp(anxiety), label, source };
}
