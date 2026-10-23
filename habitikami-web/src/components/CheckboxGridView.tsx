import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Check, X } from 'lucide-react';
import type { HabitCellValue, HabitData, HabitNote } from '../types';
import { noteKey } from '../utils/habitNotes';
import { useTranslation } from '../i18n';
import { translateDay } from '../utils/dayTranslation';
import { useSheetData } from '../hooks/useSheetData';
import { useHabitMeta, useSetHabitMeta, useRenameHabit } from '../hooks/useHabitMutations';
import { habitStreakStats } from '../utils/streaks';
import { descriptionsOf } from '../utils/habitMeta';
import { useHabitStreaks } from '../hooks/useStreaks';
import { StreakBadge } from './ui/StreakBadge';
import { ScrollingText } from './ui/ScrollingText';
import { SlotTag } from './ui/SlotTag';
import { NumericCell } from './ui/NumericCell';
import { HabitMetaEditor, HabitMetaSummary } from './HabitMetaEditor';

interface CheckboxGridViewProps {
    headers: string[];
    data: HabitData[];
    colors: Record<string, string>;
    meta: { startCol: number; headerRowIndex: number; dataStartRow: number } | null;
    dataStartRow: number;
    onToggle: (rowIndex: number, habit: string, currentValue: HabitCellValue) => void;
    onSetValue: (rowIndex: number, habit: string, value: number) => void;
    onOpenNote: (date: string, habit: string) => void;
    /** Reorders habits: header indexes (from → to). */
    onMoveColumn?: (from: number, to: number) => void;
    notes: Record<string, HabitNote>;
    isPending: boolean;
    sheetName: string;
    year: number;
    month: number;
}

