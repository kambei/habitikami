import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, SkipForward, RefreshCw, Trophy, Calendar } from 'lucide-react';
import type { HabitCellValue, SheetType } from '../types';
import { useTranslation } from '../i18n';
import { useSheetData } from '../hooks/useSheetData';
import { useUpdateCell } from '../hooks/useHabitMutations';
import { useHabitStreaks } from '../hooks/useStreaks';
import { StreakBadge } from './ui/StreakBadge';
import { MilestoneCelebration } from './MilestoneCelebration';
import { useHabitMeta } from '../hooks/useHabitMutations';
import { countsAsDone } from '../utils/streaks';
import { NumericCell } from './ui/NumericCell';
import { SlotTag } from './ui/SlotTag';
import { currentSlot, slotLabelKey } from '../utils/slots';
import type { HabitSlot } from '../types';

interface CompactHabitViewProps {
    refreshKey?: number;
}

export function CompactHabitView({ }: CompactHabitViewProps) {
    const { t } = useTranslation();
    const [currentIndex, setCurrentIndex] = useState(0);
    const { streaks } = useHabitStreaks();
    const { data: habitMeta } = useHabitMeta();
    // Habits of the current time slot first; 'all' shows every pending habit
    const [slotFilter, setSlotFilter] = useState<'now' | 'all'>('now');

    const now = new Date();
    const day = now.getDay();
    const isWeekend = day === 0 || day === 6;
    const sheetName: SheetType = isWeekend ? 'Weekend' : 'Weekdays';
    const year = now.getFullYear();
    const month = now.getMonth();

    const pad = (n: number) => n < 10 ? '0' + n : n;
    const todayStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    const { data: sheetData, isLoading: loading, refetch } = useSheetData(sheetName, year, month);
    const updateCellMutation = useUpdateCell();

    const { habits, completedCount, meta, todayValues, hiddenBySlot, hasSlots } = useMemo(() => {
        const empty = { habits: [] as string[], completedCount: 0, meta: null, todayValues: {} as Record<string, HabitCellValue>, hiddenBySlot: 0, hasSlots: false };
        if (!sheetData) return empty;

        const todayRowIndex = sheetData.data.findIndex(d => d.date === todayStr);
        if (todayRowIndex === -1) return empty;

        const todayData = sheetData.data[todayRowIndex];
        const slotOf = (h: string): HabitSlot => habitMeta?.[h]?.slot ?? 'any';
        const isPending = (h: string) => {
            const v = todayData.habits[h];
            if (v === 'skipped') return false;
            if (habitMeta?.[h]?.type === 'number') return !countsAsDone(v, habitMeta[h].target);
            return v === false;
        };
        const pending = sheetData.headers.filter(isPending);
        const now = currentSlot();
        const hasSlots = sheetData.headers.some(h => slotOf(h) !== 'any');
        // Current slot first, then "any time", then the other slots
        const rank = (h: string) => (slotOf(h) === now ? 0 : slotOf(h) === 'any' ? 1 : 2);
        const ordered = [...pending].sort((a, b) => rank(a) - rank(b));
        const visible = slotFilter === 'now' && hasSlots ? ordered.filter(h => rank(h) < 2) : ordered;

        return {
            habits: visible,
            completedCount: sheetData.headers.length - pending.length,
            todayValues: todayData.habits,
            hiddenBySlot: ordered.length - visible.length,
            hasSlots,
            meta: {
                ...sheetData.meta,
                headers: sheetData.headers,
                rowHeight: todayRowIndex
            }
        };
    }, [sheetData, todayStr, habitMeta, slotFilter]);

    const handleComplete = async () => {
        if (!meta || habits.length === 0) return;
        const currentHabit = habits[currentIndex];
        
        // Adjust currentIndex if we are at the last habit
        if (currentIndex >= habits.length - 1 && habits.length > 1) {
            setCurrentIndex(0);
        }

        const sheetRow = meta.dataStartRow + meta.rowHeight;
        const headerIndex = meta.headers.indexOf(currentHabit);
        const colIndex = meta.startCol + headerIndex;

        const numericMeta = habitMeta?.[currentHabit]?.type === 'number' ? habitMeta[currentHabit] : null;
        updateCellMutation.mutate({ 
            sheetName, 
            rowIndex: sheetRow, 
            colIndex, 
            value: numericMeta ? (numericMeta.target ?? 1) : true,
            year,
            month,
            habitName: currentHabit
        });
    };

    const handleSetValue = (value: number) => {
        if (!meta || habits.length === 0) return;
        const currentHabit = habits[displayedIndex];
        updateCellMutation.mutate({
            sheetName,
            rowIndex: meta.dataStartRow + meta.rowHeight,
            colIndex: meta.startCol + meta.headers.indexOf(currentHabit),
            value,
            year,
            month,
            habitName: currentHabit,
        });
    };

    const handleSkip = async () => {
        if (!meta || habits.length === 0) return;
        const currentHabit = habits[currentIndex];

        // Adjust currentIndex if we are at the last habit
        if (currentIndex >= habits.length - 1 && habits.length > 1) {
            setCurrentIndex(0);
        }

        const sheetRow = meta.dataStartRow + meta.rowHeight;
        const headerIndex = meta.headers.indexOf(currentHabit);
        const colIndex = meta.startCol + headerIndex;

        updateCellMutation.mutate({ 
            sheetName, 
            rowIndex: sheetRow, 
            colIndex, 
            value: 'SKIP',
            year,
            month,
            habitName: currentHabit
        });
    };

    if (loading) {
        return <div className="flex h-full items-center justify-center p-8 animate-pulse text-muted-foreground">{t('focusLoading')}</div>;
    }

    if (!meta) {
        return (
            <div className="flex flex-col h-full items-center justify-center p-8 text-center gap-6">
                <div className="w-24 h-24 bg-muted/20 rounded-full flex items-center justify-center text-muted-foreground">
                    <Calendar size={48} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-foreground">{t('focusNoData')}</h2>
                    <p className="text-muted-foreground mt-2 max-w-sm">{t('focusNoDataHint')}</p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="flex items-center gap-2 px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-full transition-all"
                >
                    <RefreshCw size={20} /> {t('refresh')}
                </button>
            </div>
        );
    }

    if (habits.length === 0) {
        return (
            <div className="flex flex-col h-full items-center justify-center p-8 text-center gap-6">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary animate-bounce">
                    <Trophy size={48} />
                </div>
                <div>
                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">{t('focusAllDone')}</h2>
                    <p className="text-muted-foreground mt-2">{t('focusNoPending')} ({todayStr}).</p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="flex items-center gap-2 px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-full transition-all"
                >
                    <RefreshCw size={20} /> {t('refresh')}
                </button>
            </div>
        );
    }

    // Safety check for index
    const displayedIndex = currentIndex >= habits.length ? 0 : currentIndex;
    const progress = Math.round((completedCount / (completedCount + habits.length)) * 100);

    return (
        <div className="flex flex-col h-full max-w-2xl mx-auto p-4 md:p-8">
            <MilestoneCelebration streaks={streaks} />
            <div className="flex items-center justify-between mb-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    <span>{todayStr} ({sheetName})</span>
                </div>
                <div>
                    {completedCount} {t('focusCompleted')} / {habits.length} {t('focusRemaining')}
                </div>
            </div>

            <div className="w-full bg-secondary/30 h-2 rounded-full mb-12 overflow-hidden">
                <div
                    className="h-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {hasSlots && (
                <div className="flex items-center justify-center gap-2 -mt-8 mb-6 text-xs">
                    <button
                        onClick={() => setSlotFilter('now')}
                        className={`px-3 py-1 rounded-full border transition-colors ${slotFilter === 'now' ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground'}`}
                    >
                        {t('focusSlotNow')} · {t(slotLabelKey(currentSlot()))}
                    </button>
                    <button
                        onClick={() => setSlotFilter('all')}
                        className={`px-3 py-1 rounded-full border transition-colors ${slotFilter === 'all' ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground'}`}
                    >
                        {t('focusSlotAll')}{hiddenBySlot > 0 ? ` (+${hiddenBySlot})` : ''}
                    </button>
                </div>
            )}

            <div className="flex-1 flex flex-col items-center justify-center relative min-h-[300px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={habits[displayedIndex]}
                        initial={{ opacity: 0, x: 50, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -50, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="bg-card w-full p-8 md:p-12 rounded-3xl border border-border shadow-2xl flex flex-col items-center text-center gap-8 relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-purple-500" />

                        <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                            {habits[displayedIndex]}
                        </h2>
                        {streaks[habits[displayedIndex]]?.currentStreak > 0 && (
                            <div className="flex items-center gap-2 -mt-4">
                                <StreakBadge streak={streaks[habits[displayedIndex]].currentStreak} best={streaks[habits[displayedIndex]].bestStreak} size="lg" />
                                <span className="text-sm text-muted-foreground">{t('focusStreakLabel')}</span>
                            </div>
                        )}

                        {habitMeta?.[habits[displayedIndex]] && (
                            <SlotTag slot={habitMeta[habits[displayedIndex]].slot} time={habitMeta[habits[displayedIndex]].time} withLabel className="-mt-4" />
                        )}

                        {habitMeta?.[habits[displayedIndex]]?.type === 'number' ? (
                            <div className="flex flex-col items-center gap-2">
                                <NumericCell
                                    value={typeof todayValues[habits[displayedIndex]] === 'number' ? (todayValues[habits[displayedIndex]] as number) : 0}
                                    target={habitMeta[habits[displayedIndex]].target}
                                    unit={habitMeta[habits[displayedIndex]].unit}
                                    disabled={updateCellMutation.isPending}
                                    onChange={handleSetValue}
                                />
                                <span className="text-xs text-muted-foreground">{t('focusNumericGoal')}: {habitMeta[habits[displayedIndex]].target}{habitMeta[habits[displayedIndex]].unit ? ` ${habitMeta[habits[displayedIndex]].unit}` : ''}</span>
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-lg">
                                {t('focusReady')}
                            </p>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto mt-4">
                            <button
                                onClick={handleSkip}
                                disabled={updateCellMutation.isPending}
                                className="flex-1 sm:flex-none px-8 py-4 rounded-xl border border-border bg-secondary/10 hover:bg-secondary/30 text-foreground font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                <SkipForward size={24} />
                                {t('focusSkip')}
                            </button>
                            <button
                                onClick={handleComplete}
                                disabled={updateCellMutation.isPending}
                                className="flex-1 sm:flex-none px-10 py-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-lg shadow-lg hover:shadow-primary/25 flex items-center justify-center gap-3 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
                            >
                                <Check size={28} />
                                {t('focusComplete')}
                            </button>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="mt-8 text-center text-xs text-muted-foreground opacity-50">
                {t('focusDataSaved')}
            </div>
        </div>
    );
}

