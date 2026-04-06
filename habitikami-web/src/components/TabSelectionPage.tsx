import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, BarChart2, CheckSquare, Flame, Coffee, StickyNote, Hash, Dumbbell, ChevronUp, ChevronDown, Plus, X, Star } from 'lucide-react';
import { habitService } from '../services/HabitService';
import { toast } from 'sonner';
import type { ViewType } from '../types';
import { useTranslation } from '../i18n';
import type { TranslationKey } from '../i18n';

interface TabInfo {
    id: ViewType;
    labelKey: TranslationKey;
    descKey: TranslationKey;
    icon: React.ElementType;
}

const ALL_TABS: TabInfo[] = [
    { id: 'Weekdays', labelKey: 'tabWeekdays', descKey: 'tabDescWeekdays', icon: Home },
    { id: 'Weekend', labelKey: 'tabWeekend', descKey: 'tabDescWeekend', icon: Coffee },
    { id: 'Focus', labelKey: 'tabFocus', descKey: 'tabDescFocus', icon: CheckSquare },
    { id: 'Graphs', labelKey: 'tabStats', descKey: 'tabDescStats', icon: BarChart2 },
    { id: 'MobNotes', labelKey: 'tabNotes', descKey: 'tabDescNotes', icon: StickyNote },
    { id: 'SmokeTemptation', labelKey: 'tabSmoke', descKey: 'tabDescSmoke', icon: Flame },
    { id: 'Counters', labelKey: 'tabCounters', descKey: 'tabDescCounters', icon: Hash },
    { id: 'Training', labelKey: 'tabTraining', descKey: 'tabDescTraining', icon: Dumbbell },
];

const TRAINING_OWNER_EMAIL = 'and.bovi@gmail.com';

interface Props {
    onComplete: (enabledTabs: ViewType[], defaultTab?: ViewType) => void;
    /** Pre-selected tabs when editing existing preferences */
    currentTabs?: ViewType[];
    /** Current default tab when editing */
    currentDefaultTab?: ViewType | null;
    /** If provided, shows a Cancel button (used when editing, not initial setup) */
    onCancel?: () => void;
    /** Current user email — used to gate owner-only tabs */
    userEmail?: string | null;
}

