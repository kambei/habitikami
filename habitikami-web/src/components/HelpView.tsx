import { useState, useEffect, useRef } from 'react';
import { HeartHandshake, RefreshCcw, HelpCircle, FileText, ClipboardList, Shield, BarChart3, Loader2, ScanLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import type { GuidedStep } from '../types';
import { useTranslation } from '../i18n';
import { habitService } from '../services/HabitService';
import { schedeTemplates } from '../data/schedeTemplates';
import { SchedeCompiler } from './SchedeCompiler';
import { SchedaImporter } from './SchedaImporter';
import type { SchedaTemplate } from '../data/schedeTemplates';
import {
    type AIProviderConfig,
    getActiveProvider,
    getProviderLabel,
    callAI,
    fetchAiStatus,
} from '../utils/aiProvider';
import { MoodGraph } from './MoodGraph';
import { saveMoodEntry } from '../hooks/useMood';
import { moodEntryNow } from '../utils/mood';
import { renderMarkdown } from '../lib/renderMarkdown';
import { errorMessage } from '../utils/errors';

interface Message {
    role: 'user' | 'model';
    content: string;
}

type HelpMode = 'menu' | 'chat' | 'scheda' | 'settings' | 'mood' | 'updates' | 'import';

interface HelpViewProps {
    /** Opens the Settings view (the AI assistant needs a key first). */
    onOpenSettings?: () => void;
}

export function HelpView({ onOpenSettings }: HelpViewProps = {}) {
    const { t } = useTranslation();

    // Provider state
    const [providerConfig, setProviderConfig] = useState<AIProviderConfig | null>(() => getActiveProvider());
    const [isKeySetup, setIsKeySetup] = useState(() => !!getActiveProvider());

    // The server may offer a shared AI key (issue #25): learn it once, then re-read the config
    useEffect(() => {
        if (getActiveProvider()) return;
        fetchAiStatus(habitService.getAccessToken()).then(() => {
            const active = getActiveProvider();
            if (active) { setProviderConfig(active); setIsKeySetup(true); }
        });
    }, []);

    const [mode, setMode] = useState<HelpMode>('menu');
    const [selectedScheda, setSelectedScheda] = useState<SchedaTemplate | null>(null);

    const [history, setHistory] = useState<Message[]>([]);
    const [currentStep, setCurrentStep] = useState<GuidedStep | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (mode === 'chat' && isKeySetup && history.length === 0 && !currentStep && !isLoading) {
            startSession();
        }
    }, [isKeySetup, mode]);

    useEffect(() => {
        if (endOfMessagesRef.current) {
            endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [history, currentStep, isLoading]);



    const handleOpenSettings = () => { onOpenSettings?.(); };

    const callCurrentAI = async (messages: Message[]) => {
        if (!providerConfig) return;
        setIsLoading(true);
        setError(null);
        const systemPrompt = t('helpSystemPrompt');
        const systemAck = t('helpSystemAck');
        try {
            const accessToken = habitService.getAccessToken();
            const textResponse = await callAI(providerConfig, systemPrompt, systemAck, messages, accessToken);
            const parsedStep = JSON.parse(textResponse) as GuidedStep;
            if (!parsedStep.message || !Array.isArray(parsedStep.options)) {
                throw new Error(t('helpInvalidJson'));
            }
            setCurrentStep(parsedStep);
            setHistory(prev => [...prev, { role: 'model', content: textResponse }]);
        } catch (err: unknown) {
            console.error(err);
            setError(errorMessage(err) || t('helpGenericError'));
        } finally {
            setIsLoading(false);
        }
    };

    function startSession() {
        setHistory([]);
        callCurrentAI([{ role: 'user', content: t('helpStartMessage') }]);
    }

    const handleOptionSelect = (option: string) => {
            setCurrentStep(null);
            const newMsg: Message = { role: 'user', content: option };
            const updatedHistory = [...history, newMsg];
            setHistory(updatedHistory);
            callCurrentAI(updatedHistory);
        };

    const handleSelectScheda = (scheda: SchedaTemplate) => {
        if (!isKeySetup) {
            handleOpenSettings();
            return;
        }
        setSelectedScheda(scheda);
        setMode('scheda');
    };

    const assessMood = async (sessionHistory: Message[], sessionLabel: string) => {
        if (!providerConfig || sessionHistory.length < 4) return; // Need at least 2 exchanges
        try {
            const accessToken = habitService.getAccessToken();
            const assessPrompt = t('moodAssessPrompt');
            const textResponse = await callAI(
                providerConfig,
                assessPrompt,
                '{"mood": 50, "anxiety": 50}',
                sessionHistory,
                accessToken,
            );
            const parsed = JSON.parse(textResponse);
            if (typeof parsed.mood === 'number' && typeof parsed.anxiety === 'number') {
                saveMoodEntry(moodEntryNow(parsed.mood, parsed.anxiety, sessionLabel, 'chat'));
            }
        } catch {
            // Silent fail - mood tracking is optional
        }
    };

    const handleBackToMenu = () => {
        // Assess mood if coming back from chat with enough history
        if (mode === 'chat' && history.length >= 4) {
            assessMood(history, t('helpMenuChatTitle') as string);
        }
        setMode('menu');
        setSelectedScheda(null);
        setHistory([]);
        setCurrentStep(null);
        setError(null);
    };

    const handleStartChat = () => {
        if (!isKeySetup) {
            handleOpenSettings();
            return;
        }
        setMode('chat');
    };

    const handleStartImport = () => {
        if (!isKeySetup) {
            handleOpenSettings();
            return;
        }
        setMode('import');
    };

    // ── Scheda compilation mode ──
    if (mode === 'scheda' && selectedScheda && providerConfig) {
        return (
            <SchedeCompiler
                template={selectedScheda}
                providerConfig={providerConfig}
                onBack={handleBackToMenu}
            />
        );
    }

    // ── Scheda import mode ──
    if (mode === 'import' && providerConfig) {
        return (
            <SchedaImporter
                providerConfig={providerConfig}
                onBack={handleBackToMenu}
            />
        );
    }

    // ── Mood graph mode ──
    if (mode === 'mood') {
        return <MoodGraph onBack={handleBackToMenu} />;
    }

    // ── Menu mode ──
    if (mode === 'menu') {
        return (
            <div className="flex flex-col h-full relative overflow-hidden bg-gradient-to-b from-card to-background">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur shrink-0">
                    <div className="flex items-center gap-2 text-primary">
                        <HeartHandshake className="w-5 h-5" />
                        <span className="font-semibold">{t('helpAreaTitle')}</span>
                        {providerConfig && (
                            <span className={cn(
                                "text-[10px] font-medium px-2 py-0.5 rounded-full",
                                providerConfig.provider === 'anthropic'
                                    ? "text-purple-400 bg-purple-500/10"
                                    : "text-blue-400 bg-blue-500/10"
                            )}>
                                {getProviderLabel(providerConfig.provider)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-purple-500/10 border-b border-purple-500/20 px-4 py-3 flex items-start gap-3">
                    <div className="mt-0.5 p-1 bg-purple-500/20 rounded-lg shrink-0">
                        <HelpCircle className="w-4 h-4 text-purple-400" />
                    </div>
                    <p className="text-xs text-purple-200/80 leading-relaxed italic">
                        {t('helpMedicalDisclaimer')}
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-lg mx-auto space-y-6 pt-4">
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            onClick={handleStartChat}
                            className="w-full text-left bg-card/60 backdrop-blur-md rounded-2xl border border-border/50 p-5 hover:border-primary/30 hover:bg-card/80 transition-all group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                                    <HeartHandshake className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-foreground mb-1">{t('helpMenuChatTitle')}</h3>
                                    <p className="text-sm text-muted-foreground">{t('helpMenuChatDesc')}</p>
                                </div>
                            </div>
                        </motion.button>

                        {/* Mood Tracker Card */}
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            onClick={() => setMode('mood')}
                            className="w-full text-left bg-card/60 backdrop-blur-md rounded-2xl border border-border/50 p-5 hover:border-primary/30 hover:bg-card/80 transition-all group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                                    <BarChart3 className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-foreground mb-1">{t('helpMenuMoodTitle')}</h3>
                                    <p className="text-sm text-muted-foreground">{t('helpMenuMoodDesc')}</p>
                                </div>
                            </div>
                        </motion.button>

                        <div className="space-y-3">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="flex items-center gap-2 px-1"
                            >
                                <ClipboardList className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-muted-foreground">{t('helpMenuSchedeTitle')}</span>
                            </motion.div>

                            {schedeTemplates.map((scheda: SchedaTemplate, i: number) => (
                                <motion.button
                                    key={scheda.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.25 + i * 0.1 }}
                                    onClick={() => handleSelectScheda(scheda)}
                                    className="w-full text-left bg-card/60 backdrop-blur-md rounded-2xl border border-border/50 p-5 hover:border-primary/30 hover:bg-card/80 transition-all group"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                                            <FileText className="w-6 h-6 text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground mb-1">{t(scheda.titleKey)}</h3>
                                            <p className="text-sm text-muted-foreground">{t(scheda.descriptionKey)}</p>
                                        </div>
                                    </div>
                                </motion.button>
                            ))}
                        </div>

                        {/* Import handwritten worksheets (Remarkable 2 / tablet) — informational */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-card/40 backdrop-blur-md rounded-2xl border border-dashed border-border/60 p-5"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0">
                                    <ScanLine className="w-6 h-6 text-amber-400" />
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-semibold text-foreground">{t('helpImportTitle')}</h3>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                            {t('helpImportBadge')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{t('helpImportDesc')}</p>
                                    <div className="space-y-2 pt-1">
                                        <p className="text-xs font-medium text-muted-foreground/90">{t('helpImportHowTitle')}</p>
                                        <ol className="space-y-1.5">
                                            {[t('helpImportStep1'), t('helpImportStep2'), t('helpImportStep3')].map((step, i) => (
                                                <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                                                    <span className="shrink-0 w-4 h-4 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                                                    <span>{step}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                    <div className="flex items-start gap-2 pt-1 text-[11px] text-muted-foreground/70 leading-relaxed">
                                        <Shield className="w-3.5 h-3.5 text-emerald-400/70 shrink-0 mt-0.5" />
                                        <span>{t('helpImportNote')}</span>
                                    </div>
                                    <button
                                        onClick={handleStartImport}
                                        className="w-full flex items-center justify-center gap-2 mt-1 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 font-medium text-sm px-4 py-2.5 rounded-xl transition-all"
                                    >
                                        <ScanLine className="w-4 h-4" />
                                        {t('helpImportCta')}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Chat mode ──
    return (
        <div className="flex flex-col h-full relative overflow-hidden bg-gradient-to-b from-card to-background">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur shrink-0">
                <div className="flex items-center gap-2 text-primary">
                    <button
                        onClick={handleBackToMenu}
                        className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-foreground/5 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <HeartHandshake className="w-5 h-5" />
                    <span className="font-semibold">{t('helpAreaTitle')}</span>
                    {providerConfig && (
                        <span className={cn(
                            "text-[10px] font-medium px-2 py-0.5 rounded-full",
                            providerConfig.provider === 'anthropic'
                                ? "text-purple-400 bg-purple-500/10"
                                : "text-blue-400 bg-blue-500/10"
                        )}>
                            {getProviderLabel(providerConfig.provider)}
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                     <button
                        onClick={startSession}
                        className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-foreground/5 transition-colors"
                        title={t('helpRestartSession')}
                    >
                        <RefreshCcw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="bg-purple-500/10 border-b border-purple-500/20 px-4 py-3 flex items-start gap-3">
                <div className="mt-0.5 p-1 bg-purple-500/20 rounded-lg shrink-0">
                    <HelpCircle className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-xs text-purple-200/80 leading-relaxed italic">
                    {t('helpMedicalDisclaimer')}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-32 scroll-smooth">
                {history.length === 0 && !isLoading && !currentStep && !error && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-70">
                        <HeartHandshake className="w-12 h-12 text-primary" />
                        <p className="text-muted-foreground">{t('helpStarting')}</p>
                    </div>
                )}

                <AnimatePresence>
                    {history.map((msg, i) => {
                        if (msg.role === 'model') return null;
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                    "flex w-full",
                                    msg.role === 'user' ? "justify-end" : "justify-start"
                                )}
                            >
                                <div className={cn(
                                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm md:text-base shadow-sm ring-1",
                                    msg.role === 'user'
                                        ? "bg-primary text-primary-foreground ring-primary/20 rounded-tr-sm"
                                        : "bg-secondary text-secondary-foreground ring-border rounded-tl-sm"
                                )}>
                                    {msg.content}
                                </div>
                            </motion.div>
                        );
                    })}

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex justify-center"
                        >
                            <div className="bg-rose-500/10 text-rose-500 text-sm px-4 py-3 rounded-xl ring-1 ring-rose-500/20 text-center max-w-sm">
                                {error}
                                <button
                                    onClick={() => callCurrentAI(history)}
                                    className="block mx-auto mt-2 text-xs font-bold hover:underline"
                                >
                                    {t('helpRetry')}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {currentStep && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="flex w-full justify-start pt-4"
                    >
                        <div className="max-w-[90%] md:max-w-[80%] space-y-4">
                            <div className="bg-secondary/50 text-secondary-foreground ring-1 ring-border rounded-2xl rounded-tl-sm px-5 py-4 text-base leading-relaxed shadow-sm">
                                {renderMarkdown(currentStep.message)}
                            </div>
                            <div className="flex flex-wrap gap-2 pt-2">
                                {currentStep.options.map((opt, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleOptionSelect(opt)}
                                        className="px-4 py-2.5 bg-card/60 hover:bg-primary/10 border border-primary/20 hover:border-primary/50 text-foreground text-sm font-medium rounded-xl transition-all shadow-sm active:scale-95"
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start pt-4"
                    >
                        <div className="bg-secondary/30 text-muted-foreground p-4 rounded-2xl rounded-tl-sm flex items-center gap-3 ring-1 ring-border/50">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            <span className="text-xs font-medium uppercase tracking-wider">{t('helpProcessing')}</span>
                        </div>
                    </motion.div>
                )}

                <div ref={endOfMessagesRef} className="h-4" />
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        </div>
    );
}
