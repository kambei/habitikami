import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, ExternalLink } from 'lucide-react';
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

// Helper: get section key from exercise name (for plan exercises)
function guessSectionForPlanExercise(planEx: PlanExercise): string {
    const n = planEx.name.toLowerCase();
    if (n.includes('stretch') || planEx.icon === '🧘') return 'stretch';
    if (n.includes('aiki') || planEx.icon === '🥋') return 'aikido';
    if (n.includes('shaolin') || n.includes('horse stance') || n.includes('palmi uniti') || n.includes('mani intrecciate') || planEx.icon === '🐉') return 'shaolin';
    if (n.includes('sedia') || n.includes('seated') || planEx.icon === '🪑') return 'chair';
    if (n.includes('respirazione') || n.includes('craving') || planEx.icon === '🌬️') return 'craving';
    if (n.includes('cyclette') || planEx.icon === '🚴') return 'plan';
    if (n.includes('bici') || planEx.icon === '🚲') return 'plan';
    if (n.includes('corda') || planEx.icon === '🪢') return 'plan';
    return 'iso';
}

function getSectionForExercise(sectionKey: string): string {
    const sec = SECTIONS.find(s => s.key === sectionKey);
    return sec?.label || sectionKey;
}

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
                { onError: () => toast.error('Failed to undo') }
            );
        } else {
            logMutation.mutate(
                { date: todayStr, section, exercise, session, duration },
                { onSuccess: () => toast.success(`✓ ${exercise}`, { duration: 1500 }) }
            );
        }
    };

    const currentSection = SECTIONS.find(s => s.key === activeSection)!;
    const accentColor = currentSection?.color || '#FF6B35';

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{ '--training-accent': accentColor } as React.CSSProperties}>
            {/* Section tabs */}
            <div className="flex overflow-x-auto border-b border-border bg-card/50 backdrop-blur shrink-0 scrollbar-hide">
                {SECTIONS.map(sec => (
                    <button
                        key={sec.key}
                        onClick={() => { setActiveSection(sec.key); setExpandedId(null); }}
                        className={cn(
                            "flex flex-col items-center px-3 py-2 min-w-0 flex-1 text-[10px] font-semibold transition-all border-b-2 whitespace-nowrap",
                            activeSection === sec.key
                                ? "border-current text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground/70"
                        )}
                        style={activeSection === sec.key ? { color: sec.color } : undefined}
                    >
                        <span className="text-base leading-none mb-0.5">{sec.icon}</span>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {t(`training${sec.key.charAt(0).toUpperCase() + sec.key.slice(1)}` as any) || sec.label}
                    </button>
                ))}
            </div>

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
                {activeSection === 'plan' ? (
                    <PlanView
                        selectedDay={selectedDay}
                        onDayChange={setSelectedDay}
                        expandedId={expandedId}
                        onToggleExpand={setExpandedId}
                        isExerciseDone={isExerciseDone}
                        onToggleExercise={handleToggleExercise}
                        todayStr={todayStr}
                        accentColor={accentColor}
                        isPending={logMutation.isPending || removeMutation.isPending}
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
                        isPending={logMutation.isPending || removeMutation.isPending}
                    />
                )}
            </div>
        </div>
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
}

function PlanView({ selectedDay, onDayChange, expandedId, onToggleExpand, isExerciseDone, onToggleExercise, accentColor, isPending }: PlanViewProps) {
    const { t } = useTranslation();
    const dayInfo = DAYS.find(d => d.key === selectedDay)!;
    const isWeekend = selectedDay === 'sab' || selectedDay === 'dom';
    const morningPlan = MORNING_PLANS[selectedDay];
    const afternoonPlan = AFTERNOON_PLANS[selectedDay];

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
                <div className="text-lg font-extrabold">{dayInfo.labelFull}</div>
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
                label={isWeekend ? `⚡ ${t('trainingSingle' as any)}` : `🌅 ${t('trainingMorning' as any)}`}
                plan={morningPlan}
                sessionName={isWeekend ? 'Unica' : 'Mattina'}
                expandedId={expandedId}
                onToggleExpand={onToggleExpand}
                idPrefix="mo"
                isExerciseDone={isExerciseDone}
                onToggleExercise={onToggleExercise}
                accentColor={accentColor}
                isPending={isPending}
            />

            {/* Afternoon (weekdays only) */}
            {!isWeekend && afternoonPlan && (
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
                />
            )}

            {/* Tips */}
            <div className="text-xs text-muted-foreground bg-card border border-border rounded-lg p-3 leading-relaxed border-l-2" style={{ borderLeftColor: accentColor }}>
                <b>💡 Regole isometrici:</b> Tensione graduale 2-3s → mantieni → rilascio 2-3s. Respira sempre.
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
}

