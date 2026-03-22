import { useState, useEffect } from 'react';
import { habitService } from '../services/HabitService';
import type { CounterData } from '../types';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { SmokeVsResistedGraph } from './graphs/SmokeVsResistedGraph';
import { useTranslation } from '../i18n';

export const CountersView = () => {
    const { t } = useTranslation();
    const [data, setData] = useState<CounterData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await habitService.getCounters();
            if ('error' in result) {
                setError(result.error);
            } else {
                setData(result);
            }
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
                <SmokeVsResistedGraph data={data} />
            )}

            <div className="flex-1 overflow-auto rounded-xl border border-border shadow-sm bg-card/50">
                <table className="w-full text-left">
                    <thead className="bg-secondary/50 sticky top-0 backdrop-blur-sm z-10">
                        <tr>
                            <th className="p-4 font-semibold text-muted-foreground w-1/4">{t('countersDate')}</th>
                            <th className="p-4 font-semibold text-muted-foreground w-1/4">{t('countersResisted')}</th>
                            <th className="p-4 font-semibold text-muted-foreground w-1/4">{t('countersSmoked')}</th>
                            <th className="p-4 font-semibold text-muted-foreground w-1/4">{t('countersCoffee')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading && data.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="animate-spin w-6 h-6" />
                                        <span>{t('countersLoadingData')}</span>
                                    </div>
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                                    {t('countersNoRecords')}
                                </td>
                            </tr>
                        ) : (
                            data.map((row, i) => (
                                <tr key={row.date + i} className="hover:bg-muted/50 transition-colors">
                                    <td className="p-4 font-medium">{row.date}</td>
                                    <td className="p-4 text-green-600 font-bold font-mono text-lg">
                                        +{row.smoke}
                                    </td>
                                    <td className="p-4 text-red-600 font-bold font-mono text-lg">
                                        +{row.smoked}
                                    </td>
                                    <td className="p-4 text-amber-700 font-bold font-mono text-lg">
                                        +{row.coffee}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
