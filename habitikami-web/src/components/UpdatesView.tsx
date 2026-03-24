import { useEffect, useState } from 'react';
import { Megaphone, ChevronRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { habitService } from '../services/HabitService';
import { renderMarkdown } from '../lib/renderMarkdown';

interface UpdatesViewProps {
    onBack: () => void;
}

export function UpdatesView({ onBack }: UpdatesViewProps) {
    const [changelog, setChangelog] = useState<{ content: string; hash: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showReload, setShowReload] = useState(false);

    useEffect(() => {
        const fetchChangelog = async () => {
            try {
                const data = await habitService.getChangelog();
                setChangelog(data);
                
                const lastSeen = localStorage.getItem('lastSeenChangelogHash');
                if (lastSeen && data.hash && lastSeen !== data.hash) {
                    setShowReload(true);
                }

                // Mark as seen
                if (data.hash) {
                    localStorage.setItem('lastSeenChangelogHash', data.hash);
                    window.dispatchEvent(new Event('changelogSeen'));
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load updates');
            } finally {
                setIsLoading(false);
            }
        };
        fetchChangelog();
    }, []);

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-card to-background">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur shrink-0">
                <div className="flex items-center gap-2 text-primary">
                    <button
                        onClick={onBack}
                        className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-foreground/5 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                    </button>
                    <Megaphone className="w-5 h-5 text-amber-400" />
                    <span className="font-semibold text-foreground">What's New</span>
                </div>
                {showReload && (
                    <button
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 px-3 py-1.5 bg-primary/20 text-primary hover:bg-primary/30 rounded-full text-xs font-bold transition-all animate-pulse"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Reload to Update
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                <div className="max-w-2xl mx-auto space-y-8">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm">Fetching latest updates...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-400 text-center">
                            <AlertCircle className="w-8 h-8" />
                            <p className="text-sm">{error}</p>
                        </div>
                    ) : (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <div className="changelog-container space-y-2 text-muted-foreground">
                                {renderMarkdown(changelog?.content || '')}
                            </div>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
