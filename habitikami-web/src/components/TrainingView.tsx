import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, ExternalLink /*, Filter*/ } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useTranslation } from '../i18n';
import { useTodayTrainingLog, useLogTrainingExercise, useRemoveTrainingExercise } from '../hooks/useTrainingData';
import {
    DAYS, SECTIONS, MORNING_PLANS, AFTERNOON_PLANS,
    STRETCHING_EXERCISES, CHAIR_EXERCISES, AIKIDO_EXERCISES,
    SHAOLIN_EXERCISES, ISOMETRIC_EXERCISES, CRAVING_EXERCISES, BIKE_EXERCISES,
    type DayKey, type Exercise, type PlanExercise,
} from '../data/trainingData';
import { TRAINING_TRANSLATIONS_EN } from '../data/trainingTranslations';

// Equipment filter definitions (Temporarily disabled)
/*
const EQUIPMENT_FILTERS = [
    { key: 'cyclette', icon: '🚴', labelKey: 'trainingEqCyclette' },
    { key: 'bici', icon: '🚲', labelKey: 'trainingEqBici' },
    { key: 'pullup', icon: '🔩', labelKey: 'trainingEqPullup' },
    { key: 'corda', icon: '🪢', labelKey: 'trainingEqCorda' },
    { key: 'tappetino', icon: '🧘', labelKey: 'trainingEqTappetino' },
    { key: 'madmuscles', icon: '📱', labelKey: 'trainingEqMadMuscles' },
    { key: 'yogago', icon: '📱', labelKey: 'trainingEqYogaGo' },
] as const;
*/

// Helper: check if an exercise matches an equipment filter
function matchesEquipment(ex: { name: string; icon?: string; description?: string }, filterKey: string): boolean {
    const txt = `${ex.name} ${ex.description || ''} ${ex.icon || ''}`.toLowerCase();
    switch (filterKey) {
        case 'cyclette': return txt.includes('cyclette') || (ex.icon === '🚴');
        case 'bici': return (txt.includes('bici') && !txt.includes('bicicletta')) || ex.icon === '🚲';
        case 'pullup': return txt.includes('pull-up') || txt.includes('dead hang') || ex.icon === '🔩';
        case 'corda': return txt.includes('corda') || ex.icon === '🪢';
        case 'tappetino': return txt.includes('tappetino') || ex.icon === '🧘';
        case 'madmuscles': return txt.includes('madmuscles');
        case 'yogago': return txt.includes('yoga go');
        default: return false;
    }
}

// Helper: find matching catalog exercise for a plan exercise
function findCatalogExercise(planEx: PlanExercise): Exercise | null {
    const n = planEx.name.toLowerCase().replace(/\s*\(.*?\)/g, '').trim();
    const catalogs = [
        ...STRETCHING_EXERCISES, ...CHAIR_EXERCISES, ...AIKIDO_EXERCISES,
        ...SHAOLIN_EXERCISES, ...ISOMETRIC_EXERCISES, ...CRAVING_EXERCISES, ...BIKE_EXERCISES,
    ];
    for (const ex of catalogs) {
        const cn = ex.name.toLowerCase().replace(/\s*\(.*?\)/g, '').trim();
        if (cn === n || cn.includes(n) || n.includes(cn)) return ex;
    }
    return null;
}

// Sub-exercises for the "Stretching risveglio" wake-up routine
const WAKEUP_STRETCH_SUBS: { name: string; icon: string; duration: string }[] = [
    { name: 'Collo — rotazioni lente', icon: '💆', duration: '30s' },
    { name: 'Spalle — cerchi avanti/dietro', icon: '🙆', duration: '30s' },
    { name: 'Schiena — gatto-mucca', icon: '🐈', duration: '45s' },
    { name: 'Fianchi — torsione busto', icon: '🌀', duration: '30s' },
    { name: 'Gambe — pinza in piedi', icon: '🦵', duration: '45s' },
    { name: 'Caviglie — cerchi', icon: '👣', duration: '20s' },
];

function isWakeupStretch(name: string): boolean {
    return name.toLowerCase().startsWith('stretching risveglio');
}

