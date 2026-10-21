import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from '../i18n';
import { habitService } from '../services/HabitService';
import { HABIT_TEMPLATES, type HabitTemplate, type TemplateHabit } from '../data/habitTemplates';
import { SlotIcon } from './ui/SlotTag';

type TargetSheet = 'Weekdays' | 'Weekend' | 'both';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    /** Habits already present per sheet, to skip duplicates. */
    existing?: Partial<Record<'Weekdays' | 'Weekend', string[]>>;
    defaultSheet?: TargetSheet;
}

/**
 * Picks a ready-made habit pack and adds the selected habits (name, colour,
 * description, type, goal and time slot) to Weekdays, Weekend or both.
 */
export function HabitTemplatesPicker({ isOpen, onClose, existing = {}, defaultSheet = 'both' }: Props) {
    const { t, language } = useTranslation();
    const queryClient = useQueryClient();
    const [template, setTemplate] = useState<HabitTemplate | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [sheet, setSheet] = useState<TargetSheet>(defaultSheet);
    const [applying, setApplying] = useState(false);
    const lang = language === 'it' ? 'it' : 'en';

    const pick = (tpl: HabitTemplate) => {
        setTemplate(tpl);
        setSelected(new Set(tpl.habits.map(h => h.name[lang])));
    };

    const toggle = (name: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    };

    const close = () => { setTemplate(null); onClose(); };

    const apply = async () => {
        if (!template) return;
        const sheets: ('Weekdays' | 'Weekend')[] = sheet === 'both' ? ['Weekdays', 'Weekend'] : [sheet];
        const habits = template.habits.filter(h => selected.has(h.name[lang]));
        setApplying(true);
        let added = 0;
        let skipped = 0;
        try {
            for (const habit of habits) {
                const name = habit.name[lang];
                let addedSomewhere = false;
                for (const target of sheets) {
                    if ((existing[target] ?? []).includes(name)) { skipped++; continue; }
                    const res = await habitService.addHabit(target, name);
                    if ('error' in res) throw new Error(res.error);
                    await habitService.setHabitColor(target, name, habit.color);
                    addedSomewhere = true;
                }
                if (addedSomewhere) {
                    await habitService.setHabitMeta(name, templateMeta(habit, lang));
                    added++;
                }
            }
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['sheetData'] }),
                queryClient.invalidateQueries({ queryKey: ['habitMeta'] }),
                queryClient.invalidateQueries({ queryKey: ['habitColors'] }),
            ]);
            toast.success(t('templatesApplied').replace('{added}', String(added)).replace('{skipped}', String(skipped)));
            close();
        } catch (e) {
            toast.error(t('templatesFailed').replace('{error}', e instanceof Error ? e.message : t('toastUnknownError')));
        } finally {
            setApplying(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    onClick={close}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-card text-card-foreground border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button onClick={close} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground" aria-label={t('close')}>
                            <X size={18} />
                        </button>
                        <h2 className="text-lg font-bold mb-1">{t('templatesTitle')}</h2>
                        <p className="text-xs text-muted-foreground mb-4">{t('templatesSubtitle')}</p>

                        {!template ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {HABIT_TEMPLATES.map(tpl => (
                                    <button
                                        key={tpl.id}
                                        type="button"
                                        onClick={() => pick(tpl)}
                                        className="text-left rounded-lg border border-border hover:border-primary/60 hover:bg-primary/5 p-3 transition-colors"
                                    >
                                        <div className="text-2xl mb-1">{tpl.icon}</div>
                                        <div className="font-semibold">{tpl.title[lang]}</div>
                                        <div className="text-xs text-muted-foreground">{tpl.subtitle[lang]}</div>
                                        <div className="text-[10px] text-muted-foreground mt-2">{tpl.habits.map(h => h.name[lang]).join(' · ')}</div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <button type="button" onClick={() => setTemplate(null)} className="text-xs text-primary hover:underline">← {t('templatesBack')}</button>
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">{template.icon}</span>
                                    <div>
                                        <div className="font-semibold">{template.title[lang]}</div>
                                        <div className="text-xs text-muted-foreground">{template.subtitle[lang]}</div>
                                    </div>
                                </div>

                                <ul className="space-y-2">
                                    {template.habits.map(h => {
                                        const name = h.name[lang];
                                        const on = selected.has(name);
                                        return (
                                            <li key={name}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggle(name)}
                                                    className={`w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${on ? 'border-primary/60 bg-primary/5' : 'border-border opacity-70'}`}
                                                >
                                                    <span className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                                                        {on && <Check className="w-3.5 h-3.5" />}
                                                    </span>
                                                    <span className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: h.color }} />
                                                    <span className="flex-1 min-w-0">
                                                        <span className="font-medium text-sm flex items-center gap-2">
                                                            {name}
                                                            <SlotIcon slot={h.slot} className="w-3.5 h-3.5 text-muted-foreground" />
                                                            {h.type === 'number' && <span className="text-[10px] text-muted-foreground">{h.target}{h.unit ? ` ${h.unit[lang]}` : ''}</span>}
                                                        </span>
                                                        <span className="block text-xs text-muted-foreground">{h.description[lang]}</span>
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>

                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">{t('templatesSheet')}</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['Weekdays', 'Weekend', 'both'] as TargetSheet[]).map(opt => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setSheet(opt)}
                                                className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${sheet === opt ? 'border-primary bg-primary/15' : 'border-border text-muted-foreground hover:bg-secondary/50'}`}
                                            >
                                                {opt === 'Weekdays' ? t('tabWeekdays') : opt === 'Weekend' ? t('tabWeekend') : t('templatesBoth')}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <button type="button" onClick={close} className="px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-sm font-medium">{t('cancel')}</button>
                                    <button
                                        type="button"
                                        onClick={apply}
                                        disabled={applying || selected.size === 0}
                                        className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60"
                                    >
                                        {applying && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {t('templatesApply').replace('{count}', String(selected.size))}
                                    </button>
                                </div>
                                <p className="text-[10px] text-muted-foreground">{t('templatesHint')}</p>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function templateMeta(habit: TemplateHabit, lang: 'en' | 'it') {
    return {
        description: habit.description[lang],
        type: habit.type,
        target: habit.type === 'number' ? habit.target : undefined,
        unit: habit.type === 'number' && habit.unit ? habit.unit[lang] : undefined,
        slot: habit.slot,
    };
}
