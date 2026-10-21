import type { DailyTrend } from './analytics';
import { STREAK_MILESTONES } from './milestones';

/**
 * Projections (issue #7): a straight line fitted on the recent completion
 * rates, extended a few days ahead, and the next streak milestone of a habit.
 */

export interface Regression {
    slope: number;
    intercept: number;
}

/** Least-squares line through (i, ys[i]). Flat line on fewer than 2 points. */
export function linearRegression(ys: number[]): Regression {
    const n = ys.length;
    if (n === 0) return { slope: 0, intercept: 0 };
    if (n === 1) return { slope: 0, intercept: ys[0] };
    const meanX = (n - 1) / 2;
    const meanY = ys.reduce((s, y) => s + y, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
        num += (i - meanX) * (ys[i] - meanY);
        den += (i - meanX) * (i - meanX);
    }
    const slope = den === 0 ? 0 : num / den;
    return { slope, intercept: meanY - slope * meanX };
}

export interface TrendPoint extends DailyTrend {
    /** Fitted/projected rate, present on every point so the dashed line is continuous. */
    projected?: number;
}

/**
 * The trends plus `daysAhead` future points carrying only the projected
 * rate; the last real point also carries `projected` so the lines join.
 * Future dates are labelled DD/MM like the real ones.
 */
export function projectTrends(trends: DailyTrend[], daysAhead = 7, lastDate: Date = new Date()): { points: TrendPoint[]; regression: Regression } {
    const regression = linearRegression(trends.map(t => t.rate));
    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
    const n = trends.length;
    const points: TrendPoint[] = trends.map((t, i) => (i === n - 1 ? { ...t, projected: clamp(regression.intercept + regression.slope * i) } : { ...t }));
    if (n < 2) return { points, regression };
    for (let k = 1; k <= daysAhead; k++) {
        const d = new Date(lastDate);
        d.setDate(d.getDate() + k);
        const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        points.push({ date: label, rate: undefined as unknown as number, total: 0, completed: 0, projected: clamp(regression.intercept + regression.slope * (n - 1 + k)) });
    }
    return { points, regression };
}

export interface MilestoneForecast {
    habit: string;
    current: number;
    milestone: number;
    daysLeft: number;
    /** Local date the milestone is reached if the streak holds. */
    on: Date;
}

/** Next milestone (7/30/100) of each habit with an active streak, soonest first. */
export function nextMilestones(streaks: Record<string, { currentStreak: number }>, today: Date = new Date()): MilestoneForecast[] {
    const out: MilestoneForecast[] = [];
    for (const [habit, { currentStreak }] of Object.entries(streaks)) {
        if (currentStreak <= 0) continue;
        const milestone = STREAK_MILESTONES.find(m => m > currentStreak);
        if (!milestone) continue;
        const daysLeft = milestone - currentStreak;
        const on = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysLeft);
        out.push({ habit, current: currentStreak, milestone, daysLeft, on });
    }
    return out.sort((a, b) => a.daysLeft - b.daysLeft || b.current - a.current);
}