export function TabSelectionPage({ onComplete, currentTabs, currentDefaultTab, onCancel, userEmail }: Props) {
    const { t } = useTranslation();

    const canSeeTraining = userEmail === TRAINING_OWNER_EMAIL;
    const availableTabs = ALL_TABS.filter(t => t.id !== 'Training' || canSeeTraining);

    // Initialize with current tabs (maintaining order), or fallback to default ALL_TABS order
    const [selected, setSelected] = useState<ViewType[]>(() => {
        const filterByAccess = (id: ViewType) => id !== 'Help' && (id !== 'Training' || canSeeTraining);
        if (currentTabs && currentTabs.length > 0) return [...currentTabs].filter(filterByAccess);
        return availableTabs.map(t => t.id).filter(id => id !== 'Help');
    });
    const [defaultTab, setDefaultTab] = useState<ViewType | null>(currentDefaultTab ?? null);
    const [saving, setSaving] = useState(false);

    const moveUp = (index: number) => {
        if (index === 0) return;
        setSelected(prev => {
            const next = [...prev];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            return next;
        });
    };

    const moveDown = (index: number) => {
        if (index === selected.length - 1) return;
        setSelected(prev => {
            const next = [...prev];
            [next[index + 1], next[index]] = [next[index], next[index + 1]];
            return next;
        });
    };

    const addTab = (id: ViewType) => {
        setSelected(prev => [...prev, id]);
    };

    const removeTab = (id: ViewType) => {
        setSelected(prev => {
            if (prev.length <= 1) return prev; // Keep at least one
            return prev.filter(tId => tId !== id);
        });
        if (defaultTab === id) setDefaultTab(null);
    };

    const handleSave = async () => {
        // Build final array in the chosen order
        const tabs = [...selected];
        // Always include Help tab in saved preferences at the end
        if (!tabs.includes('Help')) {
            tabs.push('Help');
        }
        setSaving(true);
        try {
            const result = await habitService.savePreferences(tabs, defaultTab ?? undefined);
            if ('error' in result) {
                toast.error(result.error);
                return;
            }
            onComplete(tabs, defaultTab ?? undefined);
        } catch {
            toast.error('Failed to save preferences');
        } finally {
            setSaving(false);
        }
    };

    const getButtonLabel = () => {
        if (saving) return t('tabSelectionSaving');
        if (onCancel) return t('save');
        return `${t('tabSelectionContinue')} ${selected.length} ${selected.length !== 1 ? t('tabSelectionViews') : t('tabSelectionView')}`;
    };

    const selectedTabs = selected.map(id => ALL_TABS.find(t => t.id === id)!).filter(Boolean);
    const unselectedTabs = availableTabs.filter(t => !selected.includes(t.id));

    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-lg space-y-6"
            >
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                        {onCancel ? t('tabSelectionCustomize') : t('tabSelectionChoose')}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {onCancel
                            ? t('tabSelectionCustomizeDesc')
                            : t('tabSelectionChooseDesc')}
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Selected Tabs Section */}
                    <div className="space-y-3">
                        <h2 className="text-sm font-semibold text-muted-foreground px-1 uppercase tracking-wider">{t('tabSelectionSelected')}</h2>
                        <div className="flex flex-col gap-2">
                            <AnimatePresence>
                                {selectedTabs.map((tab, index) => {
                                    const Icon = tab.icon;
                                    return (
                                        <motion.div
                                            key={`sel-${tab.id}`}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="flex items-center gap-3 p-3 rounded-xl border border-primary/40 bg-primary/10 text-foreground transition-all shadow-sm"
                                        >
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/20 text-primary">
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium text-sm">{t(tab.labelKey)}</div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setDefaultTab(defaultTab === tab.id ? null : tab.id)}
                                                    className={`p-1.5 rounded-md transition-colors ${defaultTab === tab.id ? 'text-yellow-400' : 'text-muted-foreground/40 hover:text-yellow-400/60'}`}
                                                    title={t('tabSelectionDefaultTab')}
                                                >
                                                    <Star className="w-4 h-4" fill={defaultTab === tab.id ? 'currentColor' : 'none'} />
                                                </button>
                                                <div className="flex flex-col gap-0.5 mr-1">
                                                    <button onClick={() => moveUp(index)} disabled={index === 0} className="p-1 hover:bg-primary/20 rounded disabled:opacity-30">
                                                        <ChevronUp className="w-3 h-3" />
                                                    </button>
                                                    <button onClick={() => moveDown(index)} disabled={index === selectedTabs.length - 1} className="p-1 hover:bg-primary/20 rounded disabled:opacity-30">
                                                        <ChevronDown className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <button onClick={() => removeTab(tab.id)} disabled={selectedTabs.length <= 1} className="p-2 text-rose-400 hover:bg-rose-400/20 rounded-md transition-colors disabled:opacity-30">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Available Tabs Section */}
                    {unselectedTabs.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-sm font-semibold text-muted-foreground px-1 uppercase tracking-wider">{t('tabSelectionAvailable')}</h2>
                            <div className="flex flex-col gap-2">
                                <AnimatePresence>
                                    {unselectedTabs.map((tab) => {
                                        const Icon = tab.icon;
                                        return (
                                            <motion.div
                                                key={`unsel-${tab.id}`}
                                                layout
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card text-muted-foreground transition-all"
                                            >
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-secondary/40">
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium text-sm text-foreground">{t(tab.labelKey)}</div>
                                                </div>
                                                <button onClick={() => addTab(tab.id)} className="p-2 text-primary hover:bg-primary/20 rounded-md transition-colors">
                                                    <Plus className="w-5 h-5" />
                                                </button>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-3">
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            disabled={saving}
                            className="flex-1 py-2.5 px-4 rounded-lg bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {t('cancel')}
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving || selected.length === 0}
                        className="flex-1 py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {getButtonLabel()}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
