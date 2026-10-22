import React from 'react';
import { translate } from '../../i18n';

interface State { error: Error | null }

/**
 * Keeps a crashing view from unmounting the whole app (a black screen):
 * shows the error text and a reload button instead.
 */
export class ViewErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[Habitikami] view crashed:', error, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;
        const chunk = /dynamically imported module|Loading chunk|import\(\)/i.test(this.state.error.message);
        return (
            <div className="flex flex-col items-center justify-center text-center gap-4 p-8 h-full">
                <h2 className="text-lg font-semibold">{translate('viewCrashTitle')}</h2>
                <p className="text-sm text-muted-foreground max-w-md">{chunk ? translate('viewCrashChunk') : translate('viewCrashHint')}</p>
                <pre className="text-[11px] text-left bg-secondary/40 border border-border rounded-lg p-3 max-w-full overflow-auto whitespace-pre-wrap">{this.state.error.message}</pre>
                <button type="button" onClick={() => window.location.reload()} className="px-5 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-medium">
                    {translate('viewCrashReload')}
                </button>
            </div>
        );
    }
}
