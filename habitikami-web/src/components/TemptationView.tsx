import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Loader2 } from 'lucide-react';
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
        <div className="flex flex-col items-center justify-center h-full p-4 bg-gradient-to-br from-red-900/10 to-stone-900/10 dark:from-red-950/30 dark:to-stone-950/30">
            <div className="text-center space-y-8 max-w-md w-full">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    {temptations.length > 1 && (
                        <div className="flex justify-center gap-2 mb-4">
                            {temptations.map((t: any, i: number) => (
                                <button
                                    key={t.id}
                                    onClick={() => setSelectedIndex(i)}
                                    className={cn(
                                        "px-4 py-1 rounded-full text-sm transition-all",
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
                    <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                        {activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking' ? t('smokeFeeling') : activeTemptation.label}
                    </h2>
                    <p className="text-muted-foreground text-lg">
                        {activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking' ? t('smokeStronger') : "Stay strong!"}
                    </p>
                </motion.div>

                <div className="relative flex justify-center py-8">
                    <AnimatePresence mode="wait">
                        {status === 'success' ? (
                            (() => {
                                const action = activeTemptation.actions.find((a: any) => a.id === actionId);
                                return (
                                    <motion.div
                                        key={`success-${actionId}`}
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.8, opacity: 0 }}
                                        className="flex flex-col items-center gap-4"
                                        style={{ color: action?.color || 'var(--color-primary)' }}
                                    >
                                        <div 
                                            className="p-6 rounded-full border-2"
                                            style={{ 
                                                backgroundColor: `${action?.color}1a`, 
                                                borderColor: `${action?.color}33`,
                                                boxShadow: `0 0 40px -5px ${action?.color}`
                                            }}
                                        >
                                            {action?.icon === 'skull' ? (
                                                <div className="text-6xl">💀</div>
                                            ) : (
                                                <IconRenderer name={action?.icon} size={64} />
                                            )}
                                        </div>
                                        <h3 className="text-2xl font-bold">
                                            {action?.id === 'smoke' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeSuccessResist') : 
                                             action?.id === 'smoked' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeSuccessSmoke') : 
                                             action?.label}
                                        </h3>
                                        <p className="text-muted-foreground text-center">
                                            {action?.id === 'smoke' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeSuccessResistMsg') : 
                                             action?.id === 'smoked' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeSuccessSmokeMsg') : 
                                             "Great job!"}
                                        </p>
                                    </motion.div>
                                );
                            })()
                        ) : (
                            <div className="flex flex-col gap-8 items-center">
                                {activeTemptation.actions.filter((a: any) => a.type === 'positive').map((action: any) => (
                                    <motion.button
                                        key={action.id}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleAction(action)}
                                        disabled={status === 'loading'}
                                        className={cn(
                                            "relative group w-36 h-36 md:w-48 md:h-48 rounded-full flex flex-col items-center justify-center gap-2",
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
                                            <Loader2 className="w-12 h-12 animate-spin" />
                                        ) : (
                                            <>
                                                <IconRenderer name={action.icon} size={64} className="drop-shadow-md" />
                                                <span className="text-xl font-bold tracking-tight drop-shadow-md">
                                                    {action.id === 'smoke' && (activeTemptation.label === 'Temptations' || activeTemptation.label === 'Smoking') ? t('smokeResisted') : action.label}
                                                </span>
                                            </>
                                        )}
                                        <span className="absolute inset-0 rounded-full animate-ping opacity-20 duration-1000" style={{ backgroundColor: action.color }} />
                                    </motion.button>
                                ))}

                                <div className="flex flex-wrap justify-center gap-4">
                                    {activeTemptation.actions.filter((a: any) => a.type !== 'positive').map((action: any) => (
                                        <motion.button
                                            key={action.id}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handleAction(action)}
                                            disabled={status === 'loading'}
                                            className={cn(
                                                "relative group w-24 h-24 md:w-32 md:h-32 rounded-full flex flex-col items-center justify-center gap-1",
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
                                                <Loader2 className="w-8 h-8 animate-spin" />
                                            ) : (
                                                <>
                                                    {action.icon && <IconRenderer name={action.icon} size={32} className="drop-shadow-md" />}
                                                    <span className="text-sm font-bold tracking-tight drop-shadow-md">
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

                {
                    status === 'error' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm"
                        >
                            {t('error')}: {errorMessage}
                        </motion.div>
                    )
                }

                <p className="text-sm text-muted-foreground/60 italic">
                    {t('smokeQuote')}
                </p>
            </div >
        </div >
    );
};
