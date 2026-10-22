import { useMemo } from 'react';
import { ArrowLeft, Lock } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useAchievements } from '../hooks/useAchievements';
import { ACHIEVEMENT_CATEGORIES, type AchievementCategory } from '../data/achievements';
import { ShareButton } from './ui/ShareButton';
import { Skeleton } from './ui/Skeleton';
import type { TranslationKey } from '../i18n';

const CATEGORY_KEYS: Record<AchievementCategory, TranslationKey> = {
    streak: 'trophiesCatStreak', consistency: 'trophiesCatConsistency', volume: 'trophiesCatVolume', temptations: 'trophiesCatTemptations', journal: 'trophiesCatJournal',
};

/** Unlocked and locked achievements with progress (issue #3). */
export function TrophiesView({ onBack }: { onBack: () => void }) {
    const { t, language, locale } = useTranslation();
    const { achievements, isLoaded } = useAchievements();
    const lang = language === 'it' ? 'it' : 'en';
    const unlockedCount = achievements.filter(a => a.unlocked).length;
    const groups = useMemo(() => ACHIEVEMENT_CATEGORIES.map(cat => ({ cat, items: achievements.filter(a => a.category === cat) })), [achievements]);

    return (
        <div className="p-3 md:p-6 h-full overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
                <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-foreground/5" aria-label={t('prev')}>
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex-1">
                    <h2 className="text-lg md:text-xl font-bold">🏆 {t('trophiesTitle')}</h2>
                    <p className="text-xs text-muted-foreground">{t('trophiesSubtitle').replace('{n}', String(unlockedCount)).replace('{total}', String(achievements.length))}</p>
                </div>
            </div>
            {!isLoaded ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
            ) : groups.map(({ cat, items }) => (
                <section key={cat} className="mb-6">
                    <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">{t(CATEGORY_KEYS[cat])}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {items.map(a => (
                            <div key={a.id} className={`rounded-xl border p-3 flex items-center gap-3 ${a.unlocked ? 'border-violet-400/40 bg-violet-500/10' : 'border-border bg-card/60'}`}>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0 ${a.unlocked ? 'bg-violet-500/20' : 'bg-secondary grayscale opacity-60'}`}>
                                    {a.unlocked ? a.icon : <Lock className="w-5 h-5 text-muted-foreground" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm truncate">{a.title[lang]}</div>
                                    <div className="text-xs text-muted-foreground">{a.description[lang]}</div>
                                    {a.unlocked ? (
                                        a.unlockedAt && <div className="text-[10px] text-violet-300 mt-1">{t('trophiesUnlockedOn').replace('{date}', new Date(a.unlockedAt).toLocaleDateString(locale))}</div>
                                    ) : (
                                        <div className="mt-1.5">
                                            <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                                                <div className="h-full rounded-full bg-violet-400" style={{ width: `${Math.max(2, a.progress * 100)}%` }} />
                                            </div>
                                            <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{Math.min(a.current, a.target)} / {a.target}</div>
                                        </div>
                                    )}
                                </div>
                                {a.unlocked && (
                                    <ShareButton
                                        fileName={`habitikami-${a.id}.png`}
                                        spec={() => ({ template: 'achievement', title: t('shareAchievementTitle'), icon: a.icon, name: a.title[lang], description: a.description[lang], footer: new Date().toLocaleDateString(locale) })}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