// External app links for specific plan entries
const EXTERNAL_APP_LINKS: Record<string, { label: string; url: string }> = {
    'ext:madmuscles': { label: 'MadMuscles', url: 'https://madmuscles.com/' },
    'ext:yogago': { label: 'Yoga Go', url: 'https://yoga-go.io/' },
};

// Helper: get section key from exercise name (for plan exercises)
function guessSectionForPlanExercise(planEx: PlanExercise): string {
    const n = planEx.name.toLowerCase();
    if (n.includes('madmuscles')) return 'ext:madmuscles';
    if (n.includes('yoga go')) return 'ext:yogago';
    if (n.includes('stretch') || planEx.icon === '🧘') return 'stretch';
    if (n.includes('aiki') || planEx.icon === '🥋') return 'aikido';
    if (n.includes('shaolin') || n.includes('horse stance') || n.includes('palmi uniti') || n.includes('mani intrecciate') || planEx.icon === '🐉') return 'shaolin';
    if (n.includes('sedia') || n.includes('seated') || planEx.icon === '🪑') return 'chair';
    if (n.includes('respirazione') || n.includes('craving') || planEx.icon === '🌬️') return 'craving';
    return 'iso';
}

function getSectionForExercise(sectionKey: string): string {
    if (EXTERNAL_APP_LINKS[sectionKey]) return EXTERNAL_APP_LINKS[sectionKey].label;
    const sec = SECTIONS.find(s => s.key === sectionKey);
    return sec?.label || sectionKey;
}

const ALL_CATALOG_EXERCISES: { exercise: Exercise; sectionKey: string }[] = [
    ...STRETCHING_EXERCISES.map(e => ({ exercise: e, sectionKey: 'stretch' })),
    ...CHAIR_EXERCISES.map(e => ({ exercise: e, sectionKey: 'chair' })),
    ...AIKIDO_EXERCISES.map(e => ({ exercise: e, sectionKey: 'aikido' })),
    ...SHAOLIN_EXERCISES.map(e => ({ exercise: e, sectionKey: 'shaolin' })),
    ...ISOMETRIC_EXERCISES.map(e => ({ exercise: e, sectionKey: 'iso' })),
    ...CRAVING_EXERCISES.map(e => ({ exercise: e, sectionKey: 'craving' })),
    ...BIKE_EXERCISES.map(e => ({ exercise: e, sectionKey: 'bici' })),
];

const SECTION_CATALOG: Record<string, Exercise[]> = {
    stretch: STRETCHING_EXERCISES,
    chair: CHAIR_EXERCISES,
    aikido: AIKIDO_EXERCISES,
    shaolin: SHAOLIN_EXERCISES,
    iso: ISOMETRIC_EXERCISES,
    craving: CRAVING_EXERCISES,
};

