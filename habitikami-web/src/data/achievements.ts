/**
 * Achievement catalog (issue #3). Each entry is evaluated on data the app
 * already loads (see utils/achievements.ts); the unlock state lives in the
 * `Achievements` sheet so every device agrees.
 */
export type AchievementCategory = 'streak' | 'consistency' | 'volume' | 'temptations' | 'journal';

export interface AchievementContext {
    /** Best streak ever across habits. */
    bestStreak: number;
    /** Longest run of consecutive days with every habit done (TRUE/HALF/number at goal; SKIP neutral). */
    bestPerfectRun: number;
    /** Days with every habit done. */
    perfectDays: number;
    /** Done cells in the loaded window. */
    completions: number;
    /** Distinct habits with at least one real value. */
    habitsTracked: number;
    /** Sum of the "resist" counters. */
    resisted: number;
    /** Habit notes written. */
    notes: number;
    /** Distinct days with a mood assessment. */
    moodDays: number;
    /** Distinct days with at least one real value. */
    daysTracked: number;
}

export interface Achievement {
    id: string;
    icon: string;
    category: AchievementCategory;
    title: { en: string; it: string };
    description: { en: string; it: string };
    target: number;
    value: (ctx: AchievementContext) => number;
}

const L = (en: string, it: string) => ({ en, it });

export const ACHIEVEMENTS: Achievement[] = [
    { id: 'first_step', icon: '🌱', category: 'volume', title: L('First step', 'Primo passo'), description: L('Complete your first habit', 'Completa la prima abitudine'), target: 1, value: c => c.completions },
    { id: 'streak_7', icon: '🔥', category: 'streak', title: L('On fire', 'In fiamme'), description: L('A 7-day streak on one habit', 'Una streak di 7 giorni su un\'abitudine'), target: 7, value: c => c.bestStreak },
    { id: 'streak_30', icon: '🌋', category: 'streak', title: L('Unstoppable', 'Inarrestabile'), description: L('A 30-day streak on one habit', 'Una streak di 30 giorni su un\'abitudine'), target: 30, value: c => c.bestStreak },
    { id: 'streak_100', icon: '🏆', category: 'streak', title: L('Centurion', 'Centurione'), description: L('A 100-day streak on one habit', 'Una streak di 100 giorni su un\'abitudine'), target: 100, value: c => c.bestStreak },
    { id: 'perfect_day', icon: '⭐', category: 'consistency', title: L('Perfect day', 'Giornata perfetta'), description: L('Every habit done in one day', 'Tutte le abitudini fatte in un giorno'), target: 1, value: c => c.perfectDays },
    { id: 'perfect_week', icon: '🌟', category: 'consistency', title: L('Perfect week', 'Settimana perfetta'), description: L('Seven perfect days in a row', 'Sette giornate perfette di fila'), target: 7, value: c => c.bestPerfectRun },
    { id: 'perfect_month', icon: '💎', category: 'consistency', title: L('Flawless month', 'Mese impeccabile'), description: L('Thirty perfect days in a row', 'Trenta giornate perfette di fila'), target: 30, value: c => c.bestPerfectRun },
    { id: 'days_30', icon: '📅', category: 'consistency', title: L('Habit of tracking', 'L\'abitudine di tracciare'), description: L('Thirty days with at least one value', 'Trenta giorni con almeno un valore'), target: 30, value: c => c.daysTracked },
    { id: 'habits_5', icon: '🧩', category: 'volume', title: L('Collector', 'Collezionista'), description: L('Five habits tracked', 'Cinque abitudini tracciate'), target: 5, value: c => c.habitsTracked },
    { id: 'completions_100', icon: '💯', category: 'volume', title: L('Hundred', 'Cento'), description: L('100 habits completed', '100 abitudini completate'), target: 100, value: c => c.completions },
    { id: 'completions_500', icon: '🚀', category: 'volume', title: L('Five hundred', 'Cinquecento'), description: L('500 habits completed', '500 abitudini completate'), target: 500, value: c => c.completions },
    { id: 'completions_1000', icon: '🪐', category: 'volume', title: L('Thousand', 'Mille'), description: L('1000 habits completed', '1000 abitudini completate'), target: 1000, value: c => c.completions },
    { id: 'resist_50', icon: '🛡️', category: 'temptations', title: L('Iron will', 'Volontà di ferro'), description: L('50 temptations resisted', '50 tentazioni resistite'), target: 50, value: c => c.resisted },
    { id: 'resist_200', icon: '🏰', category: 'temptations', title: L('Fortress', 'Fortezza'), description: L('200 temptations resisted', '200 tentazioni resistite'), target: 200, value: c => c.resisted },
    { id: 'notes_10', icon: '📝', category: 'journal', title: L('Chronicler', 'Cronista'), description: L('Ten habit notes written', 'Dieci note sulle abitudini'), target: 10, value: c => c.notes },
    { id: 'mood_30', icon: '🧠', category: 'journal', title: L('Know thyself', 'Conosci te stesso'), description: L('Mood assessed on 30 days', 'Umore valutato in 30 giorni'), target: 30, value: c => c.moodDays },
];

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = ['streak', 'consistency', 'volume', 'temptations', 'journal'];