export function CheckboxGridView({
    headers,
    data,
    colors,
    onToggle,
    onSetValue,
    onOpenNote,
    notes,
    isPending,
    sheetName,
    year,
    month,
    onMoveColumn,
}: CheckboxGridViewProps) {
    const { t, tArray } = useTranslation();
    const todayColRef = useRef<HTMLDivElement>(null);
    const [selectedHabit, setSelectedHabit] = useState<string | null>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOver, setDragOver] = useState<number | null>(null);

    const { data: habitMeta } = useHabitMeta();
    const { streaks } = useHabitStreaks();
    const metaMap: Record<string, string> = useMemo(() => descriptionsOf(habitMeta), [habitMeta]);
    const setMeta = useSetHabitMeta();
    const renameHabit = useRenameHabit();

    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState('');
    const [editingDesc, setEditingDesc] = useState(false);

    const openHabit = (habit: string) => {
        setSelectedHabit(habit);
        setEditingName(false);
        setNameDraft(habit);
        setEditingDesc(false);
    };

    const closePopup = () => {
        setSelectedHabit(null);
        setEditingName(false);
        setEditingDesc(false);
    };

    const commitRename = () => {
        if (!selectedHabit) return;
        const next = nameDraft.trim();
        setEditingName(false);
        if (!next || next === selectedHabit) return;
        const oldName = selectedHabit;
        renameHabit.mutate(
            { sheetName, oldName, newName: next },
            { onSuccess: () => setSelectedHabit(next) }
        );
    };

    const cancelRename = () => {
        setEditingName(false);
        setNameDraft(selectedHabit || '');
    };

    // Fetch the other sheet (Weekdays↔Weekend) for merged stats
    const otherSheet = sheetName === 'Weekdays' ? 'Weekend' : sheetName === 'Weekend' ? 'Weekdays' : null;
    const { data: otherSheetData } = useSheetData(otherSheet ?? '', year, month);
    const otherData: HabitData[] = otherSheetData?.data ?? [];

    const parseDate = useCallback((dateStr: string) => {
        const parts = dateStr.split(/[-/]/);
        if (parts.length !== 3) return null;
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }, []);

    const isToday = useCallback((dateStr: string) => {
        const date = parseDate(dateStr);
        if (!date) return false;
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    }, [parseDate]);

    useEffect(() => {
        if (data.length > 0 && todayColRef.current) {
            todayColRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [data]);

    const defaultColor = '#6b7280';

    const habitStats = useMemo(() => {
        if (!selectedHabit) return null;

        // Streak rules live in utils/streaks.ts (TRUE/HALF continue, SKIP neutral, FALSE breaks).
        // The other sheet (Weekdays<->Weekend) is merged in when it has the same habit.
        const merged = !!otherSheet && otherData.length > 0 && selectedHabit in (otherData[0]?.habits ?? {});
        const target = habitMeta?.[selectedHabit]?.type === 'number' ? habitMeta[selectedHabit].target : undefined;
        const stats = habitStreakStats(selectedHabit, merged ? [data, otherData] : [data], new Date(), target);
        return { ...stats, merged };
    }, [selectedHabit, data, otherData, otherSheet, habitMeta]);

    return (
        <div className="flex-1 flex overflow-y-auto p-4">
            {/* Fixed left column — habit names */}
            <div className="shrink-0 relative z-10">
                {/* Spacer for day headers row */}
                <div className="h-[20px] md:h-[30px] mb-2" />
                {/* Habit labels */}
                <div className="space-y-1.5">
                    {headers.map((habit, hIndex) => {
                        const color = colors[habit] || defaultColor;
                        return (
                            <div
                                key={habit}
                                className={`flex items-center gap-2 h-6 md:h-8 ${dragIndex === hIndex ? 'opacity-50' : ''} ${dragOver === hIndex && dragIndex !== null && dragIndex !== hIndex ? 'ring-1 ring-primary/60 rounded' : ''}`}
                                draggable={!!onMoveColumn}
                                onDragStart={(e) => { setDragIndex(hIndex); e.dataTransfer.effectAllowed = 'move'; }}
                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOver !== hIndex) setDragOver(hIndex); }}
                                onDragLeave={() => { if (dragOver === hIndex) setDragOver(null); }}
                                onDrop={(e) => { e.preventDefault(); if (dragIndex !== null && dragIndex !== hIndex) onMoveColumn?.(dragIndex, hIndex); setDragIndex(null); setDragOver(null); }}
                                onDragEnd={() => { setDragIndex(null); setDragOver(null); }}
                                title={onMoveColumn ? t('gridDragHint') : undefined}
                            >
                                <button
                                    onClick={() => openHabit(habit)}
                                    className="w-[112px] md:w-[152px] shrink-0 flex items-center gap-2 pr-2 truncate cursor-pointer hover:opacity-80 active:scale-95 transition-all text-left"
                                    title={metaMap[habit]?.trim() ? `${habit} — ${metaMap[habit]}` : habit}
                                >
                                    <div
                                        className="w-3 h-3 rounded-full shrink-0"
                                        style={{ backgroundColor: color }}
                                    />
                                    <ScrollingText text={habit} className="text-xs font-medium flex-1" />
                                    {habitMeta?.[habit] && <SlotTag slot={habitMeta[habit].slot} className="shrink-0" />}
                                    {streaks[habit]?.currentStreak > 0 && (
                                        <StreakBadge streak={streaks[habit].currentStreak} best={streaks[habit].bestStreak} className="ml-auto shrink-0" />
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
                {/* Fade edge */}
                <div className="absolute top-0 right-[-12px] w-3 h-full bg-gradient-to-r from-background to-transparent pointer-events-none" />
            </div>

            {/* Scrollable right column — day squares (7 days fit visible area) */}
            <div className="flex-1 min-w-0 ml-3 md:ml-4 overflow-x-auto">
                {/* Day headers row */}
                <div className="flex items-end gap-1 md:gap-2 mb-2">
                    {data.map((row, colIndex) => {
                        const today = isToday(row.date);
                        const dayShort = translateDay(row.day, tArray('days')).slice(0, 3);
                        const dateParts = row.date.split(/[-/]/);
                        return (
                            <div
                                key={row.date + colIndex}
                                ref={today ? todayColRef : null}
                                className={`shrink-0 w-[calc((100%-24px)/7)] md:w-[calc((100%-48px)/7)] flex flex-col items-center ${today ? 'text-primary font-bold' : 'text-muted-foreground'}`}
                            >
                                <span className="text-[9px] leading-tight hidden md:block">{dayShort}</span>
                                <span className="text-[10px] leading-tight">{dateParts[0]}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Habit square rows */}
                <div className="space-y-1.5">
                    {headers.map((habit) => {
                        const color = colors[habit] || defaultColor;
                        return (
                            <div key={habit} className="flex gap-1 md:gap-2 h-6 md:h-8">
                                {data.map((row, rIndex) => {
                                    const checked = row.habits[habit];
                                    const today = isToday(row.date);

                                    const desc = metaMap[habit]?.trim();
                                    const note = notes[noteKey(row.date, habit)]?.note;
                                    const checkTooltip = `${row.date}: ${checked === true ? '✓' : checked === 'skipped' ? '⏭' : '✗'}${desc ? ` — ${desc}` : ''}${note ? ` — 📝 ${note}` : ''}`;
                                    if (habitMeta?.[habit]?.type === 'number') {
                                        return (
                                            <div key={row.date + rIndex} className={`shrink-0 w-[calc((100%-24px)/7)] md:w-[calc((100%-48px)/7)] h-6 md:h-8 ${today ? 'ring-1 ring-primary ring-offset-1 ring-offset-background rounded-sm' : ''}`}>
                                                <NumericCell
                                                    compact
                                                    value={typeof checked === 'number' ? checked : 0}
                                                    target={habitMeta[habit].target}
                                                    unit={habitMeta[habit].unit}
                                                    color={color}
                                                    disabled={isPending}
                                                    onChange={(v) => onSetValue(rIndex, habit, v)}
                                                />
                                            </div>
                                        );
                                    }
                                    return (
                                        <button
                                            key={row.date + rIndex}
                                            title={checkTooltip}
                                            disabled={isPending}
                                            onClick={() => onToggle(rIndex, habit, checked)}
                                            onContextMenu={(e) => { e.preventDefault(); onOpenNote(row.date, habit); }}
                                            className={`shrink-0 relative w-[calc((100%-24px)/7)] md:w-[calc((100%-48px)/7)] h-6 md:h-8 rounded-sm transition-all duration-150 cursor-pointer hover:scale-110 active:scale-95 disabled:cursor-not-allowed ${today ? 'ring-1 ring-primary ring-offset-1 ring-offset-background' : ''}`}
                                            style={checked === true
                                                ? { backgroundColor: color, boxShadow: `0 0 6px ${color}40` }
                                                : checked === 'skipped'
                                                ? { backgroundColor: 'transparent', border: `2px solid #fbbf2450`, boxShadow: `inset 0 0 4px #fbbf2430` }
                                                : checked === 'half'
                                                ? { background: `linear-gradient(to bottom right, ${color} 50%, transparent 50%)`, border: `2px solid ${color}` }
                                                : { backgroundColor: 'transparent', border: `2px solid ${color}50` }
                                            }
                                        >
                                            {note && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-300 shadow" />}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Habit stats popup */}
            <AnimatePresence>
                {selectedHabit && habitStats && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                        onClick={closePopup}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', duration: 0.3 }}
                            className="bg-card border border-border rounded-xl p-5 w-full max-w-xs shadow-xl max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-4">
                                <div
                                    className="w-4 h-4 rounded-full shrink-0"
                                    style={{ backgroundColor: colors[selectedHabit] || defaultColor }}
                                />
                                <div className="flex-1 min-w-0">
                                    {editingName ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                autoFocus
                                                value={nameDraft}
                                                onChange={(e) => setNameDraft(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') commitRename();
                                                    else if (e.key === 'Escape') cancelRename();
                                                }}
                                                className="bg-background border border-border rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
                                            />
                                            <button
                                                onClick={commitRename}
                                                className="p-1 rounded hover:bg-green-500/20 text-green-500 shrink-0"
                                                aria-label={t('habitRenameSave')}
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={cancelRename}
                                                className="p-1 rounded hover:bg-red-500/20 text-red-500 shrink-0"
                                                aria-label={t('habitInfoCancel')}
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <h3 className="text-base font-semibold break-words flex-1 min-w-0">{selectedHabit}</h3>
                                            <button
                                                onClick={() => { setNameDraft(selectedHabit); setEditingName(true); }}
                                                className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                                title={t('habitTableEditName')}
                                                aria-label={t('habitTableEditName')}
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                    {habitStats.merged && (
                                        <span className="text-[10px] text-muted-foreground">{t('statsMerged')}</span>
                                    )}
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full h-2 bg-secondary rounded-full mb-4 overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${habitStats.percentage}%` }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: colors[selectedHabit] || defaultColor }}
                                />
                            </div>

                            {/* Stats grid */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-secondary/50 rounded-lg p-3 text-center">
                                    <div className="text-lg font-bold" style={{ color: colors[selectedHabit] || defaultColor }}>
                                        {habitStats.percentage}%
                                    </div>
                                    <div className="text-muted-foreground text-xs">{t('statsCompletion')}</div>
                                </div>
                                <div className="bg-secondary/50 rounded-lg p-3 text-center">
                                    <div className="text-lg font-bold">
                                        {habitStats.completed}/{habitStats.total}
                                    </div>
                                    <div className="text-muted-foreground text-xs">{t('statsDays')}</div>
                                </div>
                                <div className="bg-secondary/50 rounded-lg p-3 text-center">
                                    <div className="text-lg font-bold" style={{ color: colors[selectedHabit] || defaultColor }}>
                                        {habitStats.currentStreak}
                                    </div>
                                    <div className="text-muted-foreground text-xs">{t('statsCurrentStreak')}</div>
                                </div>
                                <div className="bg-secondary/50 rounded-lg p-3 text-center">
                                    <div className="text-lg font-bold">
                                        {habitStats.bestStreak}
                                    </div>
                                    <div className="text-muted-foreground text-xs">{t('statsBestStreak')}</div>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mt-4">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs text-muted-foreground">{t('habitInfoDescriptionLabel')}</p>
                                    {!editingDesc && (
                                        <button
                                            onClick={() => setEditingDesc(true)}
                                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                        >
                                            <Pencil className="w-3 h-3" /> {t('habitInfoEdit')}
                                        </button>
                                    )}
                                </div>
                                {editingDesc ? (
                                    <HabitMetaEditor
                                        meta={habitMeta?.[selectedHabit]}
                                        saving={setMeta.isPending}
                                        onCancel={() => setEditingDesc(false)}
                                        onSave={(patch) => setMeta.mutate({ habitName: selectedHabit, ...patch }, { onSuccess: () => setEditingDesc(false) })}
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <div className="text-sm whitespace-pre-wrap break-words text-foreground/90 bg-secondary/30 rounded-md p-3 border border-border/50 min-h-[60px]">
                                            {metaMap[selectedHabit]?.trim() || (
                                                <span className="text-muted-foreground italic text-xs">{t('habitInfoEmpty')}</span>
                                            )}
                                        </div>
                                        <HabitMetaSummary meta={habitMeta?.[selectedHabit]} />
                                    </div>
                                )}
                            </div>

                            {/* Close button */}
                            <button
                                onClick={closePopup}
                                className="mt-4 w-full py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors"
                            >
                                {t('close')}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
