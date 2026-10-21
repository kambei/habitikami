import { useState } from 'react';
import { useTranslation } from '../i18n';
import type { HabitMeta, HabitSlot, HabitType } from '../types';
import { DEFAULT_HABIT_META, HABIT_SLOTS } from '../utils/habitMeta';
import { SlotIcon } from './ui/SlotTag';
import { slotLabelKey } from '../utils/slots';

interface Props {
    /** Current metadata (defaults when the habit has none yet). */
    meta: HabitMeta | undefined;
    onSave: (patch: Partial<HabitMeta>) => void;
    onCancel: () => void;
    saving?: boolean;
    /** Hide the description field (used by the add-habit modal). */
    withDescription?: boolean;
}

const inputClass = 'w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

/**
 * Form for the per-habit metadata: description, type (check or number with
 * target and unit), time slot and optional reminder time. Shared by the
 * table popup, the grid popup and the add-habit modal.
 */
export function HabitMetaEditor({ meta, onSave, onCancel, saving = false, withDescription = true }: Props) {
    const { t } = useTranslation();
    const base = meta ?? DEFAULT_HABIT_META;
    const [description, setDescription] = useState(base.description);
    const [type, setType] = useState<HabitType>(base.type);
    const [target, setTarget] = useState(base.target !== undefined ? String(base.target) : '');
    const [unit, setUnit] = useState(base.unit ?? '');
    const [slot, setSlot] = useState<HabitSlot>(base.slot);
    const [time, setTime] = useState(base.time ?? '');

    // Reset the form when another habit's metadata comes in (derive-from-props pattern)
    const [syncedBase, setSyncedBase] = useState(base);
    if (syncedBase !== base) {
        setSyncedBase(base);
        setDescription(base.description);
        setType(base.type);
        setTarget(base.target !== undefined ? String(base.target) : '');
        setUnit(base.unit ?? '');
        setSlot(base.slot);
        setTime(base.time ?? '');
    }

    const parsedTarget = Number.parseFloat(target.replace(',', '.'));
    const targetValid = type !== 'number' || (Number.isFinite(parsedTarget) && parsedTarget > 0);

    const save = () => {
        if (!targetValid) return;
        onSave({
            description: description.trim(),
            type,
            target: type === 'number' ? parsedTarget : undefined,
            unit: type === 'number' && unit.trim() ? unit.trim() : undefined,
            slot,
            time: time || undefined,
        });
    };

    return (
        <div className="space-y-3 text-left">
            {withDescription && (
                <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('habitInfoDescriptionLabel')}</p>
                    <textarea
                        autoFocus
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('habitInfoDescriptionPlaceholder')}
                        rows={3}
                        className={`${inputClass} resize-none`}
                    />
                </div>
            )}

            <div>
                <p className="text-xs text-muted-foreground mb-1">{t('habitMetaType')}</p>
                <div className="grid grid-cols-2 gap-2">
                    {(['check', 'number'] as HabitType[]).map(opt => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => setType(opt)}
                            className={`rounded-md border px-2 py-1.5 text-sm transition-colors ${type === opt ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:bg-secondary/50'}`}
                        >
                            {opt === 'check' ? t('habitMetaTypeCheck') : t('habitMetaTypeNumber')}
                        </button>
                    ))}
                </div>
            </div>

            {type === 'number' && (
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('habitMetaTarget')}</p>
                        <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="any"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            placeholder="8"
                            className={`${inputClass} ${!targetValid ? 'border-red-500/60' : ''}`}
                        />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('habitMetaUnit')}</p>
                        <input
                            type="text"
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                            placeholder={t('habitMetaUnitPlaceholder')}
                            className={inputClass}
                            maxLength={20}
                        />
                    </div>
                </div>
            )}

            <div>
                <p className="text-xs text-muted-foreground mb-1">{t('habitMetaSlot')}</p>
                <div className="grid grid-cols-4 gap-1.5">
                    {HABIT_SLOTS.map(opt => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => setSlot(opt)}
                            title={t(slotLabelKey(opt))}
                            className={`rounded-md border px-1 py-1.5 text-xs flex flex-col items-center gap-0.5 transition-colors ${slot === opt ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:bg-secondary/50'}`}
                        >
                            <SlotIcon slot={opt} className="w-4 h-4" />
                            <span className="truncate max-w-full">{t(slotLabelKey(opt))}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <p className="text-xs text-muted-foreground mb-1">{t('habitMetaTime')}</p>
                <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className={inputClass}
                />
                <p className="text-[10px] text-muted-foreground mt-1">{t('habitMetaTimeHint')}</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors"
                >
                    {t('habitInfoCancel')}
                </button>
                <button
                    type="button"
                    onClick={save}
                    disabled={saving || !targetValid}
                    className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-60"
                >
                    {t('habitInfoSave')}
                </button>
            </div>
        </div>
    );
}

/** Read-only summary line of a habit's metadata (type, target, slot, time). */
export function HabitMetaSummary({ meta }: { meta: HabitMeta | undefined }) {
    const { t } = useTranslation();
    if (!meta) return null;
    const parts: string[] = [];
    if (meta.type === 'number') parts.push(`${t('habitMetaTypeNumber')}: ${meta.target ?? '?'}${meta.unit ? ` ${meta.unit}` : ''}`);
    if (meta.slot && meta.slot !== 'any') parts.push(t(slotLabelKey(meta.slot)));
    if (meta.time) parts.push(meta.time);
    if (parts.length === 0) return null;
    return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {meta.slot && meta.slot !== 'any' && <SlotIcon slot={meta.slot} className="w-3.5 h-3.5" />}
            <span>{parts.join(' · ')}</span>
        </div>
    );
}
