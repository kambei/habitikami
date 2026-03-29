import { useState, useEffect, useRef, useCallback } from 'react';
import { AddHabitModal } from "./AddHabitModal";
import { ColorPickerPopover } from "./ColorPickerPopover";
import { CheckboxGridView } from "./CheckboxGridView";
import type { HabitData } from "../types";
import { Checkbox } from "./ui/Checkbox";
import { motion } from "framer-motion";
import { Grid3X3, Table } from "lucide-react";
import { toast } from 'sonner';

import { useSheetData } from "../hooks/useSheetData";
import { useHabitColors } from "../hooks/useHabitColors";
import { useUpdateCell, useAddHabit, useAddDay, useMoveColumn, useDeleteColumn, useSetHabitColor } from "../hooks/useHabitMutations";
import { Skeleton } from "./ui/Skeleton";
import { useTranslation } from '../i18n';
import { translateDay } from '../utils/dayTranslation';

interface HabitTableProps {
    sheetName: string;
    refreshKey?: number;
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    columnIndex: number;
    columnName: string;
}

export function HabitTable({ sheetName, refreshKey }: HabitTableProps) {
    const { t, tArray, locale } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [pickerState, setPickerState] = useState<{
        isOpen: boolean;
        habitName: string;
        x: number;
        y: number;
    }>({ isOpen: false, habitName: '', x: 0, y: 0 });

    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, columnIndex: -1, columnName: '' });

    const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);

    const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
        return (localStorage.getItem('habitikami_view_mode') as 'table' | 'grid') || 'table';
    });

    const toggleViewMode = () => {
        const next = viewMode === 'table' ? 'grid' : 'table';
        setViewMode(next);
        localStorage.setItem('habitikami_view_mode', next);
    };

    const [currentDate, setCurrentDate] = useState(new Date());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const { data: sheetData, isLoading: isSheetLoading, error: sheetError } = useSheetData(sheetName, year, month);
    const { data: habitColors, isLoading: isColorsLoading } = useHabitColors(sheetName);

    // Derive everything from query data — no local copy
    const headers: string[] = sheetData?.headers ?? [];
    const queryData: HabitData[] = sheetData?.data ?? [];
    const meta = sheetData?.meta ?? null;
    const dataStartRow: number = sheetData?.meta?.dataStartRow ?? 0;
    const colors: Record<string, string> = habitColors ?? {};



    const mutations = {
        updateCell: useUpdateCell(),
        addHabit: useAddHabit(),
        addDay: useAddDay(),
        moveColumn: useMoveColumn(),
        deleteColumn: useDeleteColumn(),
        setHabitColor: useSetHabitColor(),
    };

    const loading = isSheetLoading || isColorsLoading;
    const error = sheetError ? (sheetError as Error).message : null;

    // Single click-outside handler to close context menu
    useEffect(() => {
        const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }));
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const [scrollDone, setScrollDone] = useState(false);
    const todayRef = useRef<HTMLTableRowElement>(null);

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
        if (!loading && queryData.length > 0 && !scrollDone && todayRef.current) {
            todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setScrollDone(true);
        }
    }, [loading, queryData, scrollDone]);

    useEffect(() => {
        setScrollDone(false);
    }, [sheetName, refreshKey]);

    useEffect(() => {
        if (!meta || queryData.length === 0) return;
        
        // Find today’s row
        const todayRow = queryData.find(row => isToday(row.date));
        if (!todayRow) return;

        // Calculate stats
        const relevantHabits = Object.entries(todayRow.habits);
        const totalCount = relevantHabits.length;
        const completedCount = relevantHabits.filter(([_, value]) => value === true).length;
        
        // Find first pending habit (not checked AND not skipped)
        const nextHabitPair = relevantHabits.find(([_, value]) => value === false);
        const nextHabitName = nextHabitPair ? nextHabitPair[0] : (t('habitTableAllDone' as any) || 'Tutti completati!');

        const summary = {
            date: translateDay(todayRow.day, tArray('days')) + ' ' + todayRow.date,
            completedCount,
            totalCount,
            currentStreak: 0, // Simplified for now
            nextHabitName
        };

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'WIDGET_UPDATE',
                data: summary
            });
        }
    }, [queryData, headers, meta, isToday, tArray, t]);

    // Handle skip-next action from URL (Windows 11 Widget)
    useEffect(() => {
        if (!meta || queryData.length === 0 || loading) return;
        
        const params = new URLSearchParams(window.location.search);
        if (params.get('action') === 'skip-next') {
            const todayRow = queryData.find(row => isToday(row.date));
            if (!todayRow) return;

            const relevantHabits = Object.entries(todayRow.habits);
            const nextHabitPair = relevantHabits.find(([_, value]) => value === false);
            
            if (nextHabitPair) {
                const habitName = nextHabitPair[0];
                const rowIndex = queryData.indexOf(todayRow);
                const sheetRow = dataStartRow + rowIndex;
                const colIndex = meta.startCol + headers.indexOf(habitName);

                // Clean up URL to avoid re-triggering
                const newUrl = window.location.pathname + window.location.hash;
                window.history.replaceState({}, '', newUrl);

                toast.info(`Skipping: ${habitName}`);
                mutations.updateCell.mutate({ sheetName, rowIndex: sheetRow, colIndex, value: 'SKIP' });
            }
        }
    }, [meta, queryData, loading, isToday, headers, dataStartRow, mutations.updateCell, sheetName]);

    const changeMonth = (delta: number) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setCurrentDate(newDate);
    };

    const handleToggle = useCallback((rowIndex: number, habit: string, currentValue: boolean | 'skipped' | 'half') => {
        if (!meta) return;

        let newValue: boolean | 'HALF';
        if (currentValue === false || currentValue === 'skipped') newValue = true;
        else if (currentValue === true) newValue = 'HALF';
        else newValue = false;

        const sheetRow = dataStartRow + rowIndex;
        const colIndex = meta.startCol + headers.indexOf(habit);

        mutations.updateCell.mutate(
            { 
                sheetName, 
                rowIndex: sheetRow, 
                colIndex, 
                value: newValue,
                year,
                month,
                habitName: habit
            }
        );
    }, [meta, dataStartRow, headers, sheetName, mutations.updateCell, year, month]);

    const handleAddHabitSubmit = (habitName: string) => {
        mutations.addHabit.mutate({ sheetName, habitName }, {
            onSuccess: () => setIsModalOpen(false),
        });
    };

    const handleAddDay = () => {
        mutations.addDay.mutate({ sheetName });
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedColumnIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, _index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (draggedColumnIndex === null || draggedColumnIndex === targetIndex || !meta) return;

        const fromIndex = meta.startCol + draggedColumnIndex;
        const destinationIndex = draggedColumnIndex < targetIndex
            ? meta.startCol + targetIndex + 1
            : meta.startCol + targetIndex;

        mutations.moveColumn.mutate({ sheetName, fromIndex, toIndex: destinationIndex }, {
            onSuccess: () => setDraggedColumnIndex(null),
        });
    };

    const handleContextMenu = (e: React.MouseEvent, index: number, name: string) => {
        e.preventDefault();
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, columnIndex: index, columnName: name });
    };

    const handleDeleteColumn = () => {
        if (contextMenu.columnIndex === -1 || !meta) return;

        if (!confirm(`${t('habitTableDeleteConfirm')} "${contextMenu.columnName}"${t('habitTableDeleteSuffix')}`)) return;

        const colIndex = meta.startCol + contextMenu.columnIndex;
        mutations.deleteColumn.mutate({ sheetName, colIndex }, {
            onSuccess: () => setContextMenu(prev => ({ ...prev, visible: false })),
        });
    };

    const handleColorClick = (e: React.MouseEvent, habitName: string) => {
        e.stopPropagation();
        setPickerState({ isOpen: true, habitName, x: e.clientX, y: e.clientY });
    };

    const handleColorSelect = (color: string) => {
        const habitName = pickerState.habitName;
        mutations.setHabitColor.mutate({ sheetName, habitName, color });
    };

    if (loading) {
        return (
            <div className="p-4 space-y-4">
                <div className="flex justify-between items-center mb-6">
                    <Skeleton className="h-8 w-48" />
                    <div className="flex gap-2">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-16" />
                    </div>
                </div>
                <div className="border border-border rounded-md overflow-hidden">
                    <div className="bg-card border-b border-border p-4 flex gap-4">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-24" />
                    </div>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="p-4 border-b border-border/50 flex gap-4">
                            <Skeleton className="h-6 w-24" />
                            <Skeleton className="h-6 w-24" />
                            <Skeleton className="h-6 w-8 rounded-sm ml-8" />
                            <Skeleton className="h-6 w-8 rounded-sm ml-12" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    if (error) return <div className="p-8 text-center text-red-500">{t('error')}: {error}</div>;

    return (
        <div className="overflow-x-auto pb-4 relative min-h-[500px] h-full flex flex-col">
            <div className="flex items-center justify-between p-4 bg-card border-b border-border sticky left-0">
                <h2 className="text-lg font-semibold">{currentDate.toLocaleString(locale, { month: 'long', year: 'numeric' })}</h2>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={toggleViewMode}
                        className="p-1.5 rounded bg-secondary hover:bg-secondary/80 transition-colors"
                        title={viewMode === 'table' ? t('habitTableGridView') : t('habitTableTableView')}
                    >
                        {viewMode === 'table' ? <Grid3X3 className="w-4 h-4" /> : <Table className="w-4 h-4" />}
                    </button>
                    <button onClick={() => changeMonth(-1)} className="px-3 py-1 rounded bg-secondary hover:bg-secondary/80 text-sm">{t('prev')}</button>
                    <button onClick={() => changeMonth(1)} className="px-3 py-1 rounded bg-secondary hover:bg-secondary/80 text-sm">{t('next')}</button>
                </div>
            </div>
            <div className="flex-1 overflow-auto relative">
                {viewMode === 'grid' ? (
                    <>
                        <CheckboxGridView
                            headers={headers}
                            data={queryData}
                            colors={colors}
                            meta={meta}
                            dataStartRow={dataStartRow}
                            onToggle={handleToggle}
                            isPending={mutations.updateCell.isPending}
                            sheetName={sheetName}
                            year={year}
                            month={month}
                        />
                        <div className="p-4">
                            <button
                                onClick={handleAddDay}
                                className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm font-medium"
                            >
                                <span>+</span> {t('habitTableAddDay')}
                            </button>
                        </div>
                    </>
                ) : (
                <>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-card text-card-foreground sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-4 font-medium whitespace-nowrap min-w-[100px] sticky left-0 z-20 bg-card hidden md:table-cell">{t('habitTableDay')}</th>
                            <th className="p-4 font-medium whitespace-nowrap min-w-[80px] md:min-w-[120px] sticky left-0 md:left-[100px] z-20 bg-card border-r border-border/50 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.5)]">{t('habitTableDate')}</th>
                            {headers.map((h, index) => (
                                <th
                                    key={h}
                                    className={`p-4 font-medium whitespace-nowrap text-center min-w-[150px] group relative cursor-move select-none ${draggedColumnIndex === index ? 'opacity-50 bg-accent' : ''}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onContextMenu={(e) => handleContextMenu(e, index, h)}
                                >
                                    <div className="flex flex-col items-center gap-1">
                                        <div
                                            onClick={(e) => handleColorClick(e, h)}
                                            className="flex items-center gap-2 cursor-pointer hover:bg-white/10 px-2 py-1 rounded transition-colors border border-transparent hover:border-border/50"
                                            title={t('colorPickerTitle')}
                                            aria-label={`Change color for habit ${h}`}
                                        >
                                            {colors[h] && <div className="w-3 h-3 rounded-full shadow-sm ring-1 ring-white/20" style={{ backgroundColor: colors[h] }} />}
                                            <span>{h}</span>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-50 text-[10px] tracking-widest text-muted-foreground mt-1">
                                            ••••
                                        </div>
                                    </div>
                                </th>
                            ))}
                            <th className="p-4 text-center">
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="w-8 h-8 rounded-full bg-primary/20 hover:bg-primary/40 text-primary flex items-center justify-center transition-colors"
                                    title={t('habitTableAddHabit')}
                                    aria-label={t('habitTableAddHabit')}
                                >
                                    +
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {queryData.map((row, rIndex) => {
                            const today = isToday(row.date);
                            return (
                                <motion.tr
                                    key={row.date + rIndex}
                                    ref={today ? todayRef : null}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: rIndex * 0.05 }}
                                    className={`border-b border-border/50 transition-colors ${today ? 'bg-primary/10 hover:bg-primary/20 border-l-4 border-l-primary' : 'hover:bg-white/5'}`}
                                >
                                    <td className={`p-4 font-medium sticky left-0 z-10 backdrop-blur hidden md:table-cell ${today ? 'bg-primary/10 text-primary' : 'text-muted-foreground bg-card/95'}`}>{translateDay(row.day, tArray('days'))}</td>
                                    <td className={`p-4 text-sm font-mono sticky left-0 md:left-[100px] z-10 backdrop-blur border-r border-border/50 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.5)] ${today ? 'bg-primary/10 text-primary' : 'text-muted-foreground bg-card/95'}`}>
                                        <span className="md:hidden">{row.date.split(/[-/]/).slice(0, 2).join('/')}</span>
                                        <span className="hidden md:inline">{row.date}</span>
                                    </td>
                                    {headers.map((h) => {
                                         const checked = row.habits[h];
                                         const isPending = mutations.updateCell.isPending;
                                         return (
                                             <td key={h} className="p-4 text-center">
                                                 <div className="flex justify-center">
                                                     <Checkbox
                                                         checked={checked === 'half' ? 'half' : (checked === true)}
                                                         disabled={isPending}
                                                         onCheckedChange={() => handleToggle(rIndex, h, checked)}
                                                         className={checked === 'skipped' ? "opacity-50 ring-2 ring-amber-500/30" : ""}
                                                     />
                                                 </div>
                                             </td>
                                         );
                                    })}
                                    <td></td>
                                </motion.tr>
                            );
                        })}
                    </tbody>
                </table>

                <div className="p-4">
                    <button
                        onClick={handleAddDay}
                        className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm font-medium"
                    >
                        <span>+</span> {t('habitTableAddDay')}
                    </button>
                </div>
                </>
                )}

                {contextMenu.visible && (
                    <div
                        className="fixed z-50 bg-popover text-popover-foreground border border-border shadow-md rounded-md py-1 min-w-[120px]"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <button
                            className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-red-500"
                            onClick={handleDeleteColumn}
                        >
                            {t('habitTableDelete')} "{contextMenu.columnName}"
                        </button>
                    </div>
                )}

                <AddHabitModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleAddHabitSubmit}
                />

                <ColorPickerPopover
                    isOpen={pickerState.isOpen}
                    onClose={() => setPickerState(prev => ({ ...prev, isOpen: false }))}
                    onSelect={handleColorSelect}
                    onDelete={() => {
                        const habitName = pickerState.habitName;
                        if (!meta) return;
                        const colIndex = headers.indexOf(habitName);
                        if (colIndex === -1) return;
                        
                        if (!confirm(`${t('habitTableDeleteConfirm')} "${habitName}"${t('habitTableDeleteSuffix')}`)) return;

                        const absoluteColIndex = meta.startCol + colIndex;
                        mutations.deleteColumn.mutate({ sheetName, colIndex: absoluteColIndex }, {
                            onSuccess: () => setPickerState(prev => ({ ...prev, isOpen: false })),
                        });
                    }}
                    position={{ x: pickerState.x, y: pickerState.y }}
                />
            </div>
        </div>
    );
}
