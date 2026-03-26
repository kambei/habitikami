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

    // List items (and wrapping in UL)
    const lines = html.split('\n');
    const result: string[] = [];
    let inList = false;
    let inTable = false;
    let headerDone = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        // List handling
        if (line.match(/^- (.+)$/)) {
            if (!inList) {
                result.push('<ul>');
                inList = true;
            }
            result.push(`<li>${line.replace(/^- /, '')}</li>`);
            continue;
        } else if (inList) {
            result.push('</ul>');
            inList = false;
        }

        // Table handling (already implemented but kept clean here)
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
            continue;
        } else if (inTable) {
            result.push('</table>');
            inTable = false;
        }

        // Regular line handling
        if (line === '---') {
            result.push('<hr/>');
        } else if (line !== '') {
            // If it's not a tag already, wrap in P or at least handle breaks
            if (!line.startsWith('<')) {
                result.push(`<p>${line}</p>`);
            } else {
                result.push(line);
            }
        }
    }

    if (inList) result.push('</ul>');
    if (inTable) result.push('</table>');

    const bodyHtml = result.join('\n');

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; color: #333; line-height: 1.6; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px; }
        h2 { color: #2980b9; }
        h3 { color: #7f8c8d; }
        table { border-collapse: collapse; width: 100%; }
        th { background-color: #f8f9fa; font-weight: bold; }
        li { margin: 4px 0; }
        p { margin: 8px 0; }
    </style></head><body>${bodyHtml}</body></html>`;
}
