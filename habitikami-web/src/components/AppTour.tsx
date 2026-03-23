import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Home, CheckSquare, BarChart2, StickyNote, Flame, Hash, HeartHandshake, Menu, Coffee } from 'lucide-react';
import { useTranslation } from '../i18n';
import type { ViewType } from '../types';

const TOUR_KEY = 'habitikami_tour_completed';

interface TourStep {
    titleKey: string;
    descKey: string;
    icon: React.ElementType;
    navigateTo?: ViewType;
}

const TOUR_STEPS: TourStep[] = [
    { titleKey: 'tourWelcomeTitle', descKey: 'tourWelcomeDesc', icon: Home },
    { titleKey: 'tourWeekdaysTitle', descKey: 'tourWeekdaysDesc', icon: Home, navigateTo: 'Weekdays' },
    { titleKey: 'tourFocusTitle', descKey: 'tourFocusDesc', icon: CheckSquare, navigateTo: 'Focus' },
    { titleKey: 'tourStatsTitle', descKey: 'tourStatsDesc', icon: BarChart2, navigateTo: 'Graphs' },
    { titleKey: 'tourNotesTitle', descKey: 'tourNotesDesc', icon: StickyNote, navigateTo: 'MobNotes' },
    { titleKey: 'tourSmokeTitle', descKey: 'tourSmokeDesc', icon: Flame, navigateTo: 'SmokeTemptation' },
    { titleKey: 'tourCountersTitle', descKey: 'tourCountersDesc', icon: Hash, navigateTo: 'Counters' },
    { titleKey: 'tourHelpTitle', descKey: 'tourHelpDesc', icon: HeartHandshake, navigateTo: 'Help' },
    { titleKey: 'tourMenuTitle', descKey: 'tourMenuDesc', icon: Menu },
    { titleKey: 'tourDoneTitle', descKey: 'tourDoneDesc', icon: Coffee },
];

interface AppTourProps {
    onNavigate: (tab: ViewType) => void;
    onComplete: () => void;
}

export function AppTour({ onNavigate, onComplete }: AppTourProps) {
    const { t } = useTranslation();
    const [step, setStep] = useState(0);

    const current = TOUR_STEPS[step];
    const isLast = step === TOUR_STEPS.length - 1;
    const isFirst = step === 0;

    useEffect(() => {
        if (current.navigateTo) {
            onNavigate(current.navigateTo);
        }
    }, [step]);

    const handleNext = () => {
        if (isLast) {
            handleComplete();
        } else {
            setStep(s => s + 1);
        }
    };

    const handlePrev = () => {
        if (!isFirst) setStep(s => s - 1);
    };

    const handleComplete = () => {
        localStorage.setItem(TOUR_KEY, 'true');
        onComplete();
    };

    const Icon = current.icon;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pointer-events-none">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
                onClick={handleComplete}
            />

            {/* Tour Card */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.25 }}
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
            </AnimatePresence>
        </div>
    );
}

export function shouldShowTour(): boolean {
    return !localStorage.getItem(TOUR_KEY);
}
