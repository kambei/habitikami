import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Loader2, Send, FileText, ExternalLink, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../i18n';
import { habitService } from '../services/HabitService';
import type { SchedaStep } from '../types';
import type { SchedaTemplate } from '../data/schedeTemplates';
import { type AIProviderConfig, callAI } from '../utils/aiProvider';
import { saveMoodEntry } from './MoodGraph';
import { renderMarkdown } from '../lib/renderMarkdown';

interface Message {
    role: 'user' | 'model';
    content: string;
}

interface Props {
    template: SchedaTemplate;
    providerConfig: AIProviderConfig;
    onBack: () => void;
}

function markdownToHtml(md: string): string {
    let html = md;

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#666;margin:8px 0;">$1</blockquote>');

    // List items
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr/>');

    // Tables
    const lines = html.split('\n');
    const result: string[] = [];
    let inTable = false;
    let headerDone = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|') && line.endsWith('|')) {
            const cells = line.split('|').filter(c => c.trim() !== '');
            // Check if next line is separator
            const nextLine = lines[i + 1]?.trim() || '';
            const isSeparator = /^\|[\s-|]+\|$/.test(nextLine);

            if (!inTable) {
                result.push('<table style="border-collapse:collapse;width:100%;margin:12px 0;">');
                inTable = true;
                headerDone = false;
            }

            if (/^[\s-|]+$/.test(line.replace(/\|/g, '').trim())) {
                // Skip separator line
                continue;
            }

            const tag = !headerDone && isSeparator ? 'th' : 'td';
            if (!headerDone && isSeparator) headerDone = true;

            const row = cells.map(c =>
                `<${tag} style="border:1px solid #ddd;padding:8px;text-align:left;">${c.trim()}</${tag}>`
            ).join('');
            result.push(`<tr>${row}</tr>`);
        } else {
            if (inTable) {
                result.push('</table>');
                inTable = false;
                headerDone = false;
            }
            result.push(line);
        }
    }
    if (inTable) result.push('</table>');

    html = result.join('\n');

    // Paragraphs - wrap loose text
    html = html.replace(/\n\n/g, '</p><p>');
    html = `<p>${html}</p>`;
    // Clean empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>(<h[1-3]>)/g, '$1');
    html = html.replace(/(<\/h[1-3]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<table)/g, '$1');
    html = html.replace(/(<\/table>)<\/p>/g, '$1');
    html = html.replace(/<p>(<hr\/>)/g, '$1');
    html = html.replace(/(<hr\/>)<\/p>/g, '$1');
    html = html.replace(/<p>(<blockquote)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; color: #333; line-height: 1.6; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px; }
        h2 { color: #2980b9; }
        h3 { color: #7f8c8d; }
        table { border-collapse: collapse; width: 100%; }
        th { background-color: #f8f9fa; font-weight: bold; }
        li { margin: 4px 0; }
    </style></head><body>${html}</body></html>`;
}

export function SchedeCompiler({ template, providerConfig, onBack }: Props) {
    const { t } = useTranslation();
    const [history, setHistory] = useState<Message[]>([]);
    const [currentStep, setCurrentStep] = useState<SchedaStep | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [freeText, setFreeText] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [savedUrl, setSavedUrl] = useState<string | null>(null);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        startCompilation();
    }, []);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, currentStep, isLoading]);

    const callCurrentAI = async (messages: Message[]) => {
        setIsLoading(true);
        setError(null);

        const systemPrompt = t(template.systemPromptKey as any);
        const systemAck = t('schedaSystemAck');

        try {
            const accessToken = habitService.getAccessToken();
            const textResponse = await callAI(providerConfig, systemPrompt, systemAck, messages, accessToken);

            const parsed = JSON.parse(textResponse) as SchedaStep;
            if (!parsed.message) throw new Error(t('helpInvalidJson'));

            setCurrentStep(parsed);
            const updatedHistory = [...messages, { role: 'model', content: textResponse } as Message];
            setHistory(updatedHistory);

            if (parsed.completed) {
                assessMood(updatedHistory, t(template.titleKey as any));
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('helpGenericError'));
        } finally {
            setIsLoading(false);
        }
    };

    const assessMood = async (sessionHistory: Message[], sessionLabel: string) => {
        if (!providerConfig || sessionHistory.length < 4) return;
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
            // Silent fail
        }
    };

    const startCompilation = () => {
        setHistory([]);
        setSavedUrl(null);
        const startMsg: Message = { role: 'user', content: t('schedaStartMessage') };
        callCurrentAI([startMsg]);
    };

    const handleOptionSelect = (option: string) => {
        setCurrentStep(null);
        const newMsg: Message = { role: 'user', content: option };
        const updated = [...history, newMsg];
        setHistory(updated);
        callCurrentAI(updated);
    };

    const handleFreeTextSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!freeText.trim()) return;
        handleOptionSelect(freeText.trim());
        setFreeText('');
    };

    const handleSaveToDrive = async () => {
        if (!currentStep?.compiledDocument) return;

        setIsSaving(true);
        setError(null);

        try {
            const now = new Date();
            const pad = (n: number) => n < 10 ? '0' + n : String(n);
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            const schedaTitle = t(template.titleKey as any);
            const title = `${schedaTitle} - ${dateStr}`;

            const htmlContent = markdownToHtml(currentStep.compiledDocument);
            const result = await habitService.createDriveDocument(title, htmlContent);

            if (result.error) throw new Error(result.error);
            if (result.fileUrl) setSavedUrl(result.fileUrl);
        } catch (err: any) {
            setError(err.message || t('helpGenericError'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full relative overflow-hidden bg-gradient-to-b from-card to-background">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur shrink-0">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onBack}
                        className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-foreground/5 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-primary">{t(template.titleKey as any)}</span>
                </div>
                {currentStep && (
                    <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-primary rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${currentStep.progress}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                        <span className="text-xs text-muted-foreground">{currentStep.progress}%</span>
                    </div>
                )}
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 pb-32 scroll-smooth">
                <AnimatePresence>
                    {history.map((msg, i) => {
                        if (msg.role === 'model') return null;
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex w-full justify-end"
                            >
                                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm md:text-base shadow-sm ring-1 bg-primary text-primary-foreground ring-primary/20 rounded-tr-sm">
                                    {msg.content}
                                </div>
                            </motion.div>
                        );
                    })}

                    {error && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center">
                            <div className="bg-rose-500/10 text-rose-500 text-sm px-4 py-3 rounded-xl ring-1 ring-rose-500/20 text-center max-w-sm">
                                {error}
                                <button onClick={() => callCurrentAI(history)} className="block mx-auto mt-2 text-xs font-bold hover:underline">
                                    {t('helpRetry')}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Current AI step */}
                {currentStep && !currentStep.completed && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="flex w-full justify-start pt-2"
                    >
                        <div className="max-w-[90%] md:max-w-[80%] space-y-4">
                            <div className="bg-secondary/50 text-secondary-foreground ring-1 ring-border rounded-2xl rounded-tl-sm px-5 py-4 text-base leading-relaxed shadow-sm">
                                {renderMarkdown(currentStep.message)}
                            </div>

                            {/* Option buttons */}
                            {currentStep.options.length > 0 && (
                                <div className="flex flex-wrap gap-2">
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
                            )}

                            {/* Free text input */}
                            {currentStep.allowFreeText && (
                                <form onSubmit={handleFreeTextSubmit} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={freeText}
                                        onChange={(e) => setFreeText(e.target.value)}
                                        placeholder={t('schedaFreeTextPlaceholder')}
                                        className="flex-1 px-4 py-3 bg-background/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                                        autoFocus
                                    />
                                    <button
                                        type="submit"
                                        disabled={!freeText.trim()}
                                        className="px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </form>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Completed - show document and save button */}
                {currentStep?.completed && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="flex w-full justify-start pt-2"
                    >
                        <div className="max-w-[95%] md:max-w-[85%] space-y-4">
                            <div className="bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20 rounded-2xl rounded-tl-sm px-5 py-4 text-base leading-relaxed shadow-sm">
                                {renderMarkdown(currentStep.message)}
                            </div>

                            {/* Document preview */}
                            {currentStep.compiledDocument && (
                                <div className="bg-card/80 ring-1 ring-border rounded-xl p-4 max-h-64 overflow-y-auto text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                                    {currentStep.compiledDocument}
                                </div>
                            )}

                            {/* Save to Drive */}
                            {!savedUrl ? (
                                <button
                                    onClick={handleSaveToDrive}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {t('schedaSaving')}
                                        </>
                                    ) : (
                                        <>
                                            <FileText className="w-4 h-4" />
                                            {t('schedaSaveToDrive')}
                                        </>
                                    )}
                                </button>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col gap-3"
                                >
                                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                                        <Check className="w-4 h-4" />
                                        {t('schedaSaved')}
                                    </div>
                                    <a
                                        href={savedUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-4 py-2.5 bg-card/60 hover:bg-primary/10 border border-primary/20 hover:border-primary/50 text-foreground text-sm font-medium rounded-xl transition-all w-fit"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        {t('schedaOpenInDrive')}
                                    </a>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}

                {isLoading && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start pt-4">
                        <div className="bg-secondary/30 text-muted-foreground p-4 rounded-2xl rounded-tl-sm flex items-center gap-3 ring-1 ring-border/50">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            <span className="text-xs font-medium uppercase tracking-wider">{t('helpProcessing')}</span>
                        </div>
                    </motion.div>
                )}

                <div ref={endRef} className="h-4" />
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        </div>
    );
}
