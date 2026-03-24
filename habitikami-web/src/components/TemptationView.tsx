import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { habitService } from '../services/HabitService';
import { cn } from '../lib/utils';
import { useTranslation } from '../i18n';

const IconRenderer = ({ name, size = 24, className = "" }: { name: string, size?: number, className?: string }) => {
    const IconComponent = (Icons as any)[name] || Icons.HelpCircle;
    return <IconComponent size={size} className={className} />;
};

export const TemptationView = () => {
    const { t } = useTranslation();
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [actionId, setActionId] = useState<string | null>(null);
    const [temptations, setTemptations] = useState<any[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        habitService.getTemptations().then(setTemptations);
    }, []);

    const activeTemptation = temptations[selectedIndex];

    const handleAction = async (action: any) => {
        setActionId(action.id);
        setStatus('loading');
        setErrorMessage(null);
        try {
            // We use the ID as the counter name
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

    if (!activeTemptation) return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-muted-foreground" />
        </div>
    );

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

            {/* Action buttons - centered in remaining space */}
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
                                            {action?.icon === 'skull' ? (
                                                <div className="text-7xl md:text-8xl">💀</div>
                                            ) : (
                                                <IconRenderer name={action?.icon} size={80} className="md:w-24 md:h-24" />
                                            )}
                                        </div>
                                        {/* Check or X badge */}
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
                                            className="absolute -bottom-2 -right-2"
                                        >
                                            {isPositive ? (
                                                <CheckCircle2 size={48} className="text-green-400 drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 8px rgba(74, 222, 128, 0.6))' }} />
                                            ) : (
                                                <XCircle size={48} className="text-red-400 drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 8px rgba(248, 113, 113, 0.6))' }} />
                                            )}
                                        </motion.div>
                                    </div>
                                    <h3 className="text-3xl md:text-4xl font-black">
                                        {action?.id === 'smoke' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeSuccessResist') :
                                         action?.id === 'smoked' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeSuccessSmoke') :
                                         action?.label}
                                    </h3>
                                    <p className="text-muted-foreground text-center text-lg">
                                        {action?.id === 'smoke' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeSuccessResistMsg') :
                                         action?.id === 'smoked' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeSuccessSmokeMsg') :
                                         "Great job!"}
                                    </p>
                                </motion.div>
                            );
                        })()
                    ) : (
                        <div className="flex flex-col gap-6 items-center w-full max-w-lg">
                            {/* Primary (positive) actions - BIG buttons */}
                            {activeTemptation.actions.filter((a: any) => a.type === 'positive').map((action: any) => (
                                <motion.button
                                    key={action.id}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleAction(action)}
                                    disabled={status === 'loading'}
                                    className={cn(
                                        "relative group w-44 h-44 md:w-56 md:h-56 rounded-full flex flex-col items-center justify-center gap-3",
                                        "transition-all border-4",
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
                                        <Loader2 className="w-16 h-16 animate-spin" />
                                    ) : (
                                        <>
                                            <IconRenderer name={action.icon} size={72} className="md:w-20 md:h-20 drop-shadow-md" />
                                            <span className="text-xl md:text-2xl font-black tracking-tight drop-shadow-md">
                                                {action.id === 'smoke' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeResisted') : action.label}
                                            </span>
                                        </>
                                    )}
                                    <span className="absolute inset-0 rounded-full animate-ping opacity-20 duration-1000" style={{ backgroundColor: action.color }} />
                                </motion.button>
                            ))}

                            {/* Secondary (negative/neutral) actions - slightly smaller but still big */}
                            <div className="flex flex-wrap justify-center gap-5">
                                {activeTemptation.actions.filter((a: any) => a.type !== 'positive').map((action: any) => (
                                    <motion.button
                                        key={action.id}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleAction(action)}
                                        disabled={status === 'loading'}
                                        className={cn(
                                            "relative group w-32 h-32 md:w-40 md:h-40 rounded-full flex flex-col items-center justify-center gap-2",
                                            "transition-all border-4",
                                            status === 'loading' && "opacity-80 cursor-wait"
                                        )}
                                        style={{
                                            background: `linear-gradient(to bottom right, ${action.color}, ${action.color}bb)`,
                                            borderColor: `${action.color}4d`,
                                            boxShadow: `0 10px 40px -10px ${action.color}80`,
                                            color: 'white'
                                        }}
                                    >
                                        {status === 'loading' && actionId === action.id ? (
                                            <Loader2 className="w-10 h-10 animate-spin" />
                                        ) : (
                                            <>
                                                {action.icon && <IconRenderer name={action.icon} size={44} className="md:w-12 md:h-12 drop-shadow-md" />}
                                                <span className="text-base md:text-lg font-bold tracking-tight drop-shadow-md">
                                                    {action.id === 'smoked' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeSmoked') :
                                                     action.id === 'coffee' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeCoffee') :
                                                     action.label}
                                                </span>
                                            </>
                                        )}
                                    </motion.button>
                                ))}
                            </div>
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
