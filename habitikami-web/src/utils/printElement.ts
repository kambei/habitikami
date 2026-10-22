/**
 * Prints one element on its own: the element is cloned into a fresh window
 * together with the app stylesheets, so the browser paginates it normally
 * (the app shell is a fixed-height, overflow-hidden layout that clips
 * printing to a single page). Charts are SVG and print as vectors.
 */
export function printElement(node: HTMLElement, title: string): void {
    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) {
        window.print();
        return;
    }
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('\n');
    const html = `<!doctype html><html lang="${document.documentElement.lang || 'en'}" class="${document.documentElement.className}"><head>
<meta charset="utf-8"><title>${escapeHtml(title)}</title>${styles}
<style>
  html, body { background: #fff !important; color: #111 !important; height: auto !important; overflow: visible !important; }
  body { margin: 0; padding: 24px; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  #print-root * { color: #111 !important; box-shadow: none !important; }
  #print-root .text-muted-foreground, #print-root [class*="text-muted-foreground"] { color: #555 !important; }
  #print-root [class*="bg-"] { background: transparent !important; }
  #print-root [class*="border"] { border-color: #ccc !important; }
  #print-root .print\\:hidden, #print-root button { display: none !important; }
  #print-root li, #print-root .rounded-xl { break-inside: avoid; page-break-inside: avoid; }
  #print-root .recharts-responsive-container { width: 100% !important; }
  @page { margin: 14mm; }
</style></head><body><div id="print-root">${node.outerHTML}</div></body></html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
    const done = () => { try { win.focus(); win.print(); } catch { /* ignore */ } };
    // Give fonts and stylesheets a moment; onload may already have fired for about:blank
    if (win.document.readyState === 'complete') setTimeout(done, 400);
    else win.addEventListener('load', () => setTimeout(done, 400));
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
