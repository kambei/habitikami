import { useRef, useState } from 'react';
import { ArrowLeft, Upload, ScanLine, Loader2, Check, ExternalLink, FileText, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../i18n';
import { habitService } from '../services/HabitService';
import { type AIProviderConfig, type AIAttachment, callAI } from '../utils/aiProvider';
import { markdownToHtml } from '../lib/markdownUtils';
import { renderMarkdown } from '../lib/renderMarkdown';

interface Props {
    providerConfig: AIProviderConfig;
    onBack: () => void;
}

const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB — keeps the base64 payload reasonable

interface Transcription {
    date: string | null;
    title: string;
    markdown: string;
    uncertain?: string[];
}

function todayISO(): string {
    const now = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Read a File as base64 (without the data: prefix). */
function readAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const comma = result.indexOf(',');
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(new Error('read-error'));
        reader.readAsDataURL(file);
    });
}

export function SchedaImporter({ providerConfig, onBack }: Props) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [file, setFile] = useState<File | null>(null);
    const [attachment, setAttachment] = useState<AIAttachment | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Editable transcription (after AI review)
    const [result, setResult] = useState<Transcription | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editMarkdown, setEditMarkdown] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [savedUrl, setSavedUrl] = useState<string | null>(null);

    const reset = () => {
        setFile(null);
        setAttachment(null);
        setResult(null);
        setError(null);
        setSavedUrl(null);
        setEditTitle('');
        setEditDate('');
        setEditMarkdown('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;
        setError(null);
        setResult(null);
        setSavedUrl(null);

        if (!ACCEPTED_TYPES.includes(selected.type)) {
            setError(t('importUnsupported'));
            return;
        }
        if (selected.size > MAX_BYTES) {
            setError(t('importTooLarge'));
            return;
        }

        try {
            const dataBase64 = await readAsBase64(selected);
            setFile(selected);
            setAttachment({ mediaType: selected.type, dataBase64 });
        } catch {
            setError(t('importReadError'));
        }
    };

    const handleAnalyze = async () => {
        if (!attachment) return;
        setIsAnalyzing(true);
        setError(null);
        try {
            const accessToken = habitService.getAccessToken();
            const systemPrompt = t('importSystemPrompt');
            const systemAck = t('importSystemAck');
            const textResponse = await callAI(
                providerConfig,
                systemPrompt,
                systemAck,
                [{ role: 'user', content: t('importStartMessage'), attachments: [attachment] }],
                accessToken,
            );

            const parsed = JSON.parse(textResponse) as Transcription;
            if (!parsed.markdown || !parsed.markdown.trim()) {
                throw new Error(t('importNoText'));
            }
            setResult(parsed);
            setEditTitle(parsed.title?.trim() || t('importDefaultTitle'));
            setEditDate(parsed.date || todayISO());
            setEditMarkdown(parsed.markdown);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('helpGenericError'));
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSave = async () => {
        if (!editMarkdown.trim()) return;
        setIsSaving(true);
        setError(null);
        try {
            const date = editDate || todayISO();
            const title = `${(editTitle || t('importDefaultTitle')).trim()} - ${date}`;
            // Keep the worksheet date inside the body so the consolidation can group by date.
            const body = `**${t('importDateLabel')}:** ${date}\n\n${editMarkdown}`;
            const htmlContent = markdownToHtml(body);
            const res = await habitService.createDriveDocument(title, htmlContent);
            if (res.error) throw new Error(res.error);
            if (res.fileUrl) setSavedUrl(res.fileUrl);
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
                    <ScanLine className="w-5 h-5 text-amber-400" />
                    <span className="font-semibold text-foreground">{t('helpImportTitle')}</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-lg mx-auto space-y-5">
                    {/* Saved confirmation */}
                    {savedUrl ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 text-center space-y-3"
                        >
                            <div className="w-12 h-12 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto">
                                <Check className="w-6 h-6 text-emerald-400" />
                            </div>
                            <p className="font-semibold text-foreground">{t('importSaved')}</p>
                            <div className="flex flex-col gap-2">
                                <a
                                    href={savedUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-all"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    {t('importOpenInDrive')}
                                </a>
                                <button
                                    onClick={reset}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {t('importAnother')}
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <>
                            {/* Intro */}
                            <p className="text-sm text-muted-foreground leading-relaxed">{t('importIntro')}</p>

                            {/* File picker */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={ACCEPTED_TYPES.join(',')}
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {!file ? (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border/60 rounded-2xl py-10 px-4 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all"
                                >
                                    <Upload className="w-8 h-8 text-amber-400" />
                                    <span className="text-sm font-medium text-foreground">{t('importSelectFile')}</span>
                                    <span className="text-xs text-muted-foreground">{t('importFileHint')}</span>
                                </button>
                            ) : (
                                <div className="flex items-center gap-3 bg-card/60 border border-border/50 rounded-xl px-4 py-3">
                                    <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                                    <span className="text-sm text-foreground truncate flex-1">{file.name}</span>
                                    <button
                                        onClick={reset}
                                        className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-foreground/5 transition-colors"
                                        title={t('importRemoveFile')}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            {/* Analyze button */}
                            {file && !result && (
                                <button
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing}
                                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-3 rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                                    {isAnalyzing ? t('importAnalyzing') : t('importAnalyze')}
                                </button>
                            )}

                            {error && (
                                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
                                    <p className="text-sm text-rose-400">{error}</p>
                                </div>
                            )}

                            {/* Review / edit transcription */}
                            <AnimatePresence>
                                {result && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-4"
                                    >
                                        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
                                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                            <p className="text-xs text-amber-200/90 leading-relaxed">{t('importReviewNote')}</p>
                                        </div>

                                        {result.uncertain && result.uncertain.length > 0 && (
                                            <div className="bg-background/40 border border-border/50 rounded-xl px-4 py-3 space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground">{t('importUncertain')}</p>
                                                <ul className="list-disc list-inside text-xs text-muted-foreground/80 space-y-0.5">
                                                    {result.uncertain.map((u, i) => <li key={i}>{u}</li>)}
                                                </ul>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground">{t('importTitleLabel')}</label>
                                                <input
                                                    type="text"
                                                    value={editTitle}
                                                    onChange={e => setEditTitle(e.target.value)}
                                                    className="w-full text-sm bg-background/70 px-3 py-2 rounded-lg border border-border/40 focus:border-primary/50 focus:outline-none transition-colors"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground">{t('importDateLabel')}</label>
                                                <input
                                                    type="date"
                                                    value={editDate}
                                                    onChange={e => setEditDate(e.target.value)}
                                                    className="w-full text-sm bg-background/70 px-3 py-2 rounded-lg border border-border/40 focus:border-primary/50 focus:outline-none transition-colors"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">{t('importContentLabel')}</label>
                                            <textarea
                                                value={editMarkdown}
                                                onChange={e => setEditMarkdown(e.target.value)}
                                                rows={12}
                                                className="w-full text-sm bg-background/70 px-3 py-2.5 rounded-lg border border-border/40 focus:border-primary/50 focus:outline-none transition-colors font-mono leading-relaxed resize-y"
                                            />
                                        </div>

                                        {/* Live preview */}
                                        <details className="bg-background/30 border border-border/40 rounded-xl px-4 py-3">
                                            <summary className="text-xs font-medium text-muted-foreground cursor-pointer">{t('importPreview')}</summary>
                                            <div className="mt-3 text-sm leading-relaxed prose-sm">{renderMarkdown(editMarkdown)}</div>
                                        </details>

                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving || !editMarkdown.trim()}
                                            className="w-full flex items-center justify-center gap-2 bg-emerald-500/90 text-white font-medium px-4 py-3 rounded-xl hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                            {isSaving ? t('importSaving') : t('importSave')}
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Privacy note */}
                            <p className="text-[11px] text-muted-foreground/75 leading-relaxed pt-2">{t('helpImportNote')}</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
