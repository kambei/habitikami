import type { HabitSlot } from '../types';
import type { TranslationKey } from '../i18n';

export function slotLabelKey(slot: HabitSlot): TranslationKey {
    switch (slot) {
        case 'morning': return 'slotMorning';
        case 'afternoon': return 'slotAfternoon';
        case 'evening': return 'slotEvening';
        default: return 'slotAny';
    }
}


/** Local hour → slot, used to pick "now" in Focus. */
export function currentSlot(date: Date = new Date()): Exclude<HabitSlot, 'any'> {
    const h = date.getHours();
    if (h < 12) return 'morning';
    if (h < 18) return 'afternoon';
    return 'evening';
}
