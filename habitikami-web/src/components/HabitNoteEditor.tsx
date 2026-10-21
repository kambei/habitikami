import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { StickyNote, Trash2 } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useSetHabitNote } from '../hooks/useHabitNotes';

interface Props {
    target: { date: string; habit: string } | null;
    initialNote: string;
    color?: string;
    onClose: () => void;
}

/** Modal to write, change or delete the note of one habit on one day. */
export function HabitNoteEditor({ target, initialNote, color, onClose }: Props) {
    const { t } = useTranslation();
    const setNote = useSetHabitNote();
    const [draft, setDraft] = useState(initialNote);
    const [syncedKey, setSyncedKey] = useState(target ? `${target.date}|${target.habit}` : '');
    const key = target ? `${target.date}|${target.habit}` : '';
    if (key !== syncedKey) {
        setSyncedKey(key);
        setDraft(initialNote);
    }

    const save = (note: string) => {
        if (!target) return;
        setNote.mutate({ ...target, note }, { onSuccess: onClose });
    };

    return (
        <AnimatePresence>
            {target && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: 'spring', duration: 0.3 }}
                        className="bg-card border border-border rounded-xl p-5 w-full max-w-sm shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <StickyNote className="w-4 h-4 shrink-0" style={{ color }} />
                            <h3 className="text-base font-semibold break-words flex-1">{target.habit}</h3>
                            <span className="text-xs text-muted-foreground tabular-nums">{target.date}</span>
                        </div>
                        <textarea
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder={t('habitNotePlaceholder')}
                            rows={5}
                            className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                        />
                        <div className="flex items-center justify-between gap-2 mt-3">
                            {initialNote ? (
                                <button
                                    type="button"
                                    onClick={() => save('')}
                                    disabled={setNote.isPending}
                                    className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-60"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> {t('habitNoteDelete')}
                                </button>
                            ) : <span />}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors"
                                >
                                    {t('habitInfoCancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => save(draft)}
                                    disabled={setNote.isPending || draft.trim() === initialNote.trim()}
                                    className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-60"
                                >
                                    {t('habitInfoSave')}
                                </button>
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2">{t('habitNoteHint')}</p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
