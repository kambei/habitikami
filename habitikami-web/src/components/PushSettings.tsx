import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '../i18n';
import { habitService } from '../services/HabitService';
import { useHabitMeta } from '../hooks/useHabitMutations';
import type { PushPrefs, PushSettings as Settings } from '../types';
import { currentPushSubscription, isPushSupported, subscribeBrowser } from '../utils/push';
import { SLOT_DEFAULT_TIMES } from '../utils/slots';

/** Help → Settings panel for the push reminders (issue #11). */
export function PushSettings() {
    const { t, language } = useTranslation();
    const { data: habitMeta } = useHabitMeta();
    const supported = isPushSupported();
    const [settings, setSettings] = useState<Settings | null>(null);
    const [thisDevice, setThisDevice] = useState<PushSubscription | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!supported) return;
        let cancelled = false;
        Promise.all([habitService.getPushSettings(), currentPushSubscription()]).then(([s, sub]) => {
            if (cancelled) return;
            if (!('error' in s)) setSettings(s);
            setThisDevice(sub);
        });
        return () => { cancelled = true; };
    }, [supported]);

    const run = async (fn: () => Promise<Settings | { error: string }>) => {
        setBusy(true);
        setError(null);
        try {
            const res = await fn();
            if ('error' in res) setError(res.error);
            else setSettings(res);
        } catch (e) {
            setError(e instanceof Error && e.message === 'permission-denied' ? t('pushPermissionDenied') : (e instanceof Error ? e.message : t('toastUnknownError')));
        } finally {
            setBusy(false);
        }
    };

    const enable = () => run(async () => {
        const key = await habitService.getPushPublicKey();
        if ('error' in key) return key;
        const sub = await subscribeBrowser(key.key);
        setThisDevice(sub);
        return habitService.subscribePush(sub.toJSON(), language);
    });

    const disable = () => run(async () => {
        const endpoint = thisDevice?.endpoint ?? null;
        await thisDevice?.unsubscribe().catch(() => {});
        setThisDevice(null);
        return habitService.unsubscribePush(endpoint);
    });

    const savePrefs = (patch: Partial<PushPrefs>) => run(() => habitService.savePushPrefs(patch));

    const test = async () => {
        setBusy(true);
        const res = await habitService.sendTestPush();
        setBusy(false);
        if ('error' in res) toast.error(res.error);
        else toast.success(t('pushTestSent').replace('{n}', String(res.sent)));
    };

    const habits = Object.entries(habitMeta ?? {}).filter(([, m]) => m.time || m.slot !== 'any');
    const prefs = settings?.prefs;
    const onThisDevice = !!thisDevice && !!settings?.enabled;

    return (
        <div className="rounded-xl border border-border/50 bg-background/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-sky-500/15 rounded-lg flex items-center justify-center">
                    <Bell className="w-4 h-4 text-sky-400" />
                </div>
                <div>
                    <h3 className="font-semibold text-sm">{t('pushTitle')}</h3>
                    <span className="text-[10px] text-muted-foreground">{t('pushDesc')}</span>
                </div>
            </div>

            {!supported ? (
                <p className="text-xs text-muted-foreground">{t('pushUnsupported')}</p>
            ) : (
                <>
                    <div className="flex flex-wrap gap-2 items-center">
                        {onThisDevice ? (
                            <button type="button" onClick={disable} disabled={busy} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 disabled:opacity-40">
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellOff className="w-3.5 h-3.5" />}
                                {t('pushDisable')}
                            </button>
                        ) : (
                            <button type="button" onClick={enable} disabled={busy} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 disabled:opacity-40">
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                                {t('pushEnable')}
                            </button>
                        )}
                        {settings?.enabled && (
                            <button type="button" onClick={test} disabled={busy} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 disabled:opacity-40">
                                <Send className="w-3.5 h-3.5" /> {t('pushTest')}
                            </button>
                        )}
                        {settings && settings.devices > 0 && (
                            <span className="text-[11px] text-muted-foreground">{t('pushDevices').replace('{n}', String(settings.devices))}</span>
                        )}
                    </div>
                    {settings?.enabled && !settings.hasRefreshToken && (
                        <p className="text-xs text-amber-300">{t('pushNoRefreshToken')}</p>
                    )}
                    {error && <p className="text-xs text-red-400">{error}</p>}

                    {settings?.enabled && prefs && (
                        <div className="space-y-2 pt-1 text-sm">
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={prefs.habitReminders} disabled={busy} onChange={e => savePrefs({ habitReminders: e.target.checked })} />
                                <span>{t('pushHabitReminders')}</span>
                            </label>
                            <label className="flex items-center gap-2 flex-wrap">
                                <input type="checkbox" checked={prefs.eveningReminder} disabled={busy} onChange={e => savePrefs({ eveningReminder: e.target.checked })} />
                                <span>{t('pushEvening')}</span>
                                <input type="time" value={prefs.eveningTime} disabled={busy || !prefs.eveningReminder} onChange={e => e.target.value && savePrefs({ eveningTime: e.target.value })} className="bg-background border border-border rounded px-2 py-0.5 text-xs" />
                            </label>
                            <label className="flex items-center gap-2 flex-wrap">
                                <input type="checkbox" checked={prefs.weeklyReport} disabled={busy} onChange={e => savePrefs({ weeklyReport: e.target.checked })} />
                                <span>{t('pushWeekly')}</span>
                                <input type="time" value={prefs.weeklyTime} disabled={busy || !prefs.weeklyReport} onChange={e => e.target.value && savePrefs({ weeklyTime: e.target.value })} className="bg-background border border-border rounded px-2 py-0.5 text-xs" />
                            </label>
                            {prefs.habitReminders && habits.length > 0 && (
                                <div className="pt-1">
                                    <p className="text-[11px] text-muted-foreground mb-1">{t('pushMuteHint')}</p>
                                    <ul className="space-y-1">
                                        {habits.map(([name, m]) => {
                                            const muted = prefs.muted.includes(name);
                                            return (
                                                <li key={name} className="flex items-center gap-2 text-xs">
                                                    <input
                                                        type="checkbox"
                                                        checked={!muted}
                                                        disabled={busy}
                                                        onChange={e => savePrefs({ muted: e.target.checked ? prefs.muted.filter(h => h !== name) : [...prefs.muted, name] })}
                                                    />
                                                    <span className={muted ? 'line-through text-muted-foreground' : ''}>{name}</span>
                                                    <span className="text-muted-foreground">{m.time || SLOT_DEFAULT_TIMES[m.slot]}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}
                            {prefs.habitReminders && habits.length === 0 && (
                                <p className="text-[11px] text-muted-foreground">{t('pushNoHabitTimes')}</p>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
