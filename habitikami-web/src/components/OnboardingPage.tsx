import { useState } from 'react';
import { habitService } from '../services/HabitService';
import { toast } from 'sonner';
import { Loader2, Plus, Link as LinkIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from '../i18n';

interface Props {
    email: string;
    onComplete: (spreadsheetId: string) => void;
}

export function OnboardingPage({ email, onComplete }: Props) {
    const { t } = useTranslation();
    const [spreadsheetId, setSpreadsheetId] = useState('');
    const [saving, setSaving] = useState(false);
    const [creating, setCreating] = useState(false);
    const [isManualAuth, setIsManualAuth] = useState(false);

    const checkAndSaveSpreadsheet = async (id: string) => {
        try {
            const res = await fetch('/api/user/spreadsheet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${habitService.getAccessToken()}`,
                },
                body: JSON.stringify({ spreadsheet_id: id }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                toast.error(data.error || 'Failed to link spreadsheet ID');
                return false;
            }
            habitService.setSpreadsheetId(id);
            return true;
        } catch {
            toast.error('Network error — please try again');
            return false;
        }
    };

    const handleCreateTemplate = async () => {
        setCreating(true);
        try {
            const result = await habitService.createInitialTemplate();
            
            if (result.error) {
                toast.error("Error creating template: " + result.error);
                return;
            }
            
            if (result.spreadsheetId) {
                toast.success('Tracker created successfully!');
                const saved = await checkAndSaveSpreadsheet(result.spreadsheetId);
                if (saved) {
                    onComplete(result.spreadsheetId);
                }
            } else {
                toast.error("Unknown error creating template");
            }
        } catch (e: any) {
            toast.error("Failed to create template: " + e.message);
        } finally {
            setCreating(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const id = spreadsheetId.trim();
        if (!id) {
            toast.error('Please enter a Spreadsheet ID');
            return;
        }
        setSaving(true);
        const saved = await checkAndSaveSpreadsheet(id);
        setSaving(false);
        if (saved) {
            toast.success('Spreadsheet linked successfully!');
            onComplete(id);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                        {t('onboardingWelcome')}
                    </h1>
                    <p className="text-muted-foreground text-sm">{t('onboardingSignedAs')} {email}</p>
                </div>

                <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                    <div>
                        <h2 className="font-semibold text-lg">{t('onboardingGetStarted')}</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('onboardingDesc')}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={handleCreateTemplate}
                            disabled={creating || saving}
                            className={cn(
                                "w-full py-4 px-4 rounded-lg font-medium shadow-md transition-all flex items-center justify-center gap-2",
                                creating
                                    ? "bg-secondary text-secondary-foreground opacity-70 cursor-wait"
                                    : "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02]"
                            )}
                        >
                            {creating ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    {t('onboardingCreating')}
                                </>
                            ) : (
                                <>
                                    <Plus className="w-5 h-5" />
                                    {t('onboardingAutoCreate')}
                                </>
                            )}
                        </button>
                        
                        {creating && (
                            <p className="text-xs text-center text-muted-foreground animate-pulse">
                                {t('onboardingWait')}
                            </p>
                        )}
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">{t('or')}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                         <button
                            onClick={() => setIsManualAuth(!isManualAuth)}
                            className="w-full py-2 px-4 rounded-lg bg-secondary/50 text-secondary-foreground font-medium text-sm hover:bg-secondary transition-colors flex items-center justify-center gap-2"
                        >
                            <LinkIcon className="w-4 h-4" />
                            {isManualAuth ? t('onboardingHideManual') : t('onboardingConnect')}
                        </button>

                        {isManualAuth && (
                            <form onSubmit={handleSubmit} className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <label htmlFor="spreadsheet-id" className="text-sm font-medium">
                                        {t('onboardingSpreadsheetId')}
                                    </label>
                                    <input
                                        id="spreadsheet-id"
                                        type="text"
                                        value={spreadsheetId}
                                        onChange={e => setSpreadsheetId(e.target.value)}
                                        placeholder="e.g. YOUR_SPREADSHEET_ID"
                                        className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        disabled={saving || creating}
                                    />
                                    <p className="text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('onboardingSpreadsheetHint') }} />
                                </div>

                                <button
                                    type="submit"
                                    disabled={saving || creating || !spreadsheetId.trim()}
                                    className="w-full py-2 px-4 rounded-lg bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {saving ? t('onboardingLinking') : t('onboardingLinkSheet')}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
