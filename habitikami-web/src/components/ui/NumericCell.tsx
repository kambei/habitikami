import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
    value: number;
    target?: number;
    unit?: string;
    color?: string;
    disabled?: boolean;
    /** Compact variant for grid cells: progress only, tap to step. */
    compact?: boolean;
    onChange: (value: number) => void;
}

function stepFor(target?: number): number {
    if (!target) return 1;
    if (target <= 2) return 0.25;
    if (target <= 10) return 1;
    return Math.max(1, Math.round(target / 10));
}

/**
 * Cell of a quantitative habit: shows value/target with a progress bar and
 * lets the user step with +/- or type a value.
 */
export function NumericCell({ value, target, unit, color = '#6b7280', disabled = false, compact = false, onChange }: Props) {
    const [draft, setDraft] = useState(String(value));
    // Resync the input when the stored value changes (derive-from-props pattern)
    const [syncedValue, setSyncedValue] = useState(value);
    if (syncedValue !== value) {
        setSyncedValue(value);
        setDraft(String(value));
    }

    const step = stepFor(target);
    const ratio = target ? Math.min(1, value / target) : (value > 0 ? 1 : 0);
    const done = target ? value >= target : value > 0;
    const round = (n: number) => Math.max(0, Math.round(n * 100) / 100);

    const commit = () => {
        const n = Number.parseFloat(draft.replace(',', '.'));
        if (Number.isFinite(n) && n !== value) onChange(round(n));
        else setDraft(String(value));
    };

    if (compact) {
        return (
            <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(round(value + step))}
                onContextMenu={(e) => { e.preventDefault(); onChange(round(value - step)); }}
                title={`${value}${target ? ` / ${target}` : ''}${unit ? ` ${unit}` : ''}`}
                className="relative w-full h-full rounded-sm overflow-hidden border-2 text-[9px] font-semibold tabular-nums text-foreground/90 disabled:cursor-not-allowed"
                style={{ borderColor: `${color}${done ? '' : '50'}` }}
            >
                <span className="absolute inset-x-0 bottom-0" style={{ height: `${ratio * 100}%`, backgroundColor: color, opacity: done ? 1 : 0.55 }} />
                <span className="relative">{value}</span>
            </button>
        );
    }

    return (
        <div className="inline-flex flex-col items-center gap-1 min-w-[96px]">
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    disabled={disabled || value <= 0}
                    onClick={() => onChange(round(value - step))}
                    className="w-6 h-6 rounded-md bg-secondary hover:bg-secondary/80 flex items-center justify-center disabled:opacity-40"
                    aria-label="-"
                >
                    <Minus className="w-3 h-3" />
                </button>
                <input
                    type="text"
                    inputMode="decimal"
                    value={draft}
                    disabled={disabled}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className={cn('w-12 text-center text-sm font-semibold tabular-nums bg-transparent border-b border-border focus:outline-none focus:border-primary', done && 'text-emerald-400')}
                />
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(round(value + step))}
                    className="w-6 h-6 rounded-md bg-secondary hover:bg-secondary/80 flex items-center justify-center disabled:opacity-40"
                    aria-label="+"
                >
                    <Plus className="w-3 h-3" />
                </button>
            </div>
            <div className="w-full h-1 rounded-full bg-muted/50 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${ratio * 100}%`, backgroundColor: color }} />
            </div>
            {(target || unit) && (
                <span className="text-[10px] text-muted-foreground tabular-nums">
                    {target ? `/ ${target}` : ''}{unit ? ` ${unit}` : ''}
                </span>
            )}
        </div>
    );
}
