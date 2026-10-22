import { useEffect, useState } from 'react';
import { Check, ExternalLink, KeyRound, Loader2, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { useTranslation } from '../i18n';
import { habitService } from '../services/HabitService';
import {
    type AIProvider, type AIStatus, PROVIDER_CONSOLE_URL, fetchAiStatus, getAnthropicKey, getGeminiKey,
    getProviderLabel, setAnthropicKey, setGeminiKey, setSharedProvider, validateApiKey,
} from '../utils/aiProvider';

interface Props {
    /** Called after a key was saved or the shared key chosen. */
    onConfigured: () => void;
}

type Step = 'provider' | 'key' | 'done';

/**
 * Guided setup of the assistant (issue #25): choose a provider, open its
 * console, paste the key, have it checked with a real call, save. When the
 * server offers a shared key, one tap uses it instead.
 */
export function AIKeyWizard({ onConfigured }: Props) {
    const { t } = useTranslation();
    const [status, setStatus] = useState<AIStatus | null>(null);
    const [provider, setProvider] = useState<AIProvider | null>(null);
    const [step, setStep] = useState<Step>('provider');
    const [key, setKey] = useState('');
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState<{ valid: boolean; error?: string } | null>(null);
    const configured = { gemini: !!getGeminiKey(), anthropic: !!getAnthropicKey() };

    useEffect(() => {
        let cancelled = false;
        fetchAiStatus(habitService.getAccessToken()).then(s => { if (!cancelled) setStatus(s); });
        return () => { cancelled = true; };
    }, []);

    const choose = (p: AIProvider) => {
        setProvider(p);
        setKey(p === 'gemini' ? getGeminiKey() : getAnthropicKey());
        setResult(null);
        setStep('key');
    };

    const check = async () => {
        if (!provider || !key.trim()) return;
        setChecking(true);
        setResult(null);
        try {
            const r = await validateApiKey(provider, key.trim(), habitService.getAccessToken());
            setResult(r);
            if (r.valid) {
                if (provider === 'gemini') setGeminiKey(key.trim()); else setAnthropicKey(key.trim());
                setStep('done');
                onConfigured();
            }
        } catch (e) {
            setResult({ valid: false, error: e instanceof Error ? e.message : t('toastUnknownError') });
        } finally {
            setChecking(false);
        }
    };

    const useShared = () => {
        if (!status?.shared) return;
        setSharedProvider(status.shared.provider);
        setStep('done');
        onConfigured();
    };

    const remove = (p: AIProvider) => {
        if (p === 'gemini') setGeminiKey(''); else setAnthropicKey('');
        setKey('');
        setResult(null);
        onConfigured();
    };

    const fmt = (s: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), s);

    return (
        <div className="rounded-xl border border-border/50 bg-background/30 p-4 space-y-4">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary/15 rounded-lg flex items-center justify-center"><KeyRound className="w-4 h-4 text-primary" /></div>
                <div>
                    <h3 className="font-semibold text-sm">{t('aiWizardTitle')}</h3>
                    <span className="text-[10px] text-muted-foreground">{t('aiWizardDesc')}</span>
                </div>
            </div>

            {status?.shared && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start gap-3">
                    <Users className="w-4 h-4 text-emerald-300 mt-0.5 shrink-0" />
                    <div className="flex-1 text-xs">
                        <p className="font-medium text-emerald-200">{t('aiSharedTitle')}</p>
                        <p className="text-muted-foreground">{fmt(t('aiSharedDesc'), { provider: getProviderLabel(status.shared.provider), remaining: status.shared.remaining, quota: status.shared.quota })}</p>
                    </div>
                    <button type="button" onClick={useShared} className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30">{t('aiSharedUse')}</button>
                </div>
            )}

            {/* Step 1: provider */}
            <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">1 · {t('aiStepProvider')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {([['gemini', ShieldCheck, 'text-blue-400', t('aiGeminiPitch')], ['anthropic', Sparkles, 'text-purple-400', t('aiAnthropicPitch')]] as const).map(([p, Icon, tone, pitch]) => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => choose(p)}
                            aria-pressed={provider === p}
                            className={`text-left rounded-lg border p-3 transition-colors ${provider === p ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/40'}`}
                        >
                            <div className="flex items-center gap-2 text-sm font-medium"><Icon className={`w-4 h-4 ${tone}`} />{getProviderLabel(p)}
                                {configured[p] && <span className="ml-auto text-[10px] text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" />{t('helpProviderConfigured')}</span>}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-1">{pitch}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Step 2: key */}
            {provider && step !== 'provider' && (
                <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">2 · {t('aiStepKey')}</p>
                    <a href={PROVIDER_CONSOLE_URL[provider]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80">
                        <ExternalLink className="w-3.5 h-3.5" /> {fmt(t('aiOpenConsole'), { provider: getProviderLabel(provider) })}
                    </a>
                    <p className="text-[11px] text-muted-foreground">{t(provider === 'gemini' ? 'aiGeminiHow' : 'aiAnthropicHow')}</p>
                    <div className="flex gap-2">
                        <input
                            type="password"
                            value={key}
                            onChange={e => { setKey(e.target.value); setResult(null); }}
                            placeholder={provider === 'gemini' ? 'AIzaSy…' : 'sk-ant-…'}
                            aria-label={t('aiStepKey')}
                            className="flex-1 min-w-0 px-3 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <button type="button" onClick={check} disabled={checking || !key.trim()} className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
                            {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t('aiCheckKey')}
                        </button>
                    </div>
                    {result && !result.valid && (
                        <p className="text-xs text-red-400 flex items-start gap-1.5"><X className="w-3.5 h-3.5 mt-0.5 shrink-0" />{fmt(t('aiKeyInvalid'), { error: result.error ?? '' })}</p>
                    )}
                    {step === 'done' && result?.valid && (
                        <p className="text-xs text-emerald-400 flex items-center gap-1.5"><Check className="w-3.5 h-3.5" />{t('aiKeySaved')}</p>
                    )}
                    {configured[provider] && (
                        <button type="button" onClick={() => remove(provider)} className="text-[11px] text-red-400 hover:underline">{t('aiRemoveKey')}</button>
                    )}
                    <p className="text-[10px] text-muted-foreground">{t('aiCostNote')}</p>
                </div>
            )}
        </div>
    );
}
