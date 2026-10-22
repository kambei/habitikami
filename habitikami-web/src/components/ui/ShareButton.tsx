import { useState } from 'react';
import { Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '../../i18n';
import { shareCard } from '../../utils/shareCard';
import type { ShareCardSpec } from '../ShareCardTemplate';

interface Props {
    spec: () => ShareCardSpec;
    fileName?: string;
    className?: string;
    label?: boolean;
}

/** Renders the card and shares or downloads it; shows a spinner meanwhile. */
export function ShareButton({ spec, fileName, className = '', label = false }: Props) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const run = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setBusy(true);
        try {
            const out = await shareCard(spec(), fileName);
            if (out === 'downloaded') toast.success(t('shareDownloaded'));
        } catch (err) {
            toast.error(t('shareFailed').replace('{error}', err instanceof Error ? err.message : t('toastUnknownError')));
        } finally {
            setBusy(false);
        }
    };
    return (
        <button type="button" onClick={run} disabled={busy} title={t('shareCard')} aria-label={t('shareCard')} className={`inline-flex items-center gap-1.5 rounded-md hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 ${label ? 'px-3 py-1.5 text-xs font-medium bg-secondary' : 'p-1.5'} ${className}`}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
            {label && t('shareCard')}
        </button>
    );
}
