import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, Settings, Flame, ShieldCheck, ThumbsDown } from 'lucide-react';
import { habitService } from '../services/HabitService';
import { cn } from '../lib/utils';
import { useTranslation } from '../i18n';

const POSITIVE_PHRASES = [
    "You're stronger than you think!",
    "One more victory under your belt!",
    "Your future self thanks you!",
    "Willpower level: legendary!",
    "That's the spirit! Keep going!",
    "You chose yourself today!",
    "Discipline is freedom!",
];

const NEGATIVE_PHRASES = [
    "You are the worst!",
    "Tomorrow is a new chance...",
    "Don't let this define you.",
    "Get back up. You've got this.",
    "One slip doesn't erase your progress.",
    "Acknowledge it. Move forward.",
    "Fall seven times, stand up eight.",
];

const getRandomPhrase = (phrases: string[]) => phrases[Math.floor(Math.random() * phrases.length)];

export const TemptationView = () => {
    const { t } = useTranslation();
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [actionId, setActionId] = useState<string | null>(null);
    const [temptations, setTemptations] = useState<any[] | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [successPhrase, setSuccessPhrase] = useState('');

    useEffect(() => {
        habitService.getTemptations().then(setTemptations);
    }, []);

    const activeTemptation = temptations?.[selectedIndex];

    const handleAction = async (action: any) => {
        setActionId(action.id);
        setStatus('loading');
        setErrorMessage(null);

        const isPositive = action.type === 'positive' || action.type === 'resist';
        setSuccessPhrase(getRandomPhrase(isPositive ? POSITIVE_PHRASES : NEGATIVE_PHRASES));

        try {
            const result = await habitService.incrementCounter(action.id);
            if (result && result.error) {
                setStatus('error');
                setErrorMessage(result.error);
            } else {
                setStatus('success');
                setTimeout(() => window.location.reload(), 3000);
            }
        } catch (e: any) {
            setStatus('error');
            setErrorMessage(e.message || t('helpGenericError'));
        }
    };

    // Loading
    if (temptations === null) return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-muted-foreground" />
        </div>
    );

    // No temptations configured
    if (temptations.length === 0) return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4">
            <Flame className="w-16 h-16 text-muted-foreground/40" />
            <h2 className="text-2xl font-bold text-foreground">{t('tabSmokeTemptation')}</h2>
            <p className="text-muted-foreground max-w-sm">
                No temptations configured yet. Go to <strong>Settings</strong> to add your first temptation tracker.
            </p>
            <div className="flex items-center gap-2 text-primary">
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">Menu &rarr; Settings &rarr; Temptations</span>
            </div>
        </div>
    );

    if (!activeTemptation) return null;

    // Sort actions: positive/resist first, then negative/succumb, then others
    const sortedActions = [...activeTemptation.actions].sort((a: any, b: any) => {
        const order = (type: string) => type === 'positive' || type === 'resist' ? 0 : type === 'negative' || type === 'succumb' ? 1 : 2;
        return order(a.type) - order(b.type);
    });

    const getButtonIcon = (action: any, size: number) => {
        const isPositive = action.type === 'positive' || action.type === 'resist';
        const isNegative = action.type === 'negative' || action.type === 'succumb';
        if (isPositive) return <ShieldCheck size={size} className="drop-shadow-md" />;
        if (isNegative) return <ThumbsDown size={size} className="drop-shadow-md" />;
        return <Flame size={size} className="drop-shadow-md" />;
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-red-900/10 to-stone-900/10 dark:from-red-950/30 dark:to-stone-950/30 overflow-y-auto">
            {/* Title - pinned at top */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center pt-6 pb-2 px-4 shrink-0"
            >
                {temptations.length > 1 && (
                    <div className="flex justify-center gap-2 mb-3">
                        {temptations.map((t: any, i: number) => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedIndex(i)}
                                className={cn(
                                    "px-4 py-1.5 rounded-full text-sm transition-all",
                                    selectedIndex === i
                                        ? "bg-primary text-primary-foreground font-bold"
                                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                                )}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}
                <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">
                    {activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking' ? t('smokeFeeling') : activeTemptation.label}
                </h2>
                <p className="text-muted-foreground text-base md:text-lg mt-1">
                    {activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking' ? t('smokeStronger') : "Stay strong!"}
                </p>
            </motion.div>

            {/* Action buttons - centered in remaining space, VERTICAL layout */}
            <div className="flex-1 flex items-center justify-center px-4 py-4">
                <AnimatePresence mode="wait">
                    {status === 'success' ? (
                        (() => {
                            const action = activeTemptation.actions.find((a: any) => a.id === actionId);
                            const isPositive = action?.type === 'positive' || action?.type === 'resist';
                            return (
                                <motion.div
                                    key={`success-${actionId}`}
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className="flex flex-col items-center gap-5"
                                    style={{ color: action?.color || 'var(--color-primary)' }}
                                >
                                    <div className="relative">
                                        <div
                                            className="p-8 md:p-10 rounded-full border-2"
                                            style={{
                                                backgroundColor: `${action?.color}1a`,
                                                borderColor: `${action?.color}33`,
                                                boxShadow: `0 0 60px -5px ${action?.color}`
                                            }}
                                        >
                                            {isPositive ? (
                                                <CheckCircle2 size={80} className="md:w-24 md:h-24" />
                                            ) : (
                                                <XCircle size={80} className="md:w-24 md:h-24" />
                                            )}
                                        </div>
                                    </div>
                                    <h3 className="text-3xl md:text-4xl font-black">
                                        {action?.id === 'smoke' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeSuccessResist') :
                                         action?.id === 'smoked' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeSuccessSmoke') :
                                         action?.label}
                                    </h3>
                                    <p className="text-muted-foreground text-center text-lg italic max-w-xs">
                                        {successPhrase}
                                    </p>
                                </motion.div>
                            );
                        })()
                    ) : (
                        <div className="flex flex-col gap-6 items-center w-full max-w-lg">
                            {sortedActions.map((action: any) => {
                                const isPrimary = action.type === 'positive' || action.type === 'resist';
                                return (
                                    <motion.button
                                        key={action.id}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleAction(action)}
                                        disabled={status === 'loading'}
                                        className={cn(
                                            "relative group rounded-full flex flex-col items-center justify-center transition-all border-4",
                                            isPrimary
                                                ? "w-44 h-44 md:w-56 md:h-56 gap-3"
                                                : "w-36 h-36 md:w-44 md:h-44 gap-2",
                                            status === 'loading' && "opacity-80 cursor-wait"
                                        )}
                                        style={{
                                            background: `linear-gradient(to bottom right, ${action.color}, ${action.color}bb)`,
                                            borderColor: `${action.color}4d`,
                                            boxShadow: `0 10px 50px -10px ${action.color}80`,
                                            color: 'white'
                                        }}
                                    >
                                        {status === 'loading' && actionId === action.id ? (
                                            <Loader2 className={cn(isPrimary ? "w-16 h-16" : "w-12 h-12", "animate-spin")} />
                                        ) : (
                                            <>
                                                {getButtonIcon(action, isPrimary ? 72 : 52)}
                                                <span className={cn(
                                                    "font-black tracking-tight drop-shadow-md",
                                                    isPrimary ? "text-xl md:text-2xl" : "text-lg md:text-xl"
                                                )}>
                                                    {action.id === 'smoke' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeResisted') :
                                                     action.id === 'smoked' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeSmoked') :
                                                     action.id === 'coffee' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeCoffee') :
                                                     action.label}
                                                </span>
                                            </>
                                        )}
                                        {isPrimary && (
                                            <span className="absolute inset-0 rounded-full animate-ping opacity-20 duration-1000" style={{ backgroundColor: action.color }} />
                                        )}
                                    </motion.button>
                                );
                            })}
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {status === 'error' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mx-4 mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm text-center"
                >
                    {t('error')}: {errorMessage}
                </motion.div>
            )}

            <p className="text-sm text-muted-foreground/60 italic text-center pb-4 px-4 shrink-0">
                {t('smokeQuote')}
            </p>
        </div>
    );
};
