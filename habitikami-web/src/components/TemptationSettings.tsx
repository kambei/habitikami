import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Edit2, Check, Flame, Info } from 'lucide-react';
import * as Icons from 'lucide-react';
import { habitService } from '../services/HabitService';
import { useTranslation } from '../i18n';

export const TemptationSettings = () => {
    const { t } = useTranslation();
    const [temptations, setTemptations] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        habitService.getTemptations().then(setTemptations);
    }, []);

    const handleSave = async (updated: any[]) => {
        setLoading(true);
        try {
            await habitService.saveTemptations(updated);
            setTemptations(updated);
            setEditingId(null);
        } catch (error) {
            console.error("Failed to save temptations", error);
        } finally {
            setLoading(false);
        }
    };

    const addTemptation = () => {
        const newT = {
            id: `custom_${Date.now()}`,
            label: "New Temptation",
            icon: "Activity",
            actions: [
                { id: `resisted_${Date.now()}`, label: "Resisted", color: "#10b981", type: "resist" },
                { id: `succumbed_${Date.now()}`, label: "Succumbed", color: "#ef4444", type: "succumb" }
            ]
        };
        handleSave([...temptations, newT]);
    };

    const deleteTemptation = async (id: string) => {
        const temptation = temptations.find(t => t.id === id);
        if (!temptation) return;
        if (confirm("Are you sure you want to delete this temptation type? This will also remove its columns from the Counters sheet.")) {
            const columnNames = temptation.actions.map((a: any) => a.id);
            try {
                await habitService.deleteCounterColumnsByName(columnNames);
            } catch (e) {
                console.error("Failed to clean sheet columns", e);
            }
            handleSave(temptations.filter(t => t.id !== id));
        }
    };

    const updateTemptation = (id: string, field: string, value: any) => {
        const updated = temptations.map(t => t.id === id ? { ...t, [field]: value } : t);
        setTemptations(updated);
    };

    const updateAction = (tId: string, aId: string, field: string, value: any) => {
        const updated = temptations.map(t => {
            if (t.id === tId) {
                const updatedActions = t.actions.map((a: any) => {
                    if (a.id === aId) {
                        // v5.0.4: Sync color to Google Sheet column header in real-time
                        if (field === 'color') {
                            habitService.setHabitColor("Counters", a.id, value).catch(console.error);
                        }
                        return { ...a, [field]: value };
                    }
                    return a;
                });
                return { ...t, actions: updatedActions };
            }
            return t;
        });
        setTemptations(updated);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Flame className="w-5 h-5 text-primary" />
                    {t('tabSmokeTemptation')}
                </h3>
                <button
                    onClick={addTemptation}
                    disabled={loading}
                    className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="grid gap-4">
                {temptations.map((temp) => (
                    <div key={temp.id} className="p-4 bg-card border border-border rounded-xl shadow-sm space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                                {Icons[temp.icon as keyof typeof Icons] ? (
                                    (() => {
                                        const Icon = Icons[temp.icon as keyof typeof Icons] as React.ElementType;
                                        return <Icon className="w-6 h-6 text-primary" />;
                                    })()
                                ) : <Flame className="w-6 h-6 text-primary" />}
                            </div>
                            <div className="flex-1">
                                {editingId === temp.id ? (
                                    <input 
                                        type="text" 
                                        value={temp.label} 
                                        onChange={(e) => updateTemptation(temp.id, 'label', e.target.value)}
                                        className="bg-background border border-border rounded px-2 py-1 w-full"
                                    />
                                ) : (
                                    <h4 className="font-bold">{temp.label}</h4>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => editingId === temp.id ? handleSave(temptations) : setEditingId(temp.id)}
                                    className="p-2 hover:bg-secondary rounded-lg transition-colors"
                                >
                                    {editingId === temp.id ? <Check className="w-4 h-4 text-green-500" /> : <Edit2 className="w-4 h-4" />}
                                </button>
                                <button 
                                    onClick={() => deleteTemptation(temp.id)}
                                    className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {editingId === temp.id && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }} 
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-4 pt-4 border-t border-border"
                            >
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-muted-foreground block mb-1">Icon Name (Lucide)</label>
                                        <input 
                                            type="text" 
                                            value={temp.icon} 
                                            onChange={(e) => updateTemptation(temp.id, 'icon', e.target.value)}
                                            className="bg-background border border-border rounded px-2 py-1 w-full text-sm"
                                            placeholder="Flame, Coffee, Heart..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs text-muted-foreground block">Actions (Spreadsheet Columns)</label>
                                    {temp.actions.map((action: any) => (
                                        <div key={action.id} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
                                            <input 
                                                type="text" 
                                                value={action.label} 
                                                onChange={(e) => updateAction(temp.id, action.id, 'label', e.target.value)}
                                                className="bg-background border border-border rounded px-2 py-1 flex-1 text-sm"
                                            />
                                            <input 
                                                type="color" 
                                                value={action.color} 
                                                onChange={(e) => updateAction(temp.id, action.id, 'color', e.target.value)}
                                                className="w-8 h-8 rounded border-none cursor-pointer"
                                            />
                                            <span className="text-[10px] font-mono text-muted-foreground">ID: {action.id}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </div>
                ))}
            </div>
            
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex gap-3">
                <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-300 leading-relaxed">
                    Changes here will affect how buttons are displayed and how charts are colored. 
                    The <strong>Action ID</strong> corresponds to the column header in your "Counters" Google Sheet. 
                    If you change an ID, existing data for that column will no longer be linked to this button.
                </p>
            </div>
        </div>
    );
};
