import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, SkipForward, RefreshCw, Trophy, Calendar } from 'lucide-react';
import { habitService } from '../services/HabitService';
import { parseSheetData } from '../utils/parser';
import type { SheetType } from '../types';
import { useTranslation } from '../i18n';

interface CompactHabitViewProps {
    refreshKey?: number;
}

export function CompactHabitView({ refreshKey }: CompactHabitViewProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [habits, setHabits] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [completedCount, setCompletedCount] = useState(0);
    const [todayStr, setTodayStr] = useState('');
    const [sheetName, setSheetName] = useState<SheetType>('Weekdays');
    const [meta, setMeta] = useState<{ headerRowIndex: number, startCol: number, headers: string[], rowHeight: number } | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const day = now.getDay();
            const isWeekend = day === 0 || day === 6;
            const currentSheet: SheetType = isWeekend ? 'Weekend' : 'Weekdays';
            setSheetName(currentSheet);

            const pad = (n: number) => n < 10 ? '0' + n : n;
            const todayFormatted = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
            setTodayStr(todayFormatted);

            const rawData = await habitService.getData(currentSheet);
            if (!Array.isArray(rawData) && 'error' in rawData) throw new Error(rawData.error);

            const { headers, data, meta: parsedMeta } = parseSheetData(rawData);

            const todayRowIndex = data.findIndex(d => d.date === todayFormatted);

            if (todayRowIndex !== -1 && parsedMeta) {
                const todayData = data[todayRowIndex];
                const incompleteHabits = headers.filter(h => !todayData.habits[h]);

                setHabits(incompleteHabits);
                setMeta({
                    ...parsedMeta,
                    headers,
                    rowHeight: todayRowIndex
                });

                setCurrentIndex(0);
                setCompletedCount(headers.length - incompleteHabits.length);
            } else {
                setHabits([]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [refreshKey]);

    const handleComplete = async () => {
        if (!meta) return;
        const currentHabit = habits[currentIndex];

        const nextHabits = [...habits];
        nextHabits.splice(currentIndex, 1);
        setHabits(nextHabits);

        try {
            const sheetRow = meta.headerRowIndex + 1 + meta.rowHeight + 1;
            const headerIndex = meta.headers.indexOf(currentHabit);
            const colIndex = meta.startCol + headerIndex;

            await habitService.updateCell(sheetName, sheetRow, colIndex, true);
            setCompletedCount(prev => prev + 1);
        } catch (e) {
            console.error("Failed to mark complete", e);
        }
    };

    const handleSkip = () => {
        if (currentIndex < habits.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            setCurrentIndex(0);
        }
    };

    if (loading) {
        return <div className="flex h-full items-center justify-center p-8 animate-pulse text-muted-foreground">{t('focusLoading')}</div>;
    }

    if (!meta || habits.length === 0) {
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
                    onClick={fetchData}
                    className="flex items-center gap-2 px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-full transition-all"
                >
                    <RefreshCw size={20} /> {t('refresh')}
                </button>
            </div>
        );
    }

    const progress = Math.round((completedCount / (completedCount + habits.length)) * 100);

    return (
        <div className="flex flex-col h-full max-w-2xl mx-auto p-4 md:p-8">
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

            <div className="flex-1 flex flex-col items-center justify-center relative min-h-[300px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={habits[currentIndex]}
                        initial={{ opacity: 0, x: 50, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -50, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="bg-card w-full p-8 md:p-12 rounded-3xl border border-border shadow-2xl flex flex-col items-center text-center gap-8 relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-purple-500" />

                        <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                            {habits[currentIndex]}
                        </h2>

                        <p className="text-muted-foreground text-lg">
                            {t('focusReady')}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto mt-4">
                            <button
                                onClick={handleSkip}
                                className="flex-1 sm:flex-none px-8 py-4 rounded-xl border border-border bg-secondary/10 hover:bg-secondary/30 text-foreground font-semibold flex items-center justify-center gap-2 transition-all"
                            >
                                <SkipForward size={24} />
                                {t('focusSkip')}
                            </button>
                            <button
                                onClick={handleComplete}
                                className="flex-1 sm:flex-none px-10 py-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-lg shadow-lg hover:shadow-primary/25 flex items-center justify-center gap-3 transition-all transform hover:scale-105 active:scale-95"
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
