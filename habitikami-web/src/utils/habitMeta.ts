import type { HabitMeta, HabitSlot, HabitType } from '../types';

/**
 * Per-habit metadata lives in the `HabitMeta` sheet, one row per habit:
 *
 *   Habit | Description | Type | Target | Unit | Slot | Time
 *
 * Older sheets only have the first two columns; every other column is
 * optional and falls back to the defaults below. Cells are written with
 * USER_ENTERED, so Target comes back as a string and is parsed here.
 */
export const HABIT_META_COLUMNS = ['Habit', 'Description', 'Type', 'Target', 'Unit', 'Slot', 'Time'] as const;
export const HABIT_META_RANGE = 'HabitMeta!A:G';

export const HABIT_TYPES: readonly HabitType[] = ['check', 'number'] as const;
export const HABIT_SLOTS: readonly HabitSlot[] = ['any', 'morning', 'afternoon', 'evening'] as const;

export const DEFAULT_HABIT_META: HabitMeta = {
    description: '',
    type: 'check',
    slot: 'any',
};

const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Parses one data row of the HabitMeta sheet. Unknown or invalid cells fall back to defaults. */
export function rowToHabitMeta(row: readonly unknown[] | undefined): HabitMeta {
    const cell = (i: number) => {
        const v = row?.[i];
        return v === undefined || v === null ? '' : String(v).trim();
    };
    const type = cell(2).toLowerCase();
    const target = Number.parseFloat(cell(3).replace(',', '.'));
    const slot = cell(5).toLowerCase();
    const time = cell(6);
    const unit = cell(4);

    return {
        description: cell(1),
        type: (HABIT_TYPES as readonly string[]).includes(type) ? (type as HabitType) : 'check',
        target: Number.isFinite(target) && target > 0 ? target : undefined,
        unit: unit || undefined,
        slot: (HABIT_SLOTS as readonly string[]).includes(slot) ? (slot as HabitSlot) : 'any',
        time: TIME_PATTERN.test(time) ? time : undefined,
    };
}

/** Serialises a habit's metadata to the 7 cells of its HabitMeta row. */
export function habitMetaToRow(habitName: string, meta: HabitMeta): string[] {
    return [
        habitName,
        meta.description ?? '',
        meta.type === 'number' ? 'number' : 'check',
        meta.target !== undefined && meta.target > 0 ? String(meta.target) : '',
        meta.unit ?? '',
        meta.slot && meta.slot !== 'any' ? meta.slot : '',
        meta.time ?? '',
    ];
}

/** Merges a partial update into existing metadata (missing habit → defaults). */
export function mergeHabitMeta(existing: HabitMeta | undefined, patch: Partial<HabitMeta>): HabitMeta {
    return { ...DEFAULT_HABIT_META, ...(existing ?? {}), ...patch };
}

/** Convenience for components that only show the description. */
export function descriptionsOf(meta: Record<string, HabitMeta> | undefined): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [name, m] of Object.entries(meta ?? {})) out[name] = m.description ?? '';
    return out;
}

/** Targets of quantitative habits, for completion and streak checks. */
export function targetsOf(meta: Record<string, HabitMeta> | undefined): Record<string, number | undefined> {
    const out: Record<string, number | undefined> = {};
    for (const [name, m] of Object.entries(meta ?? {})) if (m.type === 'number') out[name] = m.target;
    return out;
}
