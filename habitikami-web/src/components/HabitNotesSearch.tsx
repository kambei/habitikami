import { useMemo, useState } from 'react';
import { Search, StickyNote } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useHabitNotes } from '../hooks/useHabitNotes';
import { searchHabitNotes } from '../utils/habitNotes';
import { HabitNoteEditor } from './HabitNoteEditor';

/** Searchable list of the per-habit notes; tapping a note opens it for editing. */
export function HabitNotesSearch() {
    const { t } = useTranslation();
    const { data: notes } = useHabitNotes();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState<{ date: string; habit: string } | null>(null);
    const results = useMemo(() => searchHabitNotes(Object.values(notes ?? {}), query), [notes, query]);
    const total = Object.keys(notes ?? {}).length;

    return (
        <div className="w-full max-w-xl mx-auto px-4">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-white/40 shrink-0" />
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('habitNotesSearchPlaceholder')}
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                />
                <span className="text-[10px] text-white/30 tabular-nums">{results.length}/{total}</span>
            </div>
            {(query || results.length > 0) && (
                <ul className="mt-2 max-h-48 overflow-y-auto divide-y divide-white/5 rounded-lg border border-white/10 bg-black/30">
                    {results.length === 0 && <li className="p-3 text-xs text-white/40">{t('habitNotesEmpty')}</li>}
                    {results.slice(0, 50).map(n => (
                        <li key={`${n.date}|${n.habit}`}>
                            <button
                                type="button"
                                onClick={() => setOpen({ date: n.date, habit: n.habit })}
                                className="w-full text-left p-3 hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-2 text-xs text-white/50">
                                    <StickyNote className="w-3 h-3" />
                                    <span className="font-medium text-white/80">{n.habit}</span>
                                    <span className="tabular-nums">{n.date}</span>
                                </div>
                                <p className="text-sm text-white/80 mt-0.5 line-clamp-2">{n.note}</p>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <HabitNoteEditor
                target={open}
                initialNote={open ? (notes?.[`${open.date}|${open.habit}`]?.note ?? '') : ''}
                onClose={() => setOpen(null)}
            />
        </div>
    );
}
