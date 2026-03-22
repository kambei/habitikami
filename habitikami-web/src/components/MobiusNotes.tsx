
import { useState, useEffect, useRef } from 'react';
import { habitService } from '../services/HabitService';
import type { NoteData } from '../types';
import { MobiusRing } from './MobiusRing';
import { useTranslation } from '../i18n';

export function MobiusNotes() {
    const { t } = useTranslation();
    const [notes, setNotes] = useState<NoteData[]>([]);
    const [focusDate, setFocusDate] = useState<string>(new Date().toLocaleDateString('en-GB')); // DD/MM/YYYY

    // Secondary view state
    const [linkedMode, setLinkedMode] = useState<{ active: boolean; sourceDate: string; linkedDates: string[]; focusIndex: number }>({
        active: false,
        sourceDate: '',
        linkedDates: [],
        focusIndex: 0
    });

    const loadNotes = async () => {
        const res = await habitService.getNotes();
        if ('error' in res) {
            console.error(res.error);
        } else {
            setNotes(res);
        }
    };

    useEffect(() => {
        loadNotes();
    }, []);

    // Helper to get days
    const getDaysAround = (centerDateStr: string, count: number) => {
        const parse = (s: string) => {
            const p = s.split('/');
            return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
        };
        const format = (d: Date) => {
            const pad = (n: number) => n < 10 ? '0' + n : n;
            return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
        };

        let center = parse(centerDateStr);
        if (isNaN(center.getTime())) center = new Date(); // fallback

        const days = [];
        for (let i = -count; i <= count; i++) {
            const d = new Date(center);
            d.setDate(center.getDate() + i);
            const dateStr = format(d);
            const note = notes.find(n => n.date === dateStr) || { date: dateStr, content: '', links: [] };
            days.push({ ...note, offset: i });
        }
        return days;
    };

    // Helper for Linked View (non-contiguous dates)
    const getLinkedDays = () => {
        if (!linkedMode.active || linkedMode.linkedDates.length === 0) return [];

        return linkedMode.linkedDates.map((dateStr, index) => {
            const offset = index - linkedMode.focusIndex;
            const note = notes.find(n => n.date === dateStr) || { date: dateStr, content: '', links: [] };
            return { ...note, offset };
        }).filter(d => Math.abs(d.offset) <= 5);
    };

    const handleMainWheel = (e: React.WheelEvent) => {
        const delta = e.deltaY > 0 ? 1 : -1;
        const parse = (s: string) => {
            const p = s.split('/');
            return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
        };
        const center = parse(focusDate);
        if (isNaN(center.getTime())) return;
        center.setDate(center.getDate() + delta);

        const pad = (n: number) => n < 10 ? '0' + n : n;
        const newDate = `${pad(center.getDate())}/${pad(center.getMonth() + 1)}/${center.getFullYear()}`;
        setFocusDate(newDate);

        if (linkedMode.active && newDate !== linkedMode.sourceDate) {
            setLinkedMode(prev => ({ ...prev, active: false }));
        }
    };

    const handleLinkedWheel = (e: React.WheelEvent) => {
        const delta = e.deltaY > 0 ? 1 : -1;
        setLinkedMode(prev => {
            let nextIndex = prev.focusIndex + delta;
            if (nextIndex < 0) nextIndex = 0;
            if (nextIndex >= prev.linkedDates.length) nextIndex = prev.linkedDates.length - 1;
            return { ...prev, focusIndex: nextIndex };
        });
    };

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Save logic with debounce
    const handleSave = (date: string, content: string, links: string[]) => {
        setNotes(prev => {
            const exist = prev.find(n => n.date === date);
            if (exist) {
                return prev.map(n => n.date === date ? { ...n, content, links } : n);
            } else {
                return [...prev, { date, content, links }];
            }
        });

        setSaveStatus('saving');

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            const res = await habitService.saveNote(date, content, links);
            if (res && 'error' in res) {
                console.error("Save failed caught in UI:", res.error);
                setSaveStatus('error');
            } else {
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            }
        }, 1500);
    };


    const [linkPicker, setLinkPicker] = useState<{ isOpen: boolean; cardDate: string | null }>({ isOpen: false, cardDate: null });
    const [selectedDate, setSelectedDate] = useState<string>('');

    const openLinkPicker = (date: string) => {
        setLinkPicker({ isOpen: true, cardDate: date });
        setSelectedDate('');
    };

    const handleAddLink = () => {
        if (!selectedDate || !linkPicker.cardDate) return;

        // Convert YYYY-MM-DD to DD/MM/YYYY
        const [y, m, d] = selectedDate.split('-');
        const formattedDate = `${d}/${m}/${y}`;

        const card = notes.find(n => n.date === linkPicker.cardDate);
        const currentLinks = card ? card.links : [];
        const newLinks = [...currentLinks, formattedDate];

        const content = card ? card.content : "";
        handleSave(linkPicker.cardDate, content, newLinks);

        setLinkPicker({ isOpen: false, cardDate: null });
    };

    return (
        <div className="flex-1 overflow-hidden relative perspective-1000 bg-gradient-to-b from-slate-900 to-black text-white flex flex-col items-center justify-center h-full">
            <h2 className="absolute top-4 text-xl font-bold text-white/50 z-10">{t('mobiusTitle')}</h2>
            <div className="absolute top-10 z-10 flex flex-col items-center gap-1">
                <div className="text-sm text-white/30">{t('mobiusHint')}</div>
                {saveStatus === 'saving' && <span className="text-xs text-yellow-500 animate-pulse">{t('mobiusSaving')}</span>}
                {saveStatus === 'saved' && <span className="text-xs text-green-500">{t('mobiusSaved')}</span>}
                {saveStatus === 'error' && <span className="text-xs text-red-500">{t('mobiusError')}</span>}
            </div>

            <div className="flex w-full h-full items-center justify-center gap-8 px-8">
                {/* Main Ring */}
                <MobiusRing
                    days={getDaysAround(focusDate, 5)}
                    onWheel={handleMainWheel}
                    onSave={handleSave}
                    onSetFocus={setFocusDate}
                    onOpenLinkPicker={openLinkPicker}
                    onShowLinks={(links) => setLinkedMode({
                        active: true,
                        sourceDate: focusDate,
                        linkedDates: links,
                        focusIndex: 0
                    })}
                />

                {/* Linked Ring */}
                {linkedMode.active && (
                    <div className="relative border-l border-white/10 pl-8 animate-in fade-in slide-in-from-right duration-500">
                        <div className="absolute -top-10 left-10 text-sm text-purple-400 font-bold uppercase tracking-wider">
                            {t('mobiusLinkedTo')} {linkedMode.sourceDate}
                        </div>
                        <button
                            className="absolute -top-10 right-0 text-white/50 hover:text-white"
                            onClick={() => setLinkedMode(prev => ({ ...prev, active: false }))}
                        >
                            ✕
                        </button>
                        <MobiusRing
                            days={getLinkedDays()}
                            onWheel={handleLinkedWheel}
                            onSave={handleSave}
                            onSetFocus={setFocusDate}
                            onOpenLinkPicker={openLinkPicker}
                            readOnly={false}
                        />
                    </div>
                )}
            </div>

            {/* Link Picker Modal */}
            {linkPicker.isOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-card border border-border p-4 rounded-xl shadow-2xl w-80 text-center animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold mb-4">{t('mobiusLinkDate')}</h3>
                        <input
                            type="date"
                            className="w-full bg-secondary/50 border border-white/10 rounded p-2 mb-4 text-white color-scheme-dark"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setLinkPicker({ isOpen: false, cardDate: null })}
                                className="px-3 py-1.5 text-sm rounded bg-secondary hover:bg-secondary/80"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleAddLink}
                                disabled={!selectedDate}
                                className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                                {t('mobiusAddLink')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
