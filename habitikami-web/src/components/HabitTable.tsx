import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AddHabitModal } from "./AddHabitModal";
import { ColorPickerPopover } from "./ColorPickerPopover";
import { CheckboxGridView } from "./CheckboxGridView";
import type { HabitCellValue, HabitData } from "../types";
import { Checkbox } from "./ui/Checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { Grid3X3, Table, Pencil, Info, Check, X } from "lucide-react";
import { toast } from 'sonner';

import { useSheetData, useSheetRange } from "../hooks/useSheetData";
import { longestCurrentStreak } from "../utils/streaks";
import { descriptionsOf, targetsOf } from "../utils/habitMeta";
import { useHabitColors } from "../hooks/useHabitColors";
import { useUpdateCell, useAddHabit, useAddDay, useMoveColumn, useDeleteColumn, useSetHabitColor, useRenameHabit, useHabitMeta, useSetHabitMeta } from "../hooks/useHabitMutations";
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
    const { data: habitMeta } = useHabitMeta();
    const metaMap: Record<string, string> = useMemo(() => descriptionsOf(habitMeta), [habitMeta]);
    const habitTargets = useMemo(() => targetsOf(habitMeta), [habitMeta]);

    // Last 90 days of both sheets, for the streak shown by the Windows widget
    const streakWindow = useMemo(() => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 90);
        return { from, to };
    }, []);
    const { data: weekdaysRange } = useSheetRange('Weekdays', streakWindow.from, streakWindow.to);
    const { data: weekendRange } = useSheetRange('Weekend', streakWindow.from, streakWindow.to);
    const widgetStreak = useMemo(
        () => longestCurrentStreak([weekdaysRange?.data ?? [], weekendRange?.data ?? []], new Date(), habitTargets).streak,
        [weekdaysRange, weekendRange, habitTargets]
    );

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
        renameHabit: useRenameHabit(),
        setHabitMeta: useSetHabitMeta(),
    };


    const [editingHabit, setEditingHabit] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [infoHabit, setInfoHabit] = useState<string | null>(null);
    const [infoEditing, setInfoEditing] = useState(false);
    const [infoDraft, setInfoDraft] = useState('');

    const startRename = (habit: string) => {
        setEditingHabit(habit);
        setEditingValue(habit);
    };

    const commitRename = (habit: string) => {
        const next = editingValue.trim();
        setEditingHabit(null);
        if (!next || next === habit) return;
        mutations.renameHabit.mutate({ sheetName, oldName: habit, newName: next });
    };

    const cancelRename = () => {
        setEditingHabit(null);
        setEditingValue('');
    };

    const openInfo = (habit: string) => {
        setInfoHabit(habit);
        setInfoDraft(metaMap[habit] || '');
        setInfoEditing(false);
    };

    const saveInfo = () => {
        if (!infoHabit) return;
        mutations.setHabitMeta.mutate({ habitName: infoHabit, description: infoDraft });
        setInfoEditing(false);
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
            currentStreak: widgetStreak,
            nextHabitName
        };

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'WIDGET_UPDATE',
                data: summary
            });
        }
    }, [queryData, headers, meta, isToday, tArray, t, widgetStreak]);

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

    const handleToggle = useCallback((rowIndex: number, habit: string, currentValue: HabitCellValue) => {
        if (!meta) return;
        // Quantitative cells are edited with a value input (coming with #14), not toggled
        if (typeof currentValue === 'number') return;

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
                            {headers.map((h, index) => {
                                const isEditing = editingHabit === h;
                                const hasInfo = !!(metaMap[h] && metaMap[h].trim());
                                return (
                                <th
                                    key={h}
                                    className={`p-4 font-medium whitespace-nowrap text-center min-w-[150px] group relative select-none ${isEditing ? '' : 'cursor-move'} ${draggedColumnIndex === index ? 'opacity-50 bg-accent' : ''}`}
                                    draggable={!isEditing}
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onContextMenu={(e) => handleContextMenu(e, index, h)}
                                >
                                    <div className="flex flex-col items-center gap-1">
                                        {isEditing ? (
                                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                {colors[h] && <div className="w-3 h-3 rounded-full shadow-sm ring-1 ring-white/20 shrink-0" style={{ backgroundColor: colors[h] }} />}
                                                <input
                                                    autoFocus
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') commitRename(h);
                                                        else if (e.key === 'Escape') cancelRename();
                                                    }}
                                                    onBlur={() => commitRename(h)}
                                                    className="bg-background border border-border rounded px-2 py-0.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                                />
                                                <button
                                                    onMouseDown={(e) => { e.preventDefault(); commitRename(h); }}
                                                    className="p-1 rounded hover:bg-green-500/20 text-green-500"
                                                    aria-label={t('habitRenameSave')}
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onMouseDown={(e) => { e.preventDefault(); cancelRename(); }}
                                                    className="p-1 rounded hover:bg-red-500/20 text-red-500"
                                                    aria-label={t('habitInfoCancel')}
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <div
                                                    onClick={(e) => handleColorClick(e, h)}
                                                    className="flex items-center gap-2 cursor-pointer hover:bg-white/10 px-2 py-1 rounded transition-colors border border-transparent hover:border-border/50"
                                                    title={t('colorPickerTitle')}
                                                    aria-label={`Change color for habit ${h}`}
                                                >
                                                    {colors[h] && <div className="w-3 h-3 rounded-full shadow-sm ring-1 ring-white/20" style={{ backgroundColor: colors[h] }} />}
                                                    <span>{h}</span>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); startRename(h); }}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    draggable={false}
                                                    onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                    className="p-1 rounded opacity-60 md:opacity-0 md:group-hover:opacity-60 hover:opacity-100 hover:bg-white/10 transition-opacity"
                                                    title={t('habitTableEditName')}
                                                    aria-label={t('habitTableEditName')}
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openInfo(h); }}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    draggable={false}
                                                    onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                    className={`p-1 rounded hover:bg-white/10 transition-opacity ${hasInfo ? 'opacity-80 hover:opacity-100' : 'opacity-60 md:opacity-0 md:group-hover:opacity-60 hover:opacity-100'}`}
                                                    style={hasInfo ? { color: colors[h] || undefined } : undefined}
                                                    title={t('habitTableInfo')}
                                                    aria-label={t('habitTableInfo')}
                                                >
                                                    <Info className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                        <div className="opacity-0 group-hover:opacity-50 text-[10px] tracking-widest text-muted-foreground mt-1">
                                            ••••
                                        </div>
                                    </div>
                                </th>
                                );
                            })}
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
                                         const description = metaMap[h] && metaMap[h].trim();
                                         const tooltip = description ? `${h} — ${description}` : h;
                                         return (
                                             <td key={h} className="p-4 text-center" title={tooltip}>
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

                <AnimatePresence>
                    {infoHabit && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                            onClick={() => { setInfoHabit(null); setInfoEditing(false); }}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                transition={{ type: 'spring', duration: 0.3 }}
                                className="bg-card border border-border rounded-xl p-5 w-full max-w-sm shadow-xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    {colors[infoHabit] && (
                                        <div
                                            className="w-4 h-4 rounded-full shrink-0"
                                            style={{ backgroundColor: colors[infoHabit] }}
                                        />
                                    )}
                                    <h3 className="text-base font-semibold break-words flex-1">{infoHabit}</h3>
                                </div>

                                <p className="text-xs text-muted-foreground mb-2">{t('habitInfoDescriptionLabel')}</p>

                                {infoEditing ? (
                                    <textarea
                                        autoFocus
                                        value={infoDraft}
                                        onChange={(e) => setInfoDraft(e.target.value)}
                                        placeholder={t('habitInfoDescriptionPlaceholder')}
                                        rows={5}
                                        className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                                    />
                                ) : (
                                    <div className="min-h-[80px] text-sm whitespace-pre-wrap break-words text-foreground/90 bg-secondary/30 rounded-md p-3 border border-border/50">
                                        {metaMap[infoHabit]?.trim() || (
                                            <span className="text-muted-foreground italic">{t('habitInfoEmpty')}</span>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 mt-4">
                                    {infoEditing ? (
                                        <>
                                            <button
                                                onClick={() => { setInfoEditing(false); setInfoDraft(metaMap[infoHabit] || ''); }}
                                                className="px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors"
                                            >
                                                {t('habitInfoCancel')}
                                            </button>
                                            <button
                                                onClick={saveInfo}
                                                disabled={mutations.setHabitMeta.isPending}
                                                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-60"
                                            >
                                                {t('habitInfoSave')}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => { setInfoHabit(null); setInfoEditing(false); }}
                                                className="px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors"
                                            >
                                                {t('close')}
                                            </button>
                                            <button
                                                onClick={() => { setInfoDraft(metaMap[infoHabit] || ''); setInfoEditing(true); }}
                                                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors inline-flex items-center gap-1"
                                            >
                                                <Pencil className="w-3.5 h-3.5" /> {t('habitInfoEdit')}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
