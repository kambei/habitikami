import { RefreshCw, WifiOff, AlertTriangle } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useTranslation } from '../../i18n';

interface Props {
    error?: string | null;
    onRetry: () => void;
}

/** Replaces a spinner that would never end: offline or Google unreachable, with a retry (issue #72). */
export function LoadError({ error, onRetry }: Props) {
    const { t } = useTranslation();
    const online = useOnlineStatus();
    const offline = !online;
    return (
        <div className="flex flex-col items-center justify-center text-center gap-4 p-8">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${offline ? 'bg-rose-500/10 text-rose-300' : 'bg-amber-500/10 text-amber-300'}`}>
                {offline ? <WifiOff size={30} /> : <AlertTriangle size={30} />}
            </div>
            <div>
                <h2 className="text-lg font-semibold">{offline ? t('offlineLoadTitle') : t('offlineErrorTitle')}</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">{offline ? t('offlineLoadHint') : (error || t('offlineErrorHint'))}</p>
            </div>
            <button type="button" onClick={onRetry} className="flex items-center gap-2 px-5 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-medium">
                <RefreshCw className="w-4 h-4" /> {t('retry')}
            </button>
        </div>
    );
}
