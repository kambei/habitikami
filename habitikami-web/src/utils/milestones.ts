/** Streak lengths worth a celebration, in ascending order. */
export const STREAK_MILESTONES = [7, 30, 100] as const;

const SEEN_KEY = 'habitikami_milestones_seen';

function readSeen(): Set<string> {
    try {
        const raw = localStorage.getItem(SEEN_KEY);
        return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
        return new Set();
    }
}

/** The highest milestone reached by `streak`, or null. */
export function milestoneFor(streak: number): number | null {
    let reached: number | null = null;
    for (const m of STREAK_MILESTONES) if (streak >= m) reached = m;
    return reached;
}

/**
 * Milestones reached by the given streaks that have not been celebrated yet
 * on this device. Marks them as seen, so each (habit, milestone) pair fires
 * once. Lower milestones already passed are marked too, without celebrating.
 */
export function takeNewMilestones(streaks: Record<string, { currentStreak: number }>): { habit: string; milestone: number }[] {
    const seen = readSeen();
    const fresh: { habit: string; milestone: number }[] = [];
    for (const [habit, { currentStreak }] of Object.entries(streaks)) {
        const top = milestoneFor(currentStreak);
        if (top === null) continue;
        for (const m of STREAK_MILESTONES) {
            if (m > top) break;
            const key = `${habit}:${m}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (m === top) fresh.push({ habit, milestone: m });
        }
    }
    try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    } catch { /* storage unavailable: celebrate again next time, harmless */ }
    return fresh;
}

/** Visual tone of a streak badge. */
export function streakTone(streak: number): 'none' | 'warm' | 'hot' | 'legend' {
    if (streak >= 100) return 'legend';
    if (streak >= 30) return 'hot';
    if (streak >= 7) return 'warm';
    return 'none';
}
