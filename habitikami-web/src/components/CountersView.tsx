import { useState, useEffect } from 'react';
import { habitService } from '../services/HabitService';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { CounterGraph } from './graphs/CounterGraph';
import { useTranslation } from '../i18n';

export const CountersView = () => {
    const { t } = useTranslation();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [temptations, setTemptations] = useState<any[]>([]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [counters, tConfig] = await Promise.all([
                habitService.getCounters(),
                habitService.getTemptations()
            ]);
            
            if (Array.isArray(counters)) {
                setData(counters);
            } else if (counters && 'error' in counters) {
                setError(counters.error);
            }
            
            setTemptations(tConfig);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="flex flex-col h-full bg-background p-4 md:p-8 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">{t('countersTitle')}</h2>
                <button
                    onClick={fetchData}
                    className="p-2 rounded-full hover:bg-secondary transition-colors"
                >
                    <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
                </button>
            </div>

            {error && (
                <div className="p-4 mb-4 text-red-500 bg-red-100 dark:bg-red-900/20 rounded-lg">
                    {error}
                </div>
            )}

            {!loading && !error && data.length > 0 && (
                <CounterGraph data={data} />
            )}

            <div className="flex-1 overflow-auto rounded-xl border border-border shadow-sm bg-card/50">
                <table className="w-full text-left">
                    <thead className="bg-secondary/50 sticky top-0 backdrop-blur-sm z-10">
                        <tr>
                            <th className="p-4 font-semibold text-muted-foreground">{t('countersDate')}</th>
                            {Object.keys(data[0] || {}).filter(k => k !== 'date').map(key => {
                                // Find label
                                let label = key;
                                for (const tConfig of temptations) {
                                    const action = tConfig.actions.find((a: any) => a.id === key);
                                    if (action) {
                                        label = action.id === 'smoke' ? t('countersResisted') : 
                                                action.id === 'smoked' ? t('countersSmoked') : 
                                                action.id === 'coffee' ? t('countersCoffee') : 
                                                action.label;
                                        break;
                                    }
                                }
                                return <th key={key} className="p-4 font-semibold text-muted-foreground">{label}</th>;
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading && data.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="p-8 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="animate-spin w-6 h-6" />
                                        <span>{t('countersLoadingData')}</span>
                                    </div>
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="p-8 text-center text-muted-foreground">
                                    {t('countersNoRecords')}
                                </td>
                            </tr>
                        ) : (
                            data.map((row, i) => (
                                <tr key={row.date + i} className="hover:bg-muted/50 transition-colors">
                                    <td className="p-4 font-medium">{row.date}</td>
                                    {Object.keys(data[0] || {}).filter(k => k !== 'date').map(key => {
                                        // Find color
                                        let color = "currentColor";
                                        for (const tConfig of temptations) {
                                            const action = tConfig.actions.find((a: any) => a.id === key);
                                            if (action) {
                                                color = action.color;
                                                break;
                                            }
                                        }
                                        return (
                                            <td key={key} className="p-4 font-bold font-mono text-lg" style={{ color }}>
                                                +{row[key] || 0}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
