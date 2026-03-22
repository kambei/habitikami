import { Home, BarChart2, CheckSquare, Flame, Coffee, StickyNote, Hash, Heart } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ViewType } from '../types';
import { useTranslation } from '../i18n';

const ALL_NAV_ITEMS = [
    { id: 'Weekdays' as ViewType, labelKey: 'tabWeekdays', icon: Home },
    { id: 'Weekend' as ViewType, labelKey: 'tabWeekend', icon: Coffee },
    { id: 'Focus' as ViewType, labelKey: 'tabFocus', icon: CheckSquare },
    { id: 'Graphs' as ViewType, labelKey: 'tabStats', icon: BarChart2 },
    { id: 'MobNotes' as ViewType, labelKey: 'tabNotes', icon: StickyNote },
    { id: 'SmokeTemptation' as ViewType, labelKey: 'tabSmoke', icon: Flame },
    { id: 'Counters' as ViewType, labelKey: 'tabCounters', icon: Hash },
    { id: 'Help' as ViewType, labelKey: 'tabHelp', icon: Heart },
];

interface BottomNavProps {
    activeTab: ViewType;
    onTabChange: (tab: ViewType) => void;
    enabledTabs?: ViewType[];
}

export function BottomNav({ activeTab, onTabChange, enabledTabs }: BottomNavProps) {
    const { t } = useTranslation();

    const navItems = enabledTabs
        ? enabledTabs
            .map(tabId => ALL_NAV_ITEMS.find(item => item.id === tabId))
            .filter((item): item is typeof ALL_NAV_ITEMS[0] => item !== undefined)
        : ALL_NAV_ITEMS;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-2 pb-safe md:hidden z-50 flex items-center overflow-x-auto gap-2 no-scrollbar">
            {navItems.map((item) => (
                <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[64px] flex-shrink-0",
                        activeTab === item.id
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                >
                    <item.icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium whitespace-nowrap">{t(item.labelKey as any)}</span>
                </button>
            ))}
        </div>
    );
}
