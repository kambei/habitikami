import type { CounterData, HabitData, HabitNote, MoodEntry } from '../types';
import { parseDate } from './dateParsing';

/**
 * CSV export (issue #18), built on the client from the data already loaded:
 * one table per kind (habits, counters, notes, mood), each with its own
 * header, separated by a blank line. Values are RFC 4180 quoted.
 */

export interface ExportBundle {
    habits: HabitData[];
    counters?: CounterData[];
    notes?: HabitNote[];
    mood?: MoodEntry[];
}

export function csvCell(value: unknown): string {
    if (value === undefined || value === null) return '';
    const s = typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRows(rows: unknown[][]): string {
    return rows.map(r => r.map(csvCell).join(',')).join('\n');
}

function cellValue(v: HabitData['habits'][string] | undefined): string | number | boolean {
    if (v === undefined) return '';
    if (v === 'skipped') return 'SKIP';
    if (v === 'half') return 'HALF';
    return v;
}

function inRange(date: Date | null, from: Date, to: Date): boolean {
    if (!date) return false;
    const t = date.getTime();
    return t >= from.getTime() && t <= to.getTime();
}

/** The whole bundle as CSV text, limited to [from, to] (inclusive, local days). */
export function buildCsv(bundle: ExportBundle, from: Date, to: Date): string {
    const f = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const t = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
    const sections: string[] = [];

    const habitRows = bundle.habits
        .filter(r => inRange(parseDate(r.date), f, t))
        .sort((a, b) => (parseDate(a.date)?.getTime() ?? 0) - (parseDate(b.date)?.getTime() ?? 0));
    const habitNames = Array.from(new Set(habitRows.flatMap(r => Object.keys(r.habits))));
    sections.push(csvRows([
        ['Date', 'Day', ...habitNames],
        ...habitRows.map(r => [r.date, r.day, ...habitNames.map(h => cellValue(r.habits[h]))]),
    ]));

    if (bundle.counters && bundle.counters.length > 0) {
        const rows = bundle.counters.filter(c => inRange(parseDate(c.date), f, t));
        const names = Array.from(new Set(rows.flatMap(c => Object.keys(c).filter(k => k !== 'date'))));
        if (rows.length > 0) sections.push(csvRows([['Date', ...names], ...rows.map(c => [c.date, ...names.map(n => c[n] ?? 0)])]));
    }

    if (bundle.notes && bundle.notes.length > 0) {
        const rows = bundle.notes.filter(n => inRange(parseDate(n.date), f, t));
        if (rows.length > 0) sections.push(csvRows([['Date', 'Habit', 'Note'], ...rows.map(n => [n.date, n.habit, n.note])]));
    }

    if (bundle.mood && bundle.mood.length > 0) {
        const rows = bundle.mood.filter(m => m.timestamp >= f.getTime() && m.timestamp <= t.getTime());
        if (rows.length > 0) sections.push(csvRows([['Date', 'Mood', 'Anxiety', 'Label'], ...rows.map(m => [m.date, m.mood, m.anxiety, m.label])]));
    }

    return sections.join('\n\n') + '\n';
}

export function exportFileName(from: Date, to: Date, ext: string): string {
    const k = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `habitikami_${k(from)}-${k(to)}.${ext}`;
}

/** Triggers a browser download of `text` (UTF-8 with BOM so Excel reads accents). */
export function downloadText(text: string, fileName: string, mime = 'text/csv'): void {
    const blob = new Blob(['﻿' + text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
