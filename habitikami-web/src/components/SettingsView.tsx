import { useEffect, useState } from 'react';
import { Key, Check, Settings, Copy, Trash2, Eye, EyeOff, Table2, FilePlus2, Loader2, LayoutTemplate } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from '../i18n';
import { extractSpreadsheetId } from '../utils/spreadsheetId';
import { habitService } from '../services/HabitService';
import { TemptationSettings } from './TemptationSettings';
import { HabitTemplatesPicker } from './HabitTemplatesPicker';
import { WidgetPairing } from './WidgetPairing';
import { PushSettings } from './PushSettings';
import { AIKeyWizard } from './AIKeyWizard';
import { getAnthropicKey, getGeminiKey } from '../utils/aiProvider';
import { errorMessage } from '../utils/errors';

/**
 * Settings view (hamburger → Settings): spreadsheet, API key for the widgets,
 * push reminders, temptations, habit templates and the AI assistant setup.
 */
export function SettingsView({ onBack }: { onBack: () => void }) {
    const { t } = useTranslation();

    // API key state
    const [apiKeyInfo, setApiKeyInfo] = useState<{ has_key: boolean; masked_key?: string; created_at?: string } | null>(null);
    const [newApiKey, setNewApiKey] = useState<string | null>(null);
    const [apiKeyLoading, setApiKeyLoading] = useState(false);
    const [apiKeyCopied, setApiKeyCopied] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [apiKeyRegenerated, setApiKeyRegenerated] = useState(false);
    const [templatesOpen, setTemplatesOpen] = useState(false);
    const [apiKeyError, setApiKeyError] = useState<string | null>(null);

    // Spreadsheet ID state
    const [tempSpreadsheetId, setTempSpreadsheetId] = useState(() => habitService.getStoredSpreadsheetId() || '');
    const [spreadsheetSaved, setSpreadsheetSaved] = useState(false);
    const [spreadsheetError, setSpreadsheetError] = useState<string | null>(null);
    const [spreadsheetCreating, setSpreadsheetCreating] = useState(false);

    // Re-render after the AI wizard saved or removed a key
    const [keysVersion, setKeysVersion] = useState(0);
    const bothKeys = keysVersion >= 0 && !!getGeminiKey() && !!getAnthropicKey();

    const loadApiKeyInfo = async () => {
        const result = await habitService.getApiKeyInfo();
        if (!('error' in result)) {
            setApiKeyInfo(result);
        }
    };

    const handleGenerateApiKey = async () => {
        // Regenerating invalidates the key the Android widgets hold: ask first
        const isRegeneration = !!apiKeyInfo?.has_key;
        if (isRegeneration && !window.confirm(t('settingsApiKeyRegenerateConfirm'))) return;
        setApiKeyLoading(true);
        setApiKeyError(null);
        setNewApiKey(null);
        const result = await habitService.generateApiKey();
        if ('error' in result) {
            setApiKeyError(result.error);
        } else {
            setNewApiKey(result.api_key);
            setShowApiKey(true);
            setApiKeyRegenerated(isRegeneration);
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
            setApiKeyRegenerated(false);
        }
        setApiKeyLoading(false);
    };

    const handleSaveSpreadsheetId = async () => {
        if (!tempSpreadsheetId.trim()) return;
        // Accept the whole Google Sheets link too (what people usually copy)
        const id = extractSpreadsheetId(tempSpreadsheetId);
        if (!id) {
            setSpreadsheetError(t('settingsSpreadsheetInvalid'));
            return;
        }
        setTempSpreadsheetId(id);
        setSpreadsheetError(null);
        habitService.setSpreadsheetId(id);
        // Also register on server
        try {
            await fetch('/api/user/spreadsheet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${habitService.getAccessToken()}`,
                },
                body: JSON.stringify({ spreadsheet_id: id }),
            });
        } catch { /* best effort */ }
        setSpreadsheetSaved(true);
        setTimeout(() => setSpreadsheetSaved(false), 3000);
    };

    const handleCreateNewSheet = async () => {
        setSpreadsheetCreating(true);
        setSpreadsheetError(null);
        setSpreadsheetSaved(false);
        try {
            const result = await habitService.createInitialTemplate();
            if (result.error) {
                setSpreadsheetError(result.error);
            } else if (result.spreadsheetId) {
                // Register on server
                try {
                    await fetch('/api/user/spreadsheet', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${habitService.getAccessToken()}`,
                        },
                        body: JSON.stringify({ spreadsheet_id: result.spreadsheetId }),
                    });
                } catch { /* best effort */ }
                setTempSpreadsheetId(result.spreadsheetId);
                setSpreadsheetSaved(true);
                setTimeout(() => setSpreadsheetSaved(false), 3000);
            }
        } catch (e: unknown) {
            setSpreadsheetError(errorMessage(e) || t('settingsSpreadsheetCreateError'));
        }
        setSpreadsheetCreating(false);
    };

    const handleCopyApiKey = async () => {
        if (!newApiKey) return;
        await navigator.clipboard.writeText(newApiKey);
        setApiKeyCopied(true);
        setTimeout(() => setApiKeyCopied(false), 2000);
    };

    useEffect(() => {
        const id = setTimeout(() => { loadApiKeyInfo(); }, 0);
        return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
            <div className="flex-1 flex items-start justify-center p-4 overflow-y-auto">
                <div className="max-w-lg w-full bg-card/60 backdrop-blur-md rounded-2xl border border-border/50 p-6 md:p-8 shadow-xl space-y-6 my-auto">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            aria-label={t('prev')}
                            className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-foreground/5 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-bold text-foreground">{t('helpSettingsTitle')}</h2>
                        </div>
                    </div>

                    {/* 1. Spreadsheet ID Management */}
                    <div className="rounded-xl border border-border/50 bg-background/30 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-emerald-500/15 rounded-lg flex items-center justify-center">
                                <Table2 className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">{t('settingsSpreadsheetTitle')}</h3>
                                <span className="text-[10px] text-muted-foreground">{t('settingsSpreadsheetDesc')}</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={tempSpreadsheetId}
                                onChange={e => { setTempSpreadsheetId(e.target.value); setSpreadsheetSaved(false); setSpreadsheetError(null); }}
                                placeholder={t('settingsSpreadsheetPlaceholder')}
                                className="flex-1 text-xs bg-background/70 px-3 py-2.5 rounded-lg font-mono border border-border/30 focus:border-primary/50 focus:outline-none transition-colors"
                            />
                            <button
                                type="button"
                                onClick={handleSaveSpreadsheetId}
                                disabled={!tempSpreadsheetId.trim() || spreadsheetSaved}
                                className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {spreadsheetSaved ? <Check className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
                                {spreadsheetSaved ? t('settingsSpreadsheetSaved') : 'Save'}
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handleCreateNewSheet}
                            disabled={spreadsheetCreating}
                            className="w-full flex items-center justify-center gap-2 text-xs font-medium px-3 py-2.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {spreadsheetCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus2 className="w-3.5 h-3.5" />}
                            {spreadsheetCreating ? t('settingsSpreadsheetCreating') : t('settingsSpreadsheetCreate')}
                        </button>

                        {spreadsheetError && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                                <p className="text-xs text-red-400">{spreadsheetError}</p>
                            </div>
                        )}
                    </div>

                    {/* 2. Habitikami API Key Management */}
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
                                    {newApiKey && apiKeyRegenerated && (
                                        <p className="text-xs text-amber-300">{t('settingsApiKeyRegeneratedNote')}</p>
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
                                    {newApiKey && <WidgetPairing apiKey={newApiKey} />}
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

                    {/* 2b. Push reminders */}
                    <div className="border-t border-border/50 pt-5">
                        <PushSettings />
                    </div>

                    {/* 3. Temptation Management */}
                    <div className="border-t border-border/50 pt-5">
                        <TemptationSettings />
                    </div>

                    {/* 3b. Habit templates */}
                    <div className="border-t border-border/50 pt-5 rounded-xl">
                        <div className="rounded-xl border border-border/50 bg-background/30 p-4 flex items-center gap-3">
                            <div className="w-8 h-8 bg-violet-500/15 rounded-lg flex items-center justify-center shrink-0">
                                <LayoutTemplate className="w-4 h-4 text-violet-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm">{t('settingsTemplatesTitle')}</h3>
                                <span className="text-[10px] text-muted-foreground">{t('settingsTemplatesDesc')}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setTemplatesOpen(true)}
                                className="shrink-0 text-xs font-medium px-3 py-2 rounded-lg bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 transition-all"
                            >
                                {t('settingsTemplatesOpen')}
                            </button>
                        </div>
                        <HabitTemplatesPicker isOpen={templatesOpen} onClose={() => setTemplatesOpen(false)} />
                    </div>

                    {/* 4. AI assistant: guided key setup (issue #25) */}
                    <div className="border-t border-border/50 pt-5">
                        <AIKeyWizard onConfigured={() => setKeysVersion(v => v + 1)} />
                        {bothKeys && (
                            <p className="text-xs text-purple-300/80 text-center italic px-2 mt-3">{t('helpProviderPriority')}</p>
                        )}
                    </div>
                </div>
            </div>
    );
}
