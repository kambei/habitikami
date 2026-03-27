import React from 'react';

export function renderMarkdown(text: string): React.ReactNode {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];
    let isNumberedList = false;

    const flushList = () => {
        if (listItems.length > 0) {
            const listKey = `list-${elements.length}`;
            if (isNumberedList) {
                elements.push(
                    <ol key={listKey} className="list-decimal list-inside space-y-1 ml-4 my-2">
                        {listItems.map((item, i) => <li key={i} className="text-foreground/90">{inlineFormat(item)}</li>)}
                    </ol>
                );
            } else {
                elements.push(
                    <ul key={listKey} className="list-disc list-inside space-y-1 ml-4 my-2">
                        {listItems.map((item, i) => <li key={i} className="text-foreground/90">{inlineFormat(item)}</li>)}
                    </ul>
                );
            }
            listItems = [];
            isNumberedList = false;
        }
    };

    const inlineFormat = (s: string): React.ReactNode => {
        const parts: React.ReactNode[] = [];
        const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
        let last = 0;
        let match;
        while ((match = regex.exec(s)) !== null) {
            if (match.index > last) parts.push(s.slice(last, match.index));
            if (match[2]) parts.push(<strong key={match.index} className="font-bold text-foreground">{match[2]}</strong>);
            else if (match[3]) parts.push(<em key={match.index} className="italic text-foreground/80">{match[3]}</em>);
            else if (match[4]) parts.push(<code key={match.index} className="bg-foreground/10 px-1 py-0.5 rounded text-xs font-mono">{match[4]}</code>);
            else if (match[5] && match[6]) parts.push(<a key={match.index} href={match[6]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{match[5]}</a>);
            last = match.index + match[0].length;
        }
        if (last < s.length) parts.push(s.slice(last));
        return parts.length === 1 ? parts[0] : <>{parts}</>;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        if (trimmed === '---') {
            flushList();
            elements.push(<hr key={`hr-${elements.length}`} className="my-6 border-t border-border/50" />);
            continue;
        }

        if (trimmed.startsWith('# ')) {
            flushList();
            elements.push(<h1 key={`h1-${elements.length}`} className="text-2xl font-bold mt-8 mb-4 text-primary leading-tight">{inlineFormat(trimmed.slice(2))}</h1>);
        } else if (trimmed.startsWith('## ')) {
            flushList();
            elements.push(<h2 key={`h2-${elements.length}`} className="text-xl font-semibold mt-6 mb-3 text-primary border-b border-border/30 pb-2 leading-tight">{inlineFormat(trimmed.slice(3))}</h2>);
        } else if (trimmed.startsWith('### ')) {
            flushList();
            elements.push(<h3 key={`h3-${elements.length}`} className="text-lg font-bold mt-5 mb-2 text-foreground/90 leading-tight">{inlineFormat(trimmed.slice(4))}</h3>);
        } 
        else if (trimmed.startsWith('> ')) {
            flushList();
            elements.push(
                <blockquote key={`bq-${elements.length}`} className="border-l-4 border-primary/30 pl-4 py-1 my-4 italic text-muted-foreground bg-primary/5 rounded-r-lg">
                    {inlineFormat(trimmed.slice(2))}
                </blockquote>
            );
        }
        else if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
            if (isNumberedList) flushList();
            isNumberedList = false;
            listItems.push(trimmed.slice(2));
        } else if (/^\d+\.\s/.test(trimmed)) {
            if (!isNumberedList && listItems.length > 0) flushList();
            isNumberedList = true;
            listItems.push(trimmed.replace(/^\d+\.\s/, ''));
        } 
        else if (trimmed.startsWith('|')) {
            flushList();
            const cells = trimmed.split('|').filter(c => c.trim() !== '' || line.includes('||'));
            const isHeaderSeparator = i + 1 < lines.length && /^\|[\s-|]+\|$/.test(lines[i + 1].trim());
            
            if (isHeaderSeparator) {
                const headerCells = cells;
                i++; // Skip separator
                
                const rows: React.ReactNode[] = [];
                let j = i + 1;
                while (j < lines.length && lines[j].trim().startsWith('|')) {
                    const rowCells = lines[j].trim().split('|').filter(c => c.trim() !== '' || lines[j].includes('||'));
                    rows.push(
                        <tr key={`tr-${j}`} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                            {rowCells.map((c, idx) => <td key={idx} className="px-4 py-2 border-r border-border/30 last:border-0">{inlineFormat(c.trim())}</td>)}
                        </tr>
                    );
                    j++;
                }

                elements.push(
                    <div key={`table-wrapper-${elements.length}`} className="my-4 overflow-x-auto rounded-lg border border-border/50">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-muted/50 border-b border-border/50">
                                    {headerCells.map((c, idx) => <th key={idx} className="px-4 py-2 text-left font-bold border-r border-border/50 last:border-0">{inlineFormat(c.trim())}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {rows}
                            </tbody>
                        </table>
                    </div>
                );
                i = j - 1;
            } else {
                elements.push(<p key={`p-table-${elements.length}`} className="my-2">{inlineFormat(trimmed)}</p>);
            }
        }
        else {
            flushList();
            if (trimmed === '') {
                elements.push(<div key={`space-${elements.length}`} className="h-2" />);
            } else {
                elements.push(<p key={`p-${elements.length}`} className="my-2 text-foreground/90 leading-relaxed">{inlineFormat(trimmed)}</p>);
            }
        }
    }
    flushList();
    return <div className="markdown-content">{elements}</div>;
}
