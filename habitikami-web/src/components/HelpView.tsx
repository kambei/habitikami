import { useState, useEffect, useRef } from 'react';
import { HeartHandshake, Key, Loader2, RefreshCcw, HelpCircle, FileText, ClipboardList, Shield, Sparkles, Check, Settings, BarChart3, Copy, Trash2, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import type { GuidedStep } from '../types';
import { useTranslation } from '../i18n';
import { habitService } from '../services/HabitService';
import { schedeTemplates } from '../data/schedeTemplates';
import { SchedeCompiler } from './SchedeCompiler';
import type { SchedaTemplate } from '../data/schedeTemplates';
import {
    type AIProvider,
    type AIProviderConfig,
    getActiveProvider,
    getGeminiKey,
    getAnthropicKey,
    setGeminiKey,
    setAnthropicKey,
    getProviderLabel,
    callAI,
} from '../utils/aiProvider';
import { MoodGraph, saveMoodEntry } from './MoodGraph';
import React from 'react';

function renderMarkdown(text: string): React.ReactNode {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];

    const flushList = () => {
        if (listItems.length > 0) {
            elements.push(
                <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1">
                    {listItems.map((item, i) => <li key={i}>{inlineFormat(item)}</li>)}
                </ul>
            );
            listItems = [];
        }
    };

    const inlineFormat = (s: string): React.ReactNode => {
        const parts: React.ReactNode[] = [];
        const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
        let last = 0;
        let match;
        while ((match = regex.exec(s)) !== null) {
            if (match.index > last) parts.push(s.slice(last, match.index));
            if (match[2]) parts.push(<strong key={match.index}>{match[2]}</strong>);
            else if (match[3]) parts.push(<em key={match.index}>{match[3]}</em>);
            else if (match[4]) parts.push(<code key={match.index} className="bg-background/50 px-1 py-0.5 rounded text-xs">{match[4]}</code>);
            last = match.index + match[0].length;
        }
        if (last < s.length) parts.push(s.slice(last));
        return parts.length === 1 ? parts[0] : <>{parts}</>;
    };

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            listItems.push(trimmed.slice(2));
        } else {
            flushList();
            if (trimmed === '') {
                elements.push(<br key={`br-${elements.length}`} />);
            } else {
                elements.push(<p key={`p-${elements.length}`}>{inlineFormat(trimmed)}</p>);
            }
        }
    }
    flushList();
    return <div className="space-y-2">{elements}</div>;
}

interface Message {
    role: 'user' | 'model';
    content: string;
}

type HelpMode = 'menu' | 'chat' | 'scheda' | 'settings' | 'mood';

interface HelpViewProps {
    openSettings?: boolean;
    onSettingsClosed?: () => void;
}

