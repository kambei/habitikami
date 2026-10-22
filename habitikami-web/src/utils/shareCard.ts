import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';
import { ShareCardTemplate, type ShareCardSpec } from '../components/ShareCardTemplate';

/**
 * Shareable cards (issue #10): the card is rendered off-screen, rasterised
 * to PNG and handed to the Web Share API (Android, iOS) or downloaded.
 * No public page: only the image leaves the device.
 */

export async function renderShareCard(spec: ShareCardSpec): Promise<Blob> {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;width:1080px;pointer-events:none;';
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
        root.render(createElement(ShareCardTemplate, { spec }));
        await new Promise(r => setTimeout(r, 350)); // layout, fonts and emoji
        const node = host.firstElementChild as HTMLElement;
        const dataUrl = await toPng(node, { pixelRatio: 1, cacheBust: true, width: 1080, height: 1080 });
        const res = await fetch(dataUrl);
        return await res.blob();
    } finally {
        root.unmount();
        host.remove();
    }
}

export function canShareFiles(): boolean {
    try {
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
        return typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] });
    } catch {
        return false;
    }
}

/** Shares the card where possible, otherwise downloads it. Returns how it went out. */
export async function shareCard(spec: ShareCardSpec, fileName = 'habitikami.png'): Promise<'shared' | 'downloaded' | 'cancelled'> {
    const blob = await renderShareCard(spec);
    const file = new File([blob], fileName, { type: 'image/png' });
    if (canShareFiles()) {
        try {
            await navigator.share({ files: [file], title: spec.title });
            return 'shared';
        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
            // fall through to download
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
}