export function TrainingView() {
    const { t } = useTranslation();
    const [activeSection, setActiveSection] = useState('plan');
    const [selectedDay, setSelectedDay] = useState<DayKey>(() => {
        const jsDay = new Date().getDay();
        return DAYS.find(d => d.jsDay === jsDay)?.key || 'lun';
    });
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [equipmentFilter, setEquipmentFilter] = useState<string | null>(null);

    const { todayEntries, todayStr, isLoading } = useTodayTrainingLog();
    const logMutation = useLogTrainingExercise();
    const removeMutation = useRemoveTrainingExercise();

    const isExerciseDone = (exercise: string, session: string, section: string) => {
        return todayEntries.some(e => e.exercise === exercise && e.session === session && e.section === section);
    };

    const handleToggleExercise = (exercise: string, session: string, section: string, duration: string) => {
        if (logMutation.isPending || removeMutation.isPending) return;

        if (isExerciseDone(exercise, session, section)) {
            removeMutation.mutate(
                { date: todayStr, section, exercise, session },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                { onError: () => toast.error(t('trainingFailedUndo' as any)) }
            );
        } else {
            logMutation.mutate(
                { date: todayStr, section, exercise, session, duration },
                { onSuccess: () => toast.success(`✓ ${exercise}`, { duration: 1500 }) }
            );
        }
    };

    /*
    const handleEquipmentToggle = (key: string) => {
        setEquipmentFilter(prev => prev === key ? null : key);
        setExpandedId(null);
    };
    */

    // Filtered exercises for equipment view
    const filteredExercises = useMemo(() => {
        if (!equipmentFilter) return [];
        const seen = new Set<string>();
        const results: { exercise: Exercise; sectionKey: string; source: string }[] = [];

        // Search catalogs
        for (const item of ALL_CATALOG_EXERCISES) {
            if (matchesEquipment(item.exercise, equipmentFilter) && !seen.has(item.exercise.name)) {
                seen.add(item.exercise.name);
                results.push({ ...item, source: getSectionForExercise(item.sectionKey) });
            }
        }

        // Search plan exercises
        const allPlans = { ...MORNING_PLANS, ...AFTERNOON_PLANS };
        for (const plan of Object.values(allPlans)) {
            if (!plan) continue;
            for (const ex of plan.exercises) {
                if (matchesEquipment({ name: ex.name, icon: ex.icon }, equipmentFilter) && !seen.has(ex.name)) {
                    seen.add(ex.name);
                    const catalogEx = findCatalogExercise(ex);
                    if (catalogEx) {
                        results.push({ exercise: catalogEx, sectionKey: 'plan', source: 'Piano' });
                    }
                }
            }
        }

        return results;
    }, [equipmentFilter]);

    const currentSection = SECTIONS.find(s => s.key === activeSection)!;
    const accentColor = currentSection?.color || '#FF6B35';

    const isPending = logMutation.isPending || removeMutation.isPending;

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{ '--training-accent': accentColor } as React.CSSProperties}>
            {/* Section tabs */}
            <div className="flex overflow-x-auto border-b border-border bg-card/50 backdrop-blur shrink-0 scrollbar-hide">
                {SECTIONS.map(sec => (
                    <button
                        key={sec.key}
                        onClick={() => { setActiveSection(sec.key); setExpandedId(null); setEquipmentFilter(null); }}
                        className={cn(
                            "flex flex-col items-center px-3 py-2 min-w-0 flex-1 text-[10px] font-semibold transition-all border-b-2 whitespace-nowrap",
                            activeSection === sec.key && !equipmentFilter
                                ? "border-current text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground/70"
                        )}
                        style={activeSection === sec.key && !equipmentFilter ? { color: sec.color } : undefined}
                    >
                        <span className="text-base leading-none mb-0.5">{sec.icon}</span>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {t(`training${sec.key.charAt(0).toUpperCase() + sec.key.slice(1)}` as any) || sec.label}
                    </button>
                ))}
            </div>

            {/* Equipment filter bar */}
            {/* <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-card/30 overflow-x-auto scrollbar-hide shrink-0">
                <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {EQUIPMENT_FILTERS.map(eq => (
                    <button
                        key={eq.key}
                        onClick={() => handleEquipmentToggle(eq.key)}
                        className={cn(
                            "text-[10px] px-2 py-1 rounded-md border transition-all whitespace-nowrap flex items-center gap-1",
                            equipmentFilter === eq.key
                                ? "border-primary bg-primary/15 text-primary"
                                : "border-border bg-card text-muted-foreground hover:text-foreground/70"
                        )}
                    >
                        <span>{eq.icon}</span>
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        {t(eq.labelKey as any)}
                    </button>
                ))}
            </div> */}

            {/* Today's counter */}
            {!isLoading && (
                <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border bg-card/30 flex items-center gap-2">
                    <span className="font-bold text-foreground">{todayEntries.length}</span>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {t('trainingLoggedToday' as any)}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {equipmentFilter ? (
                    <EquipmentFilterView
                        results={filteredExercises}
                        expandedId={expandedId}
                        onToggleExpand={setExpandedId}
                        isExerciseDone={isExerciseDone}
                        onToggleExercise={handleToggleExercise}
                        accentColor={accentColor}
                        isPending={isPending}
                        filterCount={filteredExercises.length}
                    />
                ) : activeSection === 'plan' ? (
                    <PlanView
                        selectedDay={selectedDay}
                        onDayChange={setSelectedDay}
                        expandedId={expandedId}
                        onToggleExpand={setExpandedId}
                        isExerciseDone={isExerciseDone}
                        onToggleExercise={handleToggleExercise}
                        todayStr={todayStr}
                        accentColor={accentColor}
                        isPending={isPending}
                        onNavigateToSection={(key) => { setActiveSection(key); setExpandedId(null); }}
                    />
                ) : (
                    <CatalogView
                        sectionKey={activeSection}
                        expandedId={expandedId}
                        onToggleExpand={setExpandedId}
                        isExerciseDone={isExerciseDone}
                        onToggleExercise={handleToggleExercise}
                        todayStr={todayStr}
                        accentColor={accentColor}
                        isPending={isPending}
                    />
                )}
            </div>
        </div>
    );
}

