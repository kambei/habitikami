import React from 'react';

export function renderMarkdown(text: string): React.ReactNode {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];

    const flushList = () => {
        if (listItems.length > 0) {
            elements.push(
                <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1">
                    {listItems.map((item, i) => <li key={i}>{inlineFormat(item)}</li>)}
                </ul>
            );
            listItems = [];
        }
    };

    const inlineFormat = (s: string): React.ReactNode => {
        const parts: React.ReactNode[] = [];
        const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
        let last = 0;
        let match;
        while ((match = regex.exec(s)) !== null) {
            if (match.index > last) parts.push(s.slice(last, match.index));
            if (match[2]) parts.push(<strong key={match.index}>{match[2]}</strong>);
            else if (match[3]) parts.push(<em key={match.index}>{match[3]}</em>);
            else if (match[4]) parts.push(<code key={match.index} className="bg-background/50 px-1 py-0.5 rounded text-xs">{match[4]}</code>);
            last = match.index + match[0].length;
        }
        if (last < s.length) parts.push(s.slice(last));
        return parts.length === 1 ? parts[0] : <>{parts}</>;
    };

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            listItems.push(trimmed.slice(2));
        } else {
            flushList();
            if (trimmed === '') {
                elements.push(<br key={`br-${elements.length}`} />);
            } else {
                elements.push(<p key={`p-${elements.length}`}>{inlineFormat(trimmed)}</p>);
            }
        }
    }
    flushList();
    return <div className="space-y-2">{elements}</div>;
}