function SessionBlock({ label, plan, sessionName, expandedId, onToggleExpand, idPrefix, isExerciseDone, onToggleExercise, accentColor, isPending }: SessionBlockProps) {
    const completedCount = plan.exercises.filter(ex => {
        const sec = getSectionForExercise(guessSectionForPlanExercise(ex));
        return isExerciseDone(ex.name, sessionName, sec);
    }).length;

    return (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2.5 flex justify-between items-center border-b border-border"
                style={{ backgroundColor: `${accentColor}08` }}>
                <div>
                    <span className="font-bold text-sm">{label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{plan.title}</span>
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
                const sectionLabel = getSectionForExercise(guessSectionForPlanExercise(ex));
                const done = isExerciseDone(ex.name, sessionName, sectionLabel);

                return (
                    <div key={id} className={cn("border-t border-border/50 transition-colors", done && "bg-emerald-500/5")}>
                        <div
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-foreground/[0.02] transition-colors"
                            onClick={() => onToggleExpand(isExpanded ? null : id)}
                        >
                            <span className="text-base w-6 text-center shrink-0">{ex.icon}</span>
                            <span className={cn("flex-1 text-sm", done && "line-through text-muted-foreground")}>{ex.name}</span>
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
                                    <ExerciseDetail exercise={catalogEx} planExercise={ex} accentColor={accentColor} />
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
    const { t } = useTranslation();
    const exercises = SECTION_CATALOG[sectionKey] || [];
    const sectionLabel = getSectionForExercise(sectionKey);

    if (exercises.length === 0) {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        return <div className="text-center text-muted-foreground py-8">{t('trainingNoExercises' as any)}</div>;
    }

    return (
        <>
            {/* Section intro */}
            {sectionKey === 'stretch' && (
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    16 esercizi — fai i primi 5-8 come warmup (5 min) o tutti come cooldown sul tappetino (10 min).
                </p>
            )}
            {sectionKey === 'chair' && (
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    8 esercizi alla scrivania. Zero attrezzatura. Circuito 6-10 min ogni 2 ore di lavoro seduto.
                </p>
            )}
            {sectionKey === 'aikido' && (
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    11 esercizi Aikido eseguibili <b className="text-foreground">completamente da soli</b> (Aiki Taiso e Hitori-waza).
                </p>
            )}
            {sectionKey === 'shaolin' && (
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    8 esercizi isometrici dalla tradizione Shaolin. Il corpo come unica resistenza.
                </p>
            )}
            {sectionKey === 'iso' && (
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    Esercizi Isometrici fondamentali: la tensione senza movimento costruisce forza e resistenza.
                </p>
            )}
            {sectionKey === 'craving' && (
                <div className="text-xs bg-card border border-border rounded-lg p-3 leading-relaxed mb-2" style={{ borderLeftColor: accentColor, borderLeftWidth: 3 }}>
                    <b>🧠 Protocollo Anti-Craving:</b> Senti il craving → STOP → Gomma NRT 4mg → Scegli un esercizio → Fallo con intensità → 3 respiri 4-7-8 → Segna ✓
                </div>
            )}

            {exercises.map((ex, i) => {
                const id = `cat_${sectionKey}_${i}`;
                const isExpanded = expandedId === id;
                const done = isExerciseDone(ex.name, 'Catalogo', sectionLabel);

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
                                <div className={cn("font-bold text-sm", done && "line-through text-muted-foreground")}>{ex.name}</div>
                                {ex.target && <div className="text-[10px] mt-0.5" style={{ color: accentColor }}>{ex.target}</div>}
                                {ex.category && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-block" style={{ backgroundColor: `${accentColor}18`, color: accentColor }}>{ex.category}</span>}
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isPending) onToggleExercise(ex.name, 'Catalogo', sectionLabel, ex.duration || '');
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

// ─── Exercise Detail Panel ───────────────────────────────────────────────────

interface ExerciseDetailProps {
    exercise: Exercise | null;
    planExercise?: PlanExercise;
    accentColor: string;
}

function ExerciseDetail({ exercise, planExercise, accentColor }: ExerciseDetailProps) {
    const { t } = useTranslation();

    if (!exercise && !planExercise) return null;

    const desc = exercise?.description || exercise?.why || '';
    const prog = exercise?.progression;
    const muscles = exercise?.muscles;
    const steps = exercise?.steps;
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
                    Cerca video su YouTube
                </a>
            )}
        </div>
    );
}
