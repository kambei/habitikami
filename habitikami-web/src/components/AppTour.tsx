import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Home, CheckSquare, BarChart2, StickyNote, Flame, Hash, HeartHandshake, Menu, Coffee } from 'lucide-react';
import { useTranslation } from '../i18n';
import type { ViewType } from '../types';

const TOUR_KEY = 'habitikami_tour_completed';

/** Phases within each tour step */
type TourPhase = 'opening-menu' | 'showing-menu' | 'closing-menu' | 'showing-card';

interface TourStep {
    titleKey: string;
    descKey: string;
    icon: React.ElementType;
    navigateTo?: ViewType;
    /** If true, skip the menu open/close sequence and jump straight to card */
    skipMenu?: boolean;
}

const TOUR_STEPS: TourStep[] = [
    { titleKey: 'tourWelcomeTitle', descKey: 'tourWelcomeDesc', icon: Home, skipMenu: true },
    { titleKey: 'tourWeekdaysTitle', descKey: 'tourWeekdaysDesc', icon: Home, navigateTo: 'Weekdays' },
    { titleKey: 'tourFocusTitle', descKey: 'tourFocusDesc', icon: CheckSquare, navigateTo: 'Focus' },
    { titleKey: 'tourStatsTitle', descKey: 'tourStatsDesc', icon: BarChart2, navigateTo: 'Graphs' },
    { titleKey: 'tourNotesTitle', descKey: 'tourNotesDesc', icon: StickyNote, navigateTo: 'MobNotes' },
    { titleKey: 'tourSmokeTitle', descKey: 'tourSmokeDesc', icon: Flame, navigateTo: 'SmokeTemptation' },
    { titleKey: 'tourCountersTitle', descKey: 'tourCountersDesc', icon: Hash, navigateTo: 'Counters' },
    { titleKey: 'tourHelpTitle', descKey: 'tourHelpDesc', icon: HeartHandshake, navigateTo: 'Help' },
    { titleKey: 'tourMenuTitle', descKey: 'tourMenuDesc', icon: Menu, skipMenu: true },
    { titleKey: 'tourDoneTitle', descKey: 'tourDoneDesc', icon: Coffee, skipMenu: true },
];

/** Timing constants (ms) */
const MENU_OPEN_DELAY = 400;   // wait before highlighting after menu opens
const MENU_SHOW_DURATION = 1400; // how long the menu stays open with highlight
const MENU_CLOSE_DELAY = 400;  // wait after menu closes before showing card

interface AppTourProps {
    onNavigate: (tab: ViewType) => void;
    onComplete: () => void;
    onHighlightChange?: (tab: ViewType | null) => void;
    onMenuToggle?: (open: boolean) => void;
}

export function AppTour({ onNavigate, onComplete, onHighlightChange, onMenuToggle }: AppTourProps) {
    const { t } = useTranslation();
    const [step, setStep] = useState(0);
    const [phase, setPhase] = useState<TourPhase>('showing-card');
    const [isTransitioning, setIsTransitioning] = useState(false);

    const current = TOUR_STEPS[step];
    const isLast = step === TOUR_STEPS.length - 1;
    const isFirst = step === 0;

    /** Run the phased menu sequence for a given step */
    const runMenuSequence = useCallback((stepIndex: number) => {
        const stepData = TOUR_STEPS[stepIndex];

        if (stepData.skipMenu || !stepData.navigateTo) {
            // No menu sequence — go straight to card
            if (stepData.navigateTo) {
                onNavigate(stepData.navigateTo);
            }
            onHighlightChange?.(null);
            onMenuToggle?.(false);
            setPhase('showing-card');
            setIsTransitioning(false);
            return;
        }

        // Navigate to the tab first
        onNavigate(stepData.navigateTo);

        // Phase 1: Open menu
        setPhase('opening-menu');
        onMenuToggle?.(true);

        const t1 = setTimeout(() => {
            // Phase 2: Highlight the tab in the menu
            setPhase('showing-menu');
            onHighlightChange?.(stepData.navigateTo!);

            const t2 = setTimeout(() => {
                // Phase 3: Close menu
                setPhase('closing-menu');
                onHighlightChange?.(null);
                onMenuToggle?.(false);

                const t3 = setTimeout(() => {
                    // Phase 4: Show the card
                    setPhase('showing-card');
                    setIsTransitioning(false);
                }, MENU_CLOSE_DELAY);

                return () => clearTimeout(t3);
            }, MENU_SHOW_DURATION);

            return () => clearTimeout(t2);
        }, MENU_OPEN_DELAY);

        return () => clearTimeout(t1);
    }, [onNavigate, onHighlightChange, onMenuToggle]);

    // Run sequence when step changes
    useEffect(() => {
        setIsTransitioning(true);
        const cleanup = runMenuSequence(step);
        return () => {
            if (typeof cleanup === 'function') cleanup();
        };
    }, [step]);

    const handleNext = () => {
        if (isTransitioning) return;
        if (isLast) {
            handleComplete();
        } else {
            setStep(s => s + 1);
        }
    };

    const handlePrev = () => {
        if (isTransitioning) return;
        if (!isFirst) setStep(s => s - 1);
    };

    const handleComplete = () => {
        localStorage.setItem(TOUR_KEY, 'true');
        onHighlightChange?.(null);
        onMenuToggle?.(false);
        onComplete();
    };

    const Icon = current.icon;

    const showCard = phase === 'showing-card';

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pointer-events-none">
            {/* Backdrop — always visible during tour */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/30 pointer-events-auto"
                onClick={handleComplete}
            />

            {/* Tour Card — only visible in showing-card phase */}
            <AnimatePresence mode="wait">
                {showCard && (
                    <motion.div
                        key={`card-${step}`}
                        initial={{ opacity: 0, y: 30, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -15, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 pointer-events-auto z-10"
                    >
                        {/* Close */}
                        <button
                            onClick={handleComplete}
                            className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Icon */}
                        <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                            <Icon className="w-7 h-7 text-primary" />
                        </div>

                        {/* Content */}
                        <h3 className="text-lg font-bold text-foreground mb-2">
                            {t(current.titleKey as any)}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                            {t(current.descKey as any)}
                        </p>

                        {/* Progress & Nav */}
                        <div className="flex items-center justify-between">
                            <div className="flex gap-1">
                                {TOUR_STEPS.map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-2 h-2 rounded-full transition-colors ${
                                            i === step ? 'bg-primary' : i < step ? 'bg-primary/40' : 'bg-muted'
                                        }`}
                                    />
                                ))}
                            </div>

                            <div className="flex gap-2">
                                {!isFirst && (
                                    <button
                                        onClick={handlePrev}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                        {t('prev')}
                                    </button>
                                )}
                                <button
                                    onClick={handleNext}
                                    className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                >
                                    {isLast ? t('tourFinish') : t('next')}
                                    {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Menu phase indicator — small pulsing dot when menu is doing its sequence */}
            <AnimatePresence>
                {!showCard && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="absolute bottom-8 flex flex-col items-center gap-3 pointer-events-none z-10"
                    >
                        <motion.div
                            animate={{ scale: [1, 1.3, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="w-3 h-3 rounded-full bg-primary shadow-lg shadow-primary/50"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function shouldShowTour(): boolean {
    return !localStorage.getItem(TOUR_KEY);
}
