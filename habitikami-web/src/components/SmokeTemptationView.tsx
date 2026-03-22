import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Loader2, PartyPopper, Coffee } from 'lucide-react';
import { habitService } from '../services/HabitService';
import { cn } from '../lib/utils';
import { useTranslation } from '../i18n';

export const SmokeTemptationView = () => {
    const { t } = useTranslation();
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [actionType, setActionType] = useState<'resist' | 'smoke' | 'coffee' | null>(null);

    const handleResist = async () => {
        setActionType('resist');
        setStatus('loading');
        setErrorMessage(null);
        try {
            const result = await habitService.incrementCounter('smoke');
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

    const handleSmoke = async () => {
        setActionType('smoke');
        setStatus('loading');
        setErrorMessage(null);
        try {
            const result = await habitService.incrementCounter('smoked');
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

    const handleCoffee = async () => {
        setActionType('coffee');
        setStatus('loading');
        setErrorMessage(null);
        try {
            const result = await habitService.incrementCounter('coffee');
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

    return (
        <div className="flex flex-col items-center justify-center h-full p-4 bg-gradient-to-br from-red-900/10 to-stone-900/10 dark:from-red-950/30 dark:to-stone-950/30">
            <div className="text-center space-y-8 max-w-md w-full">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                >
                    <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                        {t('smokeFeeling')}
                    </h2>
                    <p className="text-muted-foreground text-lg">
                        {t('smokeStronger')}
                    </p>
                </motion.div>

                <div className="relative flex justify-center py-8">
                    <AnimatePresence mode="wait">
                        {status === 'success' ? (
                            actionType === 'smoke' ? (
                                <motion.div
                                    key="success-smoke"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className="flex flex-col items-center gap-4 text-red-500"
                                >
                                    <div className="p-6 rounded-full bg-red-500/10 border-2 border-red-500/20 shadow-[0_0_40px_-5px_var(--color-red-500)]">
                                        <div className="text-6xl">💀</div>
                                    </div>
                                    <h3 className="text-2xl font-bold font-serif italic">{t('smokeSuccessSmoke')}</h3>
                                    <p className="text-muted-foreground">{t('smokeSuccessSmokeMsg')}</p>
                                </motion.div>
                            ) : actionType === 'coffee' ? (
                                <motion.div
                                    key="success-coffee"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className="flex flex-col items-center gap-4 text-amber-600"
                                >
                                    <div className="p-6 rounded-full bg-amber-600/10 border-2 border-amber-600/20 shadow-[0_0_40px_-5px_var(--color-amber-600)]">
                                        <Coffee size={64} />
                                    </div>
                                    <h3 className="text-2xl font-bold">{t('smokeCaffeineOverload')}</h3>
                                    <p className="text-muted-foreground">{t('smokeCaffeineMsg')}</p>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="success-resist"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className="flex flex-col items-center gap-4 text-green-500"
                                >
                                    <div className="p-6 rounded-full bg-green-500/10 border-2 border-green-500/20 shadow-[0_0_40px_-5px_var(--color-green-500)]">
                                        <PartyPopper size={64} />
                                    </div>
                                    <h3 className="text-2xl font-bold">{t('smokeSuccessResist')}</h3>
                                    <p className="text-muted-foreground">{t('smokeSuccessResistMsg')}</p>
                                </motion.div>
                            )
                        ) : (
                            <div className="flex flex-col gap-6">
                                <motion.button
                                    key="button-resist"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleResist}
                                    disabled={status === 'loading'}
                                    className={cn(
                                        "relative group w-48 h-48 rounded-full flex flex-col items-center justify-center gap-2",
                                        "bg-gradient-to-br from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600",
                                        "text-white shadow-[0_10px_40px_-10px_rgba(16,185,129,0.5)] transition-all",
                                        "border-4 border-green-400/30",
                                        status === 'loading' && "opacity-80 cursor-wait"
                                    )}
                                >
                                    {status === 'loading' ? (
                                        <Loader2 className="w-12 h-12 animate-spin" />
                                    ) : (
                                        <>
                                            <ShieldCheck className="w-16 h-16 drop-shadow-md" />
                                            <span className="text-xl font-bold tracking-tight drop-shadow-md">
                                                {t('smokeResisted')}
                                            </span>
                                        </>
                                    )}
                                    {/* Pulse effect */}
                                    <span className="absolute inset-0 rounded-full animate-ping bg-green-500/20 duration-1000" />
                                </motion.button>

                                <div className="flex gap-4">
                                    <motion.button
                                        key="button-smoke"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleSmoke}
                                        disabled={status === 'loading'}
                                        className={cn(
                                            "relative group w-32 h-32 rounded-full flex flex-col items-center justify-center gap-1",
                                            "bg-gradient-to-br from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600",
                                            "text-white shadow-[0_10px_40px_-10px_rgba(225,29,72,0.5)] transition-all",
                                            "border-4 border-red-400/30",
                                            status === 'loading' && "opacity-80 cursor-wait"
                                        )}
                                    >
                                        {status === 'loading' ? (
                                            <Loader2 className="w-8 h-8 animate-spin" />
                                        ) : (
                                            <>
                                                <span className="text-sm font-bold tracking-tight drop-shadow-md">
                                                    {t('smokeSmoked')}
                                                </span>
                                            </>
                                        )}
                                    </motion.button>

                                    <motion.button
                                        key="button-coffee"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleCoffee}
                                        disabled={status === 'loading'}
                                        className={cn(
                                            "relative group w-32 h-32 rounded-full flex flex-col items-center justify-center gap-1",
                                            "bg-gradient-to-br from-amber-700 to-orange-900 hover:from-amber-600 hover:to-orange-800",
                                            "text-white shadow-[0_10px_40px_-10px_rgba(180,83,9,0.5)] transition-all",
                                            "border-4 border-amber-600/30",
                                            status === 'loading' && "opacity-80 cursor-wait"
                                        )}
                                    >
                                        {status === 'loading' ? (
                                            <Loader2 className="w-8 h-8 animate-spin" />
                                        ) : (
                                            <>
                                                <Coffee className="w-8 h-8 drop-shadow-md" />
                                                <span className="text-sm font-bold tracking-tight drop-shadow-md">
                                                    {t('smokeCoffee')}
                                                </span>
                                            </>
                                        )}
                                    </motion.button>
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
