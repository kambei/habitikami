import { describe, expect, it } from 'vitest';
import { DEFAULT_HABIT_META, descriptionsOf, habitMetaToRow, mergeHabitMeta, rowToHabitMeta, targetsOf } from '../src/utils/habitMeta';

describe('rowToHabitMeta', () => {
    it('reads a legacy two-column row with defaults', () => {
        expect(rowToHabitMeta(['Read', 'Ten pages'])).toEqual({
            description: 'Ten pages', type: 'check', target: undefined, unit: undefined, slot: 'any', time: undefined,
        });
    });

    it('reads the full row', () => {
        expect(rowToHabitMeta(['Water', 'Hydration', 'number', '8', 'glasses', 'morning', '07:30'])).toEqual({
            description: 'Hydration', type: 'number', target: 8, unit: 'glasses', slot: 'morning', time: '07:30',
        });
    });

    it('falls back on invalid values', () => {
        const m = rowToHabitMeta(['X', '', 'weird', '-3', '', 'night', '25:99']);
        expect(m.type).toBe('check');
        expect(m.target).toBeUndefined();
        expect(m.slot).toBe('any');
        expect(m.time).toBeUndefined();
    });

    it('accepts a decimal target with a comma', () => {
        expect(rowToHabitMeta(['Run', '', 'number', '2,5', 'km']).target).toBe(2.5);
    });
});

describe('habitMetaToRow / mergeHabitMeta', () => {
    it('round-trips through a row', () => {
        const meta = { description: 'Hydration', type: 'number' as const, target: 8, unit: 'glasses', slot: 'evening' as const, time: '21:00' };
        expect(rowToHabitMeta(habitMetaToRow('Water', meta))).toEqual(meta);
    });

    it('writes empty cells for defaults', () => {
        expect(habitMetaToRow('Read', DEFAULT_HABIT_META)).toEqual(['Read', '', 'check', '', '', '', '']);
    });

    it('merges a patch over existing values and defaults', () => {
        const merged = mergeHabitMeta({ ...DEFAULT_HABIT_META, description: 'old' }, { type: 'number', target: 5 });
        expect(merged).toEqual({ description: 'old', type: 'number', target: 5, slot: 'any' });
        expect(mergeHabitMeta(undefined, { description: 'new' }).slot).toBe('any');
    });

    it('descriptionsOf and targetsOf project the map', () => {
        const map = {
            Read: { ...DEFAULT_HABIT_META, description: 'Ten pages' },
            Water: { ...DEFAULT_HABIT_META, type: 'number' as const, target: 8 },
        };
        expect(descriptionsOf(map)).toEqual({ Read: 'Ten pages', Water: '' });
        expect(targetsOf(map)).toEqual({ Water: 8 });
    });
});
