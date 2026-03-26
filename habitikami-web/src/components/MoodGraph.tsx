import { useState, useEffect } from 'react';
import { BarChart3, Trash2, TrendingDown, TrendingUp, Minus, Sparkles, Loader2, Save, Check, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, BarChart, Bar, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { useTranslation } from '../i18n';
import { cn } from '../lib/utils';
import { getActiveProvider, callAI } from '../utils/aiProvider';
import { habitService } from '../services/HabitService';
import { toast } from 'sonner';
import { renderMarkdown } from '../lib/renderMarkdown';
import { markdownToHtml } from '../lib/markdownUtils';

export interface MoodEntry {
    date: string;        // ISO date string
    timestamp: number;   // ms epoch
    anxiety: number;     // 0-100
    mood: number;        // 0-100 (0=very bad, 100=great)
    label: string;       // e.g. "Guided Session", "Emotion Diary"
}

const MOOD_STORAGE_KEY = 'habitikami_mood_history';
const AI_CACHE_KEY = 'habitikami_ai_insights_cache';
const AI_CACHE_IDS_KEY = 'habitikami_ai_insights_ids';

export function getMoodHistory(): MoodEntry[] {
    const saved = localStorage.getItem(MOOD_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
}

export function saveMoodEntry(entry: MoodEntry) {
    const history = getMoodHistory();
    history.push(entry);
    // Keep last 100 entries
    const trimmed = history.slice(-100);
    localStorage.setItem(MOOD_STORAGE_KEY, JSON.stringify(trimmed));
}

export function clearMoodHistory() {
    localStorage.removeItem(MOOD_STORAGE_KEY);
}

interface Props {
    onBack: () => void;
}

export function MoodGraph({ onBack }: Props) {
    const { t } = useTranslation();
    const [entries, setEntries] = useState<MoodEntry[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiInsights, setAiInsights] = useState<{
        insightText: string;
        chartData: { name: string; score: number }[];
        emotionsData: { emotion: string; score: number }[];
    } | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [analysisLimit, setAnalysisLimit] = useState(10);
    const [isConsolidating, setIsConsolidating] = useState(false);
    const [isCacheHit, setIsCacheHit] = useState(false);
    const [isConsolidatedSummary, setIsConsolidatedSummary] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savedUrl, setSavedUrl] = useState<string | null>(null);

    const providerConfig = getActiveProvider();

    useEffect(() => {
        setEntries(getMoodHistory());
        checkCache();
    }, [analysisLimit]); // Re-check cache if analysisLimit changes

    const checkCache = async () => {
        const cached = localStorage.getItem(AI_CACHE_KEY);
        const cachedIds = localStorage.getItem(AI_CACHE_IDS_KEY);
        
        let hasValidCache = false;
        if (cached && cachedIds) {
            try {
                const meta = await habitService.getWorksheetMetadata(analysisLimit);
                if (!('error' in meta)) {
                    const currentIds = meta.map(f => f.id).join(',');
                    if (currentIds === cachedIds) {
                        setAiInsights(JSON.parse(cached));
                        setIsCacheHit(true);
                        hasValidCache = true;
                    }
                }
            } catch (e) {
                console.error("Cache check failed", e);
            }
        }

        if (!hasValidCache) {
            // Cache invalid or missing, clear it
            localStorage.removeItem(AI_CACHE_KEY);
            localStorage.removeItem(AI_CACHE_IDS_KEY);
            setIsCacheHit(false);

            // Fetch latest consolidated summary as fallback
            const latestSummary = await habitService.getLatestConsolidatedSummary();
            if (latestSummary) {
                setAiInsights({
                    insightText: latestSummary.content, // Summary already has headers or is clear enough
                    chartData: [],
                    emotionsData: []
                });
            }
        }
    };

    const handleClear = () => {
        clearMoodHistory();
        setEntries([]);
    };

    // Format data for charts - group by date, average if multiple per day
    const chartData = entries.reduce<Record<string, { date: string; mood: number; anxiety: number; count: number }>>((acc, e) => {
        const day = e.date.split('T')[0];
        const short = day.slice(5); // MM-DD
        if (!acc[day]) {
            acc[day] = { date: short, mood: 0, anxiety: 0, count: 0 };
        }
        acc[day].mood += e.mood;
        acc[day].anxiety += e.anxiety;
        acc[day].count += 1;
        return acc;
    }, {});

    const data = Object.values(chartData)
        .map(d => ({
            date: d.date,
            mood: Math.round(d.mood / d.count),
            anxiety: Math.round(d.anxiety / d.count),
        }))
        .slice(-30); // Last 30 days

    // Calculate trends
    const lastEntries = entries.slice(-5);
    const prevEntries = entries.slice(-10, -5);
    const avgMoodLast = lastEntries.length > 0 ? lastEntries.reduce((s, e) => s + e.mood, 0) / lastEntries.length : 0;
    const avgMoodPrev = prevEntries.length > 0 ? prevEntries.reduce((s, e) => s + e.mood, 0) / prevEntries.length : 0;
    const avgAnxietyLast = lastEntries.length > 0 ? lastEntries.reduce((s, e) => s + e.anxiety, 0) / lastEntries.length : 0;
    const avgAnxietyPrev = prevEntries.length > 0 ? prevEntries.reduce((s, e) => s + e.anxiety, 0) / prevEntries.length : 0;

    const moodTrend = avgMoodLast - avgMoodPrev;
    const anxietyTrend = avgAnxietyLast - avgAnxietyPrev;

    const TrendIcon = ({ value }: { value: number }) => {
        if (value > 3) return <TrendingUp className="w-4 h-4" />;
        if (value < -3) return <TrendingDown className="w-4 h-4" />;
        return <Minus className="w-4 h-4" />;
    };

    const handleAnalyze = async () => {
        if (!providerConfig) return;
        setIsAnalyzing(true);
        setAiError(null);
        setIsCacheHit(false);
        try {
            const worksheetsRes = await habitService.getRecentWorksheets(analysisLimit);
            if ('error' in worksheetsRes) throw new Error(worksheetsRes.error);
            
            const worksheets = worksheetsRes as { id: string; title: string; content: string }[];
            if (worksheets.length === 0) {
                throw new Error(t('moodGraphNoWorksheets'));
            }

            // Save IDs for caching
            const fileIds = worksheets.map(w => w.id).join(',');

            const systemPrompt = `Sei un esperto psicologo e analista dati. Analizza i seguenti fogli di lavoro e dati sull'umore dell'utente. Restituisci UNICAMENTE un JSON valido con questa struttura esatta, senza testo prima o dopo:
{
  "insightText": "Un paragrafo molto breve e incoraggiante con le tue deduzioni (max 3 frasi).",
  "chartData": [
    { "name": "Categoria 1 (max 2 parole)", "score": 80 },
    { "name": "Categoria 2", "score": -40 }
  ],
  "emotionsData": [
    { "emotion": "Rabbia", "score": 80 },
    { "emotion": "Gioia", "score": 90 }
  ]
}
Per 'chartData' (max 5) iscrivi nel 'name' l'abitudine/evento, e in 'score' un valore da -100 (impatto negativo) a +100 (impatto positivo).
Per 'emotionsData' (max 6), estrai le emozioni prevalenti dai testi (es. Ansia, Felicità, Stress) e assegna un'intensità da 0 a 100.`;

            const prompt = `DatI UMORE (ultimi 10): ${JSON.stringify(entries.slice(-10))}
FOGLI DI LAVORO RECENTI:
${worksheets.map(w => `TITOLO: ${w.title}\nCONTENUTO:\n${w.content}\n---\n`).join('')}`;

            const responseText = await callAI(
                providerConfig,
                systemPrompt,
                '{"insightText":"OK","chartData":[],"emotionsData":[]}',
                [{ role: 'user', content: prompt }],
                habitService.getAccessToken()
            );

            const parsed = JSON.parse(responseText);
            if (!parsed.insightText || !parsed.chartData) throw new Error(t('helpInvalidJson'));

            setAiInsights(parsed);
            localStorage.setItem(AI_CACHE_KEY, JSON.stringify(parsed));
            localStorage.setItem(AI_CACHE_IDS_KEY, fileIds);
        } catch (err: any) {
            console.error("Analysis error:", err);
            setAiError(err.message || "Failed to analyze worksheets");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleConsolidate = async () => {
        if (!providerConfig) return;
        setIsConsolidating(true);
        try {
            // Fetch all worksheets (limit 50 for consolidation)
            const worksheetsRes = await habitService.getRecentWorksheets(50);
            if ('error' in worksheetsRes) throw new Error(worksheetsRes.error);
            
            const worksheets = worksheetsRes as { id: string; title: string; content: string }[];
            if (worksheets.length < 2) {
                toast.error("Not enough worksheets to consolidate (min 2)");
                return;
            }

            const systemPrompt = "Sei un esperto psicologo. Analizza i documenti e crea un UNICO documento di riepilogo testuale che sintetizzi l'andamento del periodo. Restituisci solo il testo del riepilogo in Markdown, senza commenti extra.";
            const userPrompt = `Analizza questi documenti e crea un UNICO documento di riepilogo testuale che sintetizzi l'andamento del periodo.
            DOCUMENTI:
            ${worksheets.map(w => `TITOLO: ${w.title}\nCONTENUTO: ${w.content}`).join('\n---\n')}
            
            Restituisci solo il testo del riepilogo in Markdown, senza commenti extra.`;

            const accessToken = habitService.getAccessToken();
            const summaryText = await callAI(
                providerConfig, 
                systemPrompt, 
                "Riepilogo Storico", 
                [{ role: 'user', content: userPrompt }], 
                accessToken,
                'text'
            );

            // Archive ALL worksheets
            const allIds = worksheets.map(f => f.id);
            await habitService.archiveWorksheets(allIds);

            // Update local state to show the summary immediately
            setAiInsights({
                insightText: summaryText,
                chartData: [],
                emotionsData: []
            });
            setIsConsolidatedSummary(true);
            setSavedUrl(null);
            localStorage.removeItem(AI_CACHE_KEY);
            localStorage.removeItem(AI_CACHE_IDS_KEY);

            toast.success(t('moodGraphConsolidateSuccess'));
        } catch (err: any) {
            toast.error(err.message || "Consolidation failed");
        } finally {
            setIsConsolidating(false);
        }
    };
    const handleSaveToDrive = async () => {
        if (!aiInsights || !aiInsights.insightText) return;
        setIsSaving(true);
        try {
            const now = new Date();
            const pad = (n: number) => n < 10 ? '0' + n : String(n);
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            
            const htmlContent = markdownToHtml(aiInsights.insightText);
            const res = await habitService.createDriveDocument(`Riepilogo Consolidato - ${dateStr}`, htmlContent);
            
            if ('error' in res) throw new Error(res.error);
            
            setSavedUrl(res.fileUrl || null);
            toast.success(t('schedaSaved'));
        } catch (err: any) {
            toast.error(err.message || "Failed to save to Drive");
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-primary">{t('moodGraphTitle')}</span>
                </div>
                {entries.length > 0 && (
                    <button
                        onClick={handleClear}
                        className="text-muted-foreground hover:text-rose-400 p-1.5 rounded-md hover:bg-rose-400/10 transition-colors"
                        title={t('moodGraphClear')}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                <AnimatePresence>
                    {/* AI Insights Card ALWAYS AT THE TOP */}
                    {providerConfig && (
                        <motion.div
                            key="ai-insights-card"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 }}
                            className="bg-card/60 backdrop-blur-md rounded-xl border border-primary/20 p-4 relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-500/5 pointer-events-none" />
                            <div className="relative flex justify-between items-start mb-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Sparkles className="w-5 h-5" />
                                    <h3 className="font-semibold">{t('moodGraphAITitle')}</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select 
                                        value={analysisLimit}
                                        onChange={(e) => setAnalysisLimit(Number(e.target.value))}
                                        className="bg-background/50 border border-border rounded px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-primary/30"
                                        disabled={isAnalyzing}
                                    >
                                        <option value={7}>{t('moodGraphAILimit7')}</option>
                                        <option value={15}>{t('moodGraphAILimit15')}</option>
                                        <option value={30}>{t('moodGraphAILimit30')}</option>
                                    </select>
                                    {!aiInsights && !isAnalyzing && (
                                        <button
                                            onClick={handleAnalyze}
                                            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-all shadow-sm"
                                        >
                                            {t('moodGraphAIAnalyze')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {isCacheHit && aiInsights && (
                                <div className="mb-4 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-lg flex items-center gap-2">
                                    <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                                    <span className="text-[10px] text-primary/80 italic">{t('moodGraphAICacheHit')}</span>
                                    <button 
                                        onClick={handleAnalyze}
                                        className="ml-auto text-[10px] font-bold hover:underline underline-offset-2"
                                    >
                                        {t('helpRetry')}
                                    </button>
                                </div>
                            )}
                            
                            {isAnalyzing && (
                                <div className="flex flex-col items-center justify-center py-6 gap-3 text-muted-foreground">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                    <span className="text-sm">{t('moodGraphAIProcessing')}</span>
                                </div>
                            )}

                            {aiError && (
                                <div className="text-sm text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
                                    {aiError}
                                </div>
                            )}

                            {aiInsights && !isAnalyzing && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                    <div className="text-sm text-foreground/90 leading-relaxed bg-background/50 p-4 rounded-lg border border-border/50 overflow-hidden">
                                        {renderMarkdown(aiInsights.insightText)}
                                    </div>
                                    <div className="h-48 w-full">
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                            <BarChart data={aiInsights.chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" />
                                                <XAxis type="number" domain={[-100, 100]} tick={{ fontSize: 10, fill: '#888' }} />
                                                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#ccc' }} width={80} />
                                                <Tooltip cursor={{ fill: '#ffffff10' }} contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                                                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                                                    {aiInsights.chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.score > 0 ? '#34d399' : '#fb923c'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    {aiInsights.emotionsData && aiInsights.emotionsData.length > 0 && (
                                        <div className="h-56 w-full pt-4 border-t border-border/50">
                                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={aiInsights.emotionsData}>
                                                    <PolarGrid stroke="#444" />
                                                    <PolarAngleAxis dataKey="emotion" tick={{ fill: '#ccc', fontSize: 10 }} />
                                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#888', fontSize: 10 }} />
                                                    <Radar
                                                        name="Intensità"
                                                        dataKey="score"
                                                        stroke="#a855f7"
                                                        fill="#a855f7"
                                                        fillOpacity={0.4}
                                                    />
                                                    <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                                                </RadarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                    
                                    <div className="pt-4 border-t border-border/50">
                                        <div className="bg-secondary/10 rounded-lg p-3 space-y-2">
                                            <div className="flex items-center gap-2 text-foreground/70">
                                                <TrendingUp className="w-3.5 h-3.5" />
                                                <span className="text-xs font-semibold">{t('moodGraphConsolidate')}</span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground leading-tight">
                                                {t('moodGraphConsolidateDesc')}
                                            </p>
                                            
                                            {isConsolidatedSummary ? (
                                                <div className="space-y-3">
                                                    {!savedUrl ? (
                                                        <button
                                                            onClick={handleSaveToDrive}
                                                            disabled={isSaving}
                                                            className="w-full py-2 bg-primary/20 hover:bg-primary/30 text-primary-foreground text-[10px] font-bold rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 border border-primary/20"
                                                        >
                                                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                            {t('schedaSaveToDrive')}
                                                        </button>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-medium px-1">
                                                                <Check className="w-3 h-3" />
                                                                {t('schedaSaved')}
                                                            </div>
                                                            <a
                                                                href={savedUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-md transition-colors flex items-center justify-center gap-2 border border-emerald-500/20"
                                                            >
                                                                <ExternalLink className="w-3 h-3" />
                                                                {t('schedaOpenInDrive')}
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleConsolidate}
                                                    disabled={isConsolidating}
                                                    className="w-full py-2 bg-secondary/50 hover:bg-secondary text-[10px] font-bold rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    {isConsolidating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                    {t('moodGraphConsolidate')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    )}

                    {entries.length === 0 ? (
                        <motion.div
                            key="empty-state"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-70 py-12"
                        >
                            <BarChart3 className="w-12 h-12 text-muted-foreground" />
                            <p className="text-muted-foreground text-sm">{t('moodGraphEmpty')}</p>
                            <p className="text-muted-foreground text-xs max-w-xs">{t('moodGraphEmptyHint')}</p>
                        </motion.div>
                    ) : (
                        <>
                            {/* Trend cards */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="grid grid-cols-2 gap-3"
                        >
                            {/* Mood card */}
                            <div className="bg-card/60 backdrop-blur-md rounded-xl border border-border/50 p-4 space-y-1">
                                <p className="text-xs text-muted-foreground">{t('moodGraphMoodAvg')}</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-bold text-emerald-400">{Math.round(avgMoodLast)}</span>
                                    <span className={cn(
                                        "flex items-center gap-0.5 text-xs font-medium",
                                        moodTrend > 3 ? "text-emerald-400" : moodTrend < -3 ? "text-rose-400" : "text-muted-foreground"
                                    )}>
                                        <TrendIcon value={moodTrend} />
                                        {moodTrend > 0 ? '+' : ''}{Math.round(moodTrend)}
                                    </span>
                                </div>
                            </div>
                            {/* Anxiety card */}
                            <div className="bg-card/60 backdrop-blur-md rounded-xl border border-border/50 p-4 space-y-1">
                                <p className="text-xs text-muted-foreground">{t('moodGraphAnxietyAvg')}</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-bold text-orange-400">{Math.round(avgAnxietyLast)}</span>
                                    <span className={cn(
                                        "flex items-center gap-0.5 text-xs font-medium",
                                        anxietyTrend < -3 ? "text-emerald-400" : anxietyTrend > 3 ? "text-rose-400" : "text-muted-foreground"
                                    )}>
                                        <TrendIcon value={-anxietyTrend} />
                                        {anxietyTrend > 0 ? '+' : ''}{Math.round(anxietyTrend)}
                                    </span>
                                </div>
                            </div>
                        </motion.div>



                        {/* Mood chart */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-card/60 backdrop-blur-md rounded-xl border border-border/50 p-4"
                        >
                            <h3 className="text-sm font-semibold mb-3 text-foreground">{t('moodGraphMoodTrend')}</h3>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data}>
                                        <defs>
                                            <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#888' }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                                            labelStyle={{ color: '#ccc' }}
                                        />
                                        <Area type="monotone" dataKey="mood" stroke="#34d399" fill="url(#moodGrad)" strokeWidth={2} name={t('moodGraphMood') as string} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </motion.div>

                        {/* Anxiety chart */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-card/60 backdrop-blur-md rounded-xl border border-border/50 p-4"
                        >
                            <h3 className="text-sm font-semibold mb-3 text-foreground">{t('moodGraphAnxietyTrend')}</h3>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data}>
                                        <defs>
                                            <linearGradient id="anxGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#888' }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                                            labelStyle={{ color: '#ccc' }}
                                        />
                                        <Area type="monotone" dataKey="anxiety" stroke="#fb923c" fill="url(#anxGrad)" strokeWidth={2} name={t('moodGraphAnxiety') as string} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </motion.div>

                        {/* Recent entries */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="space-y-2"
                        >
                            <h3 className="text-sm font-semibold text-foreground px-1">{t('moodGraphRecent')}</h3>
                            {entries.slice(-10).reverse().map((entry, i) => (
                                <div key={i} className="bg-card/40 rounded-lg border border-border/30 px-4 py-2.5 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-3">
                                        <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleDateString()}</span>
                                        <span className="text-foreground font-medium">{entry.label}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-emerald-400">😊 {entry.mood}</span>
                                        <span className="text-orange-400">😰 {entry.anxiety}</span>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    </>
                )}
                </AnimatePresence>
            </div>
        </div>
    );
}
