import { useQueryClient } from '@tanstack/react-query';
import { CloudUpload, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePendingWrites } from '../../hooks/useOnlineStatus';
import { replayQueue } from '../../utils/offlineSync';
import { useTranslation } from '../../i18n';

/** Header pill: offline state and the number of changes waiting to sync (tap to retry). */
export function OnlineIndicator() {
    const { t } = useTranslation();
    const online = useOnlineStatus();
    const pending = usePendingWrites();
    const queryClient = useQueryClient();

    if (online && pending === 0) return null;
    const label = !online ? t('offlineBadge') : t('offlineQueued').replace('{n}', String(pending));
    return (
        <button
            type="button"
            onClick={() => { if (online) replayQueue(queryClient).catch(() => {}); }}
            title={pending > 0 ? t('offlineQueuedHint').replace('{n}', String(pending)) : label}
            className={`h-8 px-2.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 shrink-0 ${online ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25' : 'bg-rose-500/15 text-rose-300'}`}
        >
            {online ? <CloudUpload className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{label}</span>
            {pending > 0 && <span className="sm:hidden">{pending}</span>}
        </button>
    );
}
