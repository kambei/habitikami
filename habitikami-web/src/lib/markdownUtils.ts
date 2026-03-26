export function markdownToHtml(md: string): string {
    let html = md;

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#666;margin:8px 0;">$1</blockquote>');

    // List items
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr/>');

    // Tables
    const lines = html.split('\n');
    const result: string[] = [];
    let inTable = false;
    let headerDone = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|') && line.endsWith('|')) {
            const cells = line.split('|').filter(c => c.trim() !== '');
            const nextLine = lines[i + 1]?.trim() || '';
            const isSeparator = /^\|[\s-|]+\|$/.test(nextLine);

            if (!inTable) {
                result.push('<table style="border-collapse:collapse;width:100%;margin:12px 0;">');
                inTable = true;
                headerDone = false;
            }

            if (/^[\s-|]+$/.test(line.replace(/\|/g, '').trim())) {
                continue;
            }

            const tag = !headerDone && isSeparator ? 'th' : 'td';
            if (!headerDone && isSeparator) headerDone = true;

            const row = cells.map(c =>
                `<${tag} style="border:1px solid #ddd;padding:8px;text-align:left;">${c.trim()}</${tag}>`
            ).join('');
            result.push(`<tr>${row}</tr>`);
        } else {
            if (inTable) {
                result.push('</table>');
                inTable = false;
                headerDone = false;
            }
            result.push(line);
        }
    }
    if (inTable) result.push('</table>');

    html = result.join('\n');

    // Paragraphs - wrap loose text
    html = html.replace(/\n\n/g, '</p><p>');
    html = `<p>${html}</p>`;
    // Clean empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>(<h[1-3]>)/g, '$1');
    html = html.replace(/(<\/h[1-3]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<table)/g, '$1');
    html = html.replace(/(<\/table>)<\/p>/g, '$1');
    html = html.replace(/<p>(<hr\/>)/g, '$1');
    html = html.replace(/(<hr\/>)<\/p>/g, '$1');
    html = html.replace(/<p>(<blockquote)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; color: #333; line-height: 1.6; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px; }
        h2 { color: #2980b9; }
        h3 { color: #7f8c8d; }
        table { border-collapse: collapse; width: 100%; }
        th { background-color: #f8f9fa; font-weight: bold; }
        li { margin: 4px 0; }
    </style></head><body>${html}</body></html>`;
}