export function HelpView({ openSettings, onSettingsClosed }: HelpViewProps = {}) {
    const { t } = useTranslation();

    // Provider state
    const [providerConfig, setProviderConfig] = useState<AIProviderConfig | null>(() => getActiveProvider());
    const [isKeySetup, setIsKeySetup] = useState(() => !!getActiveProvider());

    // Key input state
    const [tempGeminiKey, setTempGeminiKey] = useState(() => getGeminiKey());
    const [tempAnthropicKey, setTempAnthropicKey] = useState(() => getAnthropicKey());
    const [showGeminiHelp, setShowGeminiHelp] = useState(false);
    const [showAnthropicHelp, setShowAnthropicHelp] = useState(false);

    // API key state
    const [apiKeyInfo, setApiKeyInfo] = useState<{ has_key: boolean; masked_key?: string; created_at?: string } | null>(null);
    const [newApiKey, setNewApiKey] = useState<string | null>(null);
    const [apiKeyLoading, setApiKeyLoading] = useState(false);
    const [apiKeyCopied, setApiKeyCopied] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [apiKeyError, setApiKeyError] = useState<string | null>(null);

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



    const loadApiKeyInfo = async () => {
        const result = await habitService.getApiKeyInfo();
        if (!('error' in result)) {
            setApiKeyInfo(result);
        }
    };

    const handleGenerateApiKey = async () => {
        setApiKeyLoading(true);
        setApiKeyError(null);
        setNewApiKey(null);
        const result = await habitService.generateApiKey();
        if ('error' in result) {
            setApiKeyError(result.error);
        } else {
            setNewApiKey(result.api_key);
            setShowApiKey(true);
            await loadApiKeyInfo();
        }
        setApiKeyLoading(false);
    };

    const handleRevokeApiKey = async () => {
        setApiKeyLoading(true);
        setApiKeyError(null);
        const result = await habitService.revokeApiKey();
        if ('error' in result) {
            setApiKeyError(result.error);
        } else {
            setApiKeyInfo({ has_key: false });
            setNewApiKey(null);
        }
        setApiKeyLoading(false);
    };

    const handleCopyApiKey = async () => {
        if (!newApiKey) return;
        await navigator.clipboard.writeText(newApiKey);
        setApiKeyCopied(true);
        setTimeout(() => setApiKeyCopied(false), 2000);
    };

    const handleOpenSettings = () => {
        setTempGeminiKey(getGeminiKey());
        setTempAnthropicKey(getAnthropicKey());
        setNewApiKey(null);
        setShowApiKey(false);
        setApiKeyError(null);
        loadApiKeyInfo();
        setMode('settings');
    };

    // Open settings when triggered from parent (navbar gear icon)
    useEffect(() => {
        if (openSettings) {
            handleOpenSettings();
        }
    }, [openSettings]);

    const handleSaveSettings = (e: React.FormEvent) => {
        e.preventDefault();
        const gemini = tempGeminiKey.trim();
        const anthropic = tempAnthropicKey.trim();
        setGeminiKey(gemini);
        setAnthropicKey(anthropic);
        const active = getActiveProvider();
        setProviderConfig(active);
        if (!active) {
            setIsKeySetup(false);
        } else {
            setMode('menu');
        }
    };

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
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('helpGenericError'));
        } finally {
            setIsLoading(false);
        }
    };

    const startSession = () => {
        setHistory([]);
        callCurrentAI([{ role: 'user', content: t('helpStartMessage') }]);
    };

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
                saveMoodEntry({
                    date: new Date().toISOString(),
                    timestamp: Date.now(),
                    anxiety: Math.max(0, Math.min(100, parsed.anxiety)),
                    mood: Math.max(0, Math.min(100, parsed.mood)),
                    label: sessionLabel,
                });
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

    // Computed values
    const hasGemini = !!tempGeminiKey.trim();
    const hasAnthropic = !!tempAnthropicKey.trim();
    const canSave = hasGemini || hasAnthropic;
    const activeProviderType: AIProvider | null = hasAnthropic ? 'anthropic' : hasGemini ? 'gemini' : null;

    // ── Reusable guide sections ──

    const renderAnthropicGuide = () => (
        <div className="mt-1 p-3 bg-secondary/50 rounded-lg text-xs space-y-3 text-muted-foreground text-left border border-border/50">
            <p>1. {t('helpAnthropicStep1')} <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline font-medium">{t('helpAnthropicStep1Link')}</a> {t('helpAnthropicStep1Suffix')}</p>
            <img src="/guides/anthropic-step1.svg" alt="Anthropic Console - API Keys sidebar" className="w-full rounded-lg border border-border/30" loading="lazy" />
            <p dangerouslySetInnerHTML={{ __html: `2. ${t('helpAnthropicStep2')}` }} />
            <p dangerouslySetInnerHTML={{ __html: `3. ${t('helpAnthropicStep3')}` }} />
            <img src="/guides/anthropic-step2.svg" alt="Anthropic Console - Create Key" className="w-full rounded-lg border border-border/30" loading="lazy" />
            <p>4. {t('helpAnthropicStep4')} <code className="bg-background px-1 py-0.5 rounded text-purple-400">sk-ant-...</code> {t('helpAnthropicStep4Suffix')}</p>
            <img src="/guides/anthropic-step3.svg" alt="Anthropic Console - Copy Key" className="w-full rounded-lg border border-border/30" loading="lazy" />
        </div>
    );

    const renderGeminiGuide = () => (
        <div className="mt-1 p-3 bg-secondary/50 rounded-lg text-xs space-y-3 text-muted-foreground text-left border border-border/50">
            <p>1. {t('helpApiKeyStep1')} <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">{t('helpApiKeyStep1Link')}</a> {t('helpApiKeyStep1Suffix')}</p>
            <p dangerouslySetInnerHTML={{ __html: `2. ${t('helpApiKeyStep2')}` }} />
            <img src="/guides/gemini-step1.svg" alt="Google AI Studio - Create API Key" className="w-full rounded-lg border border-border/30" loading="lazy" />
            <p>3. {t('helpApiKeyStep3')}</p>
            <img src="/guides/gemini-step2.svg" alt="Google AI Studio - Select Project" className="w-full rounded-lg border border-border/30" loading="lazy" />
            <p>4. {t('helpApiKeyStep4')} <code className="bg-background px-1 py-0.5 rounded text-primary">AIzaSy...</code> {t('helpApiKeyStep4Suffix')}</p>
            <img src="/guides/gemini-step3.svg" alt="Google AI Studio - Copy Key" className="w-full rounded-lg border border-border/30" loading="lazy" />
        </div>
    );

    const renderAnthropicCard = (idPrefix: string) => (
        <div className={cn(
            "rounded-xl border p-4 space-y-3 transition-all",
            hasAnthropic
                ? "border-purple-500/40 bg-purple-500/5"
                : "border-border/50 bg-background/30"
        )}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-500/15 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">{t('helpAnthropicSection')}</h3>
                        <span className="text-[10px] text-muted-foreground">{t('helpProviderPaid')}</span>
                    </div>
                </div>
                {hasAnthropic && activeProviderType === 'anthropic' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                        {t('helpProviderActive')}
                    </span>
                )}
                {hasAnthropic && activeProviderType !== 'anthropic' && (
                    <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> {t('helpProviderConfigured')}
                    </span>
                )}
            </div>
            <div className="space-y-2">
                <label htmlFor={`${idPrefix}AnthropicKey`} className="text-xs font-medium text-muted-foreground">{t('helpAnthropicKeyLabel')}</label>
                <input
                    id={`${idPrefix}AnthropicKey`}
                    type="password"
                    value={tempAnthropicKey}
                    onChange={(e) => setTempAnthropicKey(e.target.value)}
                    placeholder="sk-ant-api03-..."
                    className="w-full px-3 py-2.5 bg-background/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-sm"
                />
                <button
                    type="button"
                    onClick={() => setShowAnthropicHelp(!showAnthropicHelp)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{t('helpAnthropicKeyHelp')}</span>
                </button>
                <AnimatePresence>
                    {showAnthropicHelp && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            {renderAnthropicGuide()}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );

    const renderGeminiCard = (idPrefix: string) => (
        <div className={cn(
            "rounded-xl border p-4 space-y-3 transition-all",
            hasGemini && !hasAnthropic
                ? "border-blue-500/40 bg-blue-500/5"
                : hasGemini
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border/50 bg-background/30"
        )}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-500/15 rounded-lg flex items-center justify-center">
                        <Shield className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">{t('helpGeminiSection')}</h3>
                        <span className="text-[10px] text-muted-foreground">{t('helpProviderFree')}</span>
                    </div>
                </div>
                {hasGemini && activeProviderType === 'gemini' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                        {t('helpProviderActive')}
                    </span>
                )}
                {hasGemini && activeProviderType !== 'gemini' && (
                    <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> {t('helpProviderConfigured')}
                    </span>
                )}
            </div>
            <div className="space-y-2">
                <label htmlFor={`${idPrefix}GeminiKey`} className="text-xs font-medium text-muted-foreground">{t('helpApiKeyLabel')}</label>
                <input
                    id={`${idPrefix}GeminiKey`}
                    type="password"
                    value={tempGeminiKey}
                    onChange={(e) => setTempGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2.5 bg-background/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                />
                <button
                    type="button"
                    onClick={() => setShowGeminiHelp(!showGeminiHelp)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{t('helpApiKeyHelp')}</span>
                </button>
                <AnimatePresence>
                    {showGeminiHelp && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            {renderGeminiGuide()}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );

    const renderPriorityNote = () => (
        hasGemini && hasAnthropic ? (
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-purple-300/80 text-center italic px-2"
            >
                {t('helpProviderPriority')}
            </motion.p>
        ) : null
    );

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

    // ── Mood graph mode ──
    if (mode === 'mood') {
        return <MoodGraph onBack={handleBackToMenu} />;
    }

    // ── Settings mode ──
    if (mode === 'settings') {
        return (
            <div className="flex-1 flex items-start justify-center p-4 overflow-y-auto">
                <div className="max-w-lg w-full bg-card/60 backdrop-blur-md rounded-2xl border border-border/50 p-6 md:p-8 shadow-xl space-y-6 my-auto">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { setMode('menu'); onSettingsClosed?.(); }}
                            className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-foreground/5 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-bold text-foreground">{t('helpSettingsTitle')}</h2>
                        </div>
                    </div>

                    <form onSubmit={handleSaveSettings} className="space-y-5">
                        {renderAnthropicCard('settings')}
                        {renderGeminiCard('settings')}
                        {renderPriorityNote()}

                        <button
                            type="submit"
                            disabled={!canSave}
                            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-3 rounded-xl hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Check className="w-4 h-4" />
                            {t('helpSaveSettings')}
                        </button>
                    </form>

                    {/* API Key Management */}
                    <div className="border-t border-border/50 pt-5">
                        <div className="rounded-xl border border-border/50 bg-background/30 p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center">
                                    <Key className="w-4 h-4 text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">{t('settingsApiKeyTitle')}</h3>
                                    <span className="text-[10px] text-muted-foreground">{t('settingsApiKeyDesc')}</span>
                                </div>
                            </div>

                            {(newApiKey || apiKeyInfo?.has_key) && (
                                <div className={cn(
                                    "rounded-lg p-3 space-y-2",
                                    newApiKey ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-background/30 border border-border/30"
                                )}>
                                    {newApiKey && (
                                        <p className="text-xs text-emerald-300 font-medium">{t('settingsApiKeyNewWarning')}</p>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 text-xs bg-background/70 px-3 py-2 rounded font-mono break-all select-all">
                                            {newApiKey
                                                ? (showApiKey ? newApiKey : '•'.repeat(20))
                                                : apiKeyInfo?.masked_key
                                            }
                                        </code>
                                        {newApiKey && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowApiKey(!showApiKey)}
                                                    className="shrink-0 p-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
                                                    title={showApiKey ? t('settingsApiKeyHide') : t('settingsApiKeyShow')}
                                                >
                                                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleCopyApiKey}
                                                    className="shrink-0 p-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
                                                    title={t('settingsApiKeyCopy')}
                                                >
                                                    {apiKeyCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    {apiKeyInfo?.created_at && (
                                        <p className="text-[10px] text-muted-foreground">{t('settingsApiKeyCreated')}: {new Date(apiKeyInfo.created_at).toLocaleDateString()}</p>
                                    )}
                                </div>
                            )}

                            {apiKeyError && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                                    <p className="text-xs text-red-400">{apiKeyError}</p>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleGenerateApiKey}
                                    disabled={apiKeyLoading}
                                    className="flex-1 flex items-center justify-center gap-2 text-xs font-medium px-3 py-2.5 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-all disabled:opacity-40"
                                >
                                    {apiKeyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                                    {apiKeyInfo?.has_key ? t('settingsApiKeyRegenerate') : t('settingsApiKeyGenerate')}
                                </button>
                                {apiKeyInfo?.has_key && (
                                    <button
                                        type="button"
                                        onClick={handleRevokeApiKey}
                                        disabled={apiKeyLoading}
                                        className="flex items-center justify-center gap-2 text-xs font-medium px-3 py-2.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-all disabled:opacity-40"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        {t('settingsApiKeyRevoke')}
                                    </button>
                                )}
                            </div>

                            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                                {t('settingsApiKeyUsage')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
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
                                <div>
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
                                            <h3 className="font-semibold text-foreground mb-1">{t(scheda.titleKey as any)}</h3>
                                            <p className="text-sm text-muted-foreground">{t(scheda.descriptionKey as any)}</p>
                                        </div>
                                    </div>
                                </motion.button>
                            ))}
                        </div>
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
