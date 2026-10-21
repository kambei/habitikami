import { Sunrise, Sun, Moon, Clock } from 'lucide-react';
import type { HabitSlot } from '../../types';
import { useTranslation } from '../../i18n';
import { slotLabelKey } from '../../utils/slots';

import { cn } from '../../lib/utils';

export function SlotIcon({ slot, className }: { slot: HabitSlot; className?: string }) {
    switch (slot) {
        case 'morning': return <Sunrise className={className} />;
        case 'afternoon': return <Sun className={className} />;
        case 'evening': return <Moon className={className} />;
        default: return <Clock className={className} />;
    }
}

const SLOT_CLASSES: Record<HabitSlot, string> = {
    any: 'text-muted-foreground bg-muted/40',
    morning: 'text-amber-300 bg-amber-500/15',
    afternoon: 'text-sky-300 bg-sky-500/15',
    evening: 'text-indigo-300 bg-indigo-500/15',
};

/** Small chip with the slot icon (and optional label/time). */
export function SlotTag({ slot, time, withLabel = false, className }: { slot: HabitSlot; time?: string; withLabel?: boolean; className?: string }) {
    const { t } = useTranslation();
    if (slot === 'any' && !time) return null;
    return (
        <span
            title={`${t(slotLabelKey(slot))}${time ? ` · ${time}` : ''}`}
            className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] leading-none', SLOT_CLASSES[slot], className)}
        >
            <SlotIcon slot={slot} className="w-3 h-3" />
            {withLabel && <span>{t(slotLabelKey(slot))}</span>}
            {time && <span className="tabular-nums">{time}</span>}
        </span>
    );
}
