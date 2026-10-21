import { useEffect, useState } from 'react';
import { Smartphone, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { useTranslation } from '../i18n';
import { buildPairingUri, buildPairingWebUrl, isAndroidBrowser } from '../utils/widgetPairing';

interface Props {
    /** The freshly generated API key (plain text, shown once). */
    apiKey: string;
}

/**
 * Lets the user configure the Android widgets without typing the API key:
 * a one-tap button on the phone, a QR code to scan from a desktop browser.
 */
export function WidgetPairing({ apiKey }: Props) {
    const { t } = useTranslation();
    const android = isAndroidBrowser();
    const [qr, setQr] = useState<string | null>(null);

    useEffect(() => {
        if (android) return;
        let cancelled = false;
        QRCode.toDataURL(buildPairingWebUrl(apiKey), { width: 220, margin: 1, errorCorrectionLevel: 'M' })
            .then(url => { if (!cancelled) setQr(url); })
            .catch(() => { if (!cancelled) setQr(null); });
        return () => { cancelled = true; };
    }, [apiKey, android]);

    return (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 space-y-2">
            <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-sky-300" />
                <p className="text-xs font-medium text-sky-200">{t('widgetPairTitle')}</p>
            </div>
            {android ? (
                <>
                    <p className="text-[11px] text-muted-foreground">{t('widgetPairPhoneHint')}</p>
                    <a
                        href={buildPairingUri(apiKey)}
                        className="flex items-center justify-center gap-2 text-xs font-medium px-3 py-2.5 rounded-lg bg-sky-500/20 text-sky-200 hover:bg-sky-500/30 transition-all"
                    >
                        <Smartphone className="w-3.5 h-3.5" />
                        {t('widgetPairButton')}
                    </a>
                </>
            ) : (
                <div className="flex gap-3 items-start">
                    {qr ? (
                        <img src={qr} alt={t('widgetPairQrAlt')} width={110} height={110} className="rounded bg-white p-1 shrink-0" />
                    ) : (
                        <div className="w-[110px] h-[110px] rounded bg-background/40 flex items-center justify-center shrink-0">
                            <QrCode className="w-6 h-6 text-muted-foreground" />
                        </div>
                    )}
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{t('widgetPairQrHint')}</p>
                </div>
            )}
        </div>
    );
}