// ─── Equipment Filter View ───────────────────────────────────────────────────

interface EquipmentFilterViewProps {
    results: { exercise: Exercise; sectionKey: string; source: string }[];
    expandedId: string | null;
    onToggleExpand: (id: string | null) => void;
    isExerciseDone: (exercise: string, session: string, section: string) => boolean;
    onToggleExercise: (exercise: string, session: string, section: string, duration: string) => void;
    accentColor: string;
    isPending: boolean;
    filterCount: number;
}

function EquipmentFilterView({ results, expandedId, onToggleExpand, isExerciseDone, onToggleExercise, accentColor, isPending, filterCount }: EquipmentFilterViewProps) {
    const { t, language } = useTranslation();

    const tData = (text: string | undefined, field: keyof typeof TRAINING_TRANSLATIONS_EN[string]) => {
        if (!text) return '';
        if (language === 'en') {
            const trans = TRAINING_TRANSLATIONS_EN[text];
            if (trans && trans[field]) return trans[field] as string;
        }
        return text;
    };

    if (results.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return <div className="text-center text-muted-foreground py-8">{t('trainingNoExercises' as any)}</div>;
    }

    return (
        <>
            <div className="text-xs bg-card border border-border rounded-lg p-3 leading-relaxed" style={{ borderLeftColor: accentColor, borderLeftWidth: 3 }}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <b>🔧 {filterCount} {t('trainingFilterResults' as any)}</b>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <div className="text-muted-foreground mt-1">{t('trainingFilterHint' as any)}</div>
            </div>

            {results.map((item, i) => {
                const id = `eq_${i}`;
                const isExpanded = expandedId === id;
                const ex = item.exercise;
                const sectionLabel = getSectionForExercise(item.sectionKey);
                const sessionLabel = 'Catalogo'; // Stable ID for DB
                const done = isExerciseDone(ex.name, sessionLabel, sectionLabel);

                return (
                    <div key={id} className={cn(
                        "bg-card rounded-xl border border-border overflow-hidden transition-colors",
                        done && "border-emerald-500/30 bg-emerald-500/5"
                    )}>
                        <div
                            className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-foreground/[0.02] transition-colors"
                            onClick={() => onToggleExpand(isExpanded ? null : id)}
                        >
                            <span className="text-xl w-7 text-center shrink-0">{ex.icon}</span>
                            <div className="flex-1 min-w-0">
                                <div className={cn("font-bold text-sm", done && "line-through text-muted-foreground")}>{tData(ex.name, 'name')}</div>
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded inline-block mt-0.5" style={{ backgroundColor: `${accentColor}18`, color: accentColor }}>
                                    {language === 'en' ? (t(`training${item.sectionKey.charAt(0).toUpperCase() + item.sectionKey.slice(1)}` as any) || item.source) : item.source}
                                </span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isPending) onToggleExercise(ex.name, sessionLabel, sectionLabel, ex.duration || '');
                                }}
                                className={cn(
                                    "w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-all",
                                    done ? "bg-emerald-500 text-white" : "border border-border hover:border-current"
                                )}
                                style={!done ? { color: accentColor } : undefined}
                                disabled={isPending}
                            >
                                {done ? <Check className="w-4 h-4" /> : <Check className="w-3.5 h-3.5 opacity-30" />}
                            </button>
                            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-180")} />
                        </div>

                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <ExerciseDetail exercise={ex} accentColor={accentColor} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </>
    );
}

// ─── Plan View ───────────────────────────────────────────────────────────────

interface PlanViewProps {
    selectedDay: DayKey;
    onDayChange: (day: DayKey) => void;
    expandedId: string | null;
    onToggleExpand: (id: string | null) => void;
    isExerciseDone: (exercise: string, session: string, section: string) => boolean;
    onToggleExercise: (exercise: string, session: string, section: string, duration: string) => void;
    todayStr: string;
    accentColor: string;
    isPending: boolean;
    onNavigateToSection: (sectionKey: string) => void;
}

function PlanView({ selectedDay, onDayChange, expandedId, onToggleExpand, isExerciseDone, onToggleExercise, accentColor, isPending, onNavigateToSection }: PlanViewProps) {
    const { t, language } = useTranslation();
    const dayInfo = DAYS.find(d => d.key === selectedDay)!;
    const isWeekend = selectedDay === 'sab' || selectedDay === 'dom';
    const morningPlan = MORNING_PLANS[selectedDay];
    const afternoonPlan = AFTERNOON_PLANS[selectedDay];

    const tData = (text: string | undefined, field: keyof typeof TRAINING_TRANSLATIONS_EN[string]) => {
        if (!text) return '';
        if (language === 'en') {
            const trans = TRAINING_TRANSLATIONS_EN[text];
            if (trans && trans[field]) return trans[field] as string;
        }
        return text;
    };

    return (
        <>
            {/* Day picker */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {DAYS.map(d => (
                    <button
                        key={d.key}
                        onClick={() => { onDayChange(d.key); onToggleExpand(null); }}
                        className={cn(
                            "px-2.5 py-1.5 rounded-lg border-2 text-xs font-bold transition-all min-w-[44px] text-center",
                            selectedDay === d.key
                                ? "border-current bg-current/10 shadow-sm"
                                : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30"
                        )}
                        style={selectedDay === d.key ? { color: accentColor, borderColor: accentColor } : undefined}
                    >
                        {d.labelShort}
                    </button>
                ))}
            </div>

            {/* Day header */}
            <div className="mb-1">
                <div className="text-lg font-extrabold">{tData(dayInfo.labelFull, 'name')}</div>
                {isWeekend && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1"
                        style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        ⚡ {t('trainingSingle' as any)}
                    </span>
                )}
            </div>

            {/* Morning / Single session */}
            <SessionBlock
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                label={isWeekend && !afternoonPlan ? `⚡ ${t('trainingSingle' as any)}` : `🌅 ${t('trainingMorning' as any)}`}
                plan={morningPlan}
                sessionName={isWeekend && !afternoonPlan ? 'Unica' : 'Mattina'}
                expandedId={expandedId}
                onToggleExpand={onToggleExpand}
                idPrefix="mo"
                isExerciseDone={isExerciseDone}
                onToggleExercise={onToggleExercise}
                accentColor={accentColor}
                isPending={isPending}
                onNavigateToSection={onNavigateToSection}
            />

            {/* Afternoon / Evening */}
            {afternoonPlan && (
                <SessionBlock
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    label={`🌇 ${t('trainingAfternoon' as any)}`}
                    plan={afternoonPlan}
                    sessionName="Pomeriggio"
                    expandedId={expandedId}
                    onToggleExpand={onToggleExpand}
                    idPrefix="pm"
                    isExerciseDone={isExerciseDone}
                    onToggleExercise={onToggleExercise}
                    accentColor={accentColor}
                    isPending={isPending}
                    onNavigateToSection={onNavigateToSection}
                />
            )}

            {/* Tips */}
            <div className="text-xs text-muted-foreground bg-card border border-border rounded-lg p-3 leading-relaxed border-l-2" style={{ borderLeftColor: accentColor }}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <b>💡 {t('trainingIsometricTip' as any)}</b>
            </div>
            <div className="text-xs text-muted-foreground bg-card border border-border rounded-lg p-3 leading-relaxed border-l-2" style={{ borderLeftColor: accentColor }}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <b>🪑 {t('trainingChairTip' as any)}</b>
            </div>
        </>
    );
}

// ─── Session Block ───────────────────────────────────────────────────────────

interface SessionBlockProps {
    label: string;
    plan: { title: string; duration: string; exercises: PlanExercise[] };
    sessionName: string;
    expandedId: string | null;
    onToggleExpand: (id: string | null) => void;
    idPrefix: string;
    isExerciseDone: (exercise: string, session: string, section: string) => boolean;
    onToggleExercise: (exercise: string, session: string, section: string, duration: string) => void;
    accentColor: string;
    isPending: boolean;
    onNavigateToSection: (sectionKey: string) => void;
}

function SessionBlock({ label, plan, sessionName, expandedId, onToggleExpand, idPrefix, isExerciseDone, onToggleExercise, accentColor, isPending, onNavigateToSection }: SessionBlockProps) {
    const { language } = useTranslation();
    const completedCount = plan.exercises.filter(ex => {
        const sec = getSectionForExercise(guessSectionForPlanExercise(ex));
        return isExerciseDone(ex.name, sessionName, sec);
    }).length;

    const tData = (text: string | undefined, field: keyof typeof TRAINING_TRANSLATIONS_EN[string]) => {
        if (!text) return '';
        if (language === 'en') {
            const trans = TRAINING_TRANSLATIONS_EN[text];
            if (trans && trans[field]) return trans[field] as string;
        }
        return text;
    };

    return (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2.5 flex justify-between items-center border-b border-border"
                style={{ backgroundColor: `${accentColor}08` }}>
                <div>
                    <span className="font-bold text-sm">{label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{tData(plan.title, 'title')}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono" style={{ color: accentColor }}>
                        {completedCount}/{plan.exercises.length}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">{plan.duration}</span>
                </div>
            </div>

            {/* Exercises */}
            {plan.exercises.map((ex, i) => {
                const id = `${idPrefix}_${i}`;
                const isExpanded = expandedId === id;
                const catalogEx = findCatalogExercise(ex);
                const sectionKey = guessSectionForPlanExercise(ex);
                const sectionLabel = getSectionForExercise(sectionKey);
                const done = isExerciseDone(ex.name, sessionName, sectionLabel);
                const externalLink = EXTERNAL_APP_LINKS[sectionKey];
                const canNavigate = !!externalLink || !!SECTION_CATALOG[sectionKey];

                return (
                    <div key={id} className={cn("border-t border-border/50 transition-colors", done && "bg-emerald-500/5")}>
                        <div
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-foreground/[0.02] transition-colors"
                            onClick={() => {
                                if (externalLink) {
                                    window.open(externalLink.url, '_blank', 'noopener,noreferrer');
                                } else if (canNavigate) {
                                    onNavigateToSection(sectionKey);
                                } else {
                                    onToggleExpand(isExpanded ? null : id);
                                }
                            }}
                            title={externalLink ? `↗ ${externalLink.label}` : canNavigate ? `→ ${sectionLabel}` : undefined}
                        >
                            <span className="text-base w-6 text-center shrink-0">{ex.icon}</span>
                            <span className={cn("flex-1 text-sm flex items-center gap-1 min-w-0", done && "line-through text-muted-foreground")}>
                                <span className="truncate">{tData(ex.name, 'name')}</span>
                                {externalLink && <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{ex.duration}</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isPending) onToggleExercise(ex.name, sessionName, sectionLabel, ex.duration);
                                }}
                                className={cn(
                                    "w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-all",
                                    done
                                        ? "bg-emerald-500 text-white"
                                        : "border border-border hover:border-current"
                                )}
                                style={!done ? { color: accentColor } : undefined}
                                disabled={isPending}
                            >
                                {done ? <Check className="w-4 h-4" /> : <Check className="w-3.5 h-3.5 opacity-30" />}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleExpand(isExpanded ? null : id);
                                }}
                                className="p-1 -mr-1 shrink-0 rounded hover:bg-foreground/10 transition-colors"
                                title="Details"
                            >
                                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                            </button>
                        </div>

                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    {isWakeupStretch(ex.name) ? (
                                        <WakeupStretchPanel
                                            parentName={ex.name}
                                            parentDuration={ex.duration}
                                            sessionName={sessionName}
                                            sectionLabel={sectionLabel}
                                            isExerciseDone={isExerciseDone}
                                            onToggleExercise={onToggleExercise}
                                            accentColor={accentColor}
                                            isPending={isPending}
                                        />
                                    ) : (
                                        <ExerciseDetail exercise={catalogEx} planExercise={ex} accentColor={accentColor} />
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Catalog View ────────────────────────────────────────────────────────────

interface CatalogViewProps {
    sectionKey: string;
    expandedId: string | null;
    onToggleExpand: (id: string | null) => void;
    isExerciseDone: (exercise: string, session: string, section: string) => boolean;
    onToggleExercise: (exercise: string, session: string, section: string, duration: string) => void;
    todayStr: string;
    accentColor: string;
    isPending: boolean;
}

function CatalogView({ sectionKey, expandedId, onToggleExpand, isExerciseDone, onToggleExercise, accentColor, isPending }: CatalogViewProps) {
    const { t, language } = useTranslation();
    const exercises = SECTION_CATALOG[sectionKey] || [];
    const sectionLabel = getSectionForExercise(sectionKey);
    const catalogSession = 'Catalogo'; // Stable ID for DB

    const tData = (text: string | undefined, field: keyof typeof TRAINING_TRANSLATIONS_EN[string]) => {
        if (!text) return '';
        if (language === 'en') {
            const trans = TRAINING_TRANSLATIONS_EN[text];
            if (trans && trans[field]) return trans[field] as string;
        }
        return text;
    };

    if (exercises.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return <div className="text-center text-muted-foreground py-8">{t('trainingNoExercises' as any)}</div>;
    }

    // Section intro key mapping
    const introKeys: Record<string, string> = {
        stretch: 'trainingIntroStretch',
        chair: 'trainingIntroChair',
        aikido: 'trainingIntroAikido',
        shaolin: 'trainingIntroShaolin',
        iso: 'trainingIntroIso',
        craving: 'trainingIntroCraving',
    };

    const introKey = introKeys[sectionKey];

    return (
        <>
            {/* Section intro */}
            {introKey && sectionKey === 'craving' ? (
                <div className="text-xs bg-card border border-border rounded-lg p-3 leading-relaxed mb-2" style={{ borderLeftColor: accentColor, borderLeftWidth: 3 }}>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <b>🧠 {t(introKey as any)}</b>
                </div>
            ) : introKey ? (
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {t(introKey as any)}
                </p>
            ) : null}

            {exercises.map((ex, i) => {
                const id = `cat_${sectionKey}_${i}`;
                const isExpanded = expandedId === id;
                const done = isExerciseDone(ex.name, catalogSession, sectionLabel);

                return (
                    <div key={id} className={cn(
                        "bg-card rounded-xl border border-border overflow-hidden transition-colors",
                        done && "border-emerald-500/30 bg-emerald-500/5"
                    )}>
                        <div
                            className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-foreground/[0.02] transition-colors"
                            onClick={() => onToggleExpand(isExpanded ? null : id)}
                        >
                            <span className="text-xl w-7 text-center shrink-0">{ex.icon}</span>
                            <div className="flex-1 min-w-0">
                                <div className={cn("font-bold text-sm", done && "line-through text-muted-foreground")}>{tData(ex.name, 'name')}</div>
                                {ex.target && <div className="text-[10px] mt-0.5" style={{ color: accentColor }}>{tData(ex.name, 'target') || ex.target}</div>}
                                {ex.category && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-block" style={{ backgroundColor: `${accentColor}18`, color: accentColor }}>{tData(ex.name, 'category') || ex.category}</span>}
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isPending) onToggleExercise(ex.name, catalogSession, sectionLabel, ex.duration || '');
                                }}
                                className={cn(
                                    "w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-all",
                                    done
                                        ? "bg-emerald-500 text-white"
                                        : "border border-border hover:border-current"
                                )}
                                style={!done ? { color: accentColor } : undefined}
                                disabled={isPending}
                            >
                                {done ? <Check className="w-4 h-4" /> : <Check className="w-3.5 h-3.5 opacity-30" />}
                            </button>
                            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-180")} />
                        </div>

                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <ExerciseDetail exercise={ex} accentColor={accentColor} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </>
    );
}

// ─── Wake-up Stretch Sub-Exercises Panel ────────────────────────────────────

interface WakeupStretchPanelProps {
    parentName: string;
    parentDuration: string;
    sessionName: string;
    sectionLabel: string;
    isExerciseDone: (exercise: string, session: string, section: string) => boolean;
    onToggleExercise: (exercise: string, session: string, section: string, duration: string) => void;
    accentColor: string;
    isPending: boolean;
}

function WakeupStretchPanel({
    parentName, parentDuration, sessionName, sectionLabel,
    isExerciseDone, onToggleExercise, accentColor, isPending,
}: WakeupStretchPanelProps) {
    const subKey = (sub: string) => `${parentName} › ${sub}`;
    const allDone = WAKEUP_STRETCH_SUBS.every(s => isExerciseDone(subKey(s.name), sessionName, sectionLabel));
    const parentDone = isExerciseDone(parentName, sessionName, sectionLabel);

    useEffect(() => {
        if (allDone && !parentDone && !isPending) {
            onToggleExercise(parentName, sessionName, sectionLabel, parentDuration);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allDone, parentDone]);

    return (
        <div className="px-3 pb-3 pt-2 border-t border-border/50 space-y-1">
            {WAKEUP_STRETCH_SUBS.map((sub) => {
                const key = subKey(sub.name);
                const done = isExerciseDone(key, sessionName, sectionLabel);
                return (
                    <div
                        key={sub.name}
                        className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors",
                            done && "bg-emerald-500/5"
                        )}
                    >
                        <span className="text-sm w-5 text-center shrink-0">{sub.icon}</span>
                        <span className={cn("flex-1 text-xs", done && "line-through text-muted-foreground")}>{sub.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{sub.duration}</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isPending) onToggleExercise(key, sessionName, sectionLabel, sub.duration);
                            }}
                            className={cn(
                                "w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all",
                                done
                                    ? "bg-emerald-500 text-white"
                                    : "border border-border hover:border-current"
                            )}
                            style={!done ? { color: accentColor } : undefined}
                            disabled={isPending}
                        >
                            {done ? <Check className="w-3.5 h-3.5" /> : <Check className="w-3 h-3 opacity-30" />}
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Exercise Detail Panel ───────────────────────────────────────────────────

interface ExerciseDetailProps {
    exercise: Exercise | null;
    planExercise?: PlanExercise;
    accentColor: string;
}

function ExerciseDetail({ exercise, planExercise, accentColor }: ExerciseDetailProps) {
    const { t, language } = useTranslation();

    if (!exercise && !planExercise) return null;

    const tData = (text: string | undefined, field: keyof typeof TRAINING_TRANSLATIONS_EN[string], fallback: string | undefined) => {
        if (!text && !fallback) return '';
        if (language === 'en' && text) {
            const trans = TRAINING_TRANSLATIONS_EN[text];
            if (trans && trans[field]) return trans[field] as string;
        }
        return fallback || '';
    };

    const exName = exercise?.name || planExercise?.name || '';
    const desc = tData(exName, 'description', exercise?.description) || tData(exName, 'why', exercise?.why) || '';
    const prog = tData(exName, 'progression', exercise?.progression);
    const muscles = tData(exName, 'muscles', exercise?.muscles);
    const steps = tData(exName, 'steps', exercise?.steps);
    const ytQuery = exercise?.youtubeQuery;

    // Don't show youtube for app/bike exercises
    const isAppOrBike = exercise?.icon === '📱' || exercise?.icon === '🚲' || exercise?.icon === '🚴' ||
        (exercise?.name || '').toLowerCase().includes('madmuscles') ||
        (exercise?.name || '').toLowerCase().includes('yoga go') ||
        (exercise?.name || '').toLowerCase().includes('cyclette');

    return (
        <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-2 text-xs text-muted-foreground leading-relaxed">
            {desc && <p dangerouslySetInnerHTML={{ __html: desc }} />}
            {steps && <p className="text-foreground/80">{steps}</p>}
            {prog && (
                <div className="bg-background rounded-md px-2.5 py-2">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <div className="font-mono text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: accentColor }}>{t('trainingProgression' as any)}</div>
                    <div className="text-foreground/70">{prog}</div>
                </div>
            )}
            {muscles && (
                <div className="text-[10px]">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <b className="text-foreground/50">{t('trainingMuscles' as any)}:</b> {muscles}
                </div>
            )}
            {ytQuery && !isAppOrBike && (
                <a
                    href={`https://www.youtube.com/results?search_query=${ytQuery}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 font-semibold text-[11px] transition-colors"
                >
                    <ExternalLink className="w-3 h-3" />
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {t('trainingYoutubeSearch' as any)}
                </a>
            )}
        </div>
    );
}
