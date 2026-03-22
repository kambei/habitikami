import type { HabitData } from "../types";
import { parseDate } from "./dateParsing";
import { ITALIAN_DAYS } from "./dayTranslation";

export interface HabitStats {
    name: string;
    total: number;
    completed: number;
    percentage: number;
}

export interface DayPerformance {
    day: string; // e.g., "Monday"
    totalHabits: number;
    completedHabits: number;
    rate: number;
}

export interface DailyTrend {
    date: string; // "YYYY-MM-DD" or formatted
    rate: number;
    total: number;
    completed: number;
}

export function calculateCompletionRates(data: HabitData[], headers: string[]): HabitStats[] {
    const stats: Record<string, { total: number; completed: number }> = {};

    // Initialize
    headers.forEach(h => {
        stats[h] = { total: 0, completed: 0 };
    });

    data.forEach(row => {
        headers.forEach(h => {
            if (stats[h] && Object.prototype.hasOwnProperty.call(row.habits, h)) {
                stats[h].total += 1;
                if (row.habits[h]) {
                    stats[h].completed += 1;
                }
            }
        });
    });

    return headers.map(h => {
        const s = stats[h];
        return {
            name: h,
            total: s.total,
            completed: s.completed,
            percentage: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0
        };
    });
}

// Helper to parser removed in favor of shared util

export function calculateDailyTrends(data: HabitData[], limit = 30): DailyTrend[] {
    const trends: DailyTrend[] = [];

    // Sort data chronologically first
    const sortedData = [...data].sort((a, b) => {
        const da = parseDate(a.date)?.getTime() ?? 0;
        const db = parseDate(b.date)?.getTime() ?? 0;
        return da - db;
    });

    const recentData = sortedData.slice(-limit);

    recentData.forEach(row => {
        let total = 0;
        let completed = 0;

        Object.keys(row.habits).forEach(h => {
            total++;
            if (row.habits[h]) completed++;
        });

        trends.push({
            date: row.date.substring(0, 5), // "DD/MM"
            total,
            completed,
            rate: total > 0 ? Math.round((completed / total) * 100) : 0
        });
    });

    return trends;
}


export function calculateDayOfWeekStats(data: HabitData[], displayDayNames?: string[]): DayPerformance[] {
    // Always use Italian days for matching (sheet data is Italian)
    const matchDays = ITALIAN_DAYS;
    // Use display names for output labels
    const displayDays = displayDayNames || ITALIAN_DAYS;

    // Normalize day names from data (handle potential casing or English mismatches if any)
    // Assuming data uses Italian names as seen in HabitTable logic: "Lunedì", "Martedì"...

    const stats: Record<string, { total: number; completed: number }> = {};
    matchDays.forEach(d => stats[d] = { total: 0, completed: 0 });

    data.forEach(row => {
        // Map row.day to our canonical keys
        // Simple fuzzy match or direct lookup
        const dayKey = matchDays.find(d => d.toLowerCase() === row.day.toLowerCase()) || row.day;

        if (!stats[dayKey]) stats[dayKey] = { total: 0, completed: 0 };

        Object.values(row.habits).forEach(val => {
            stats[dayKey].total++;
            if (val) stats[dayKey].completed++;
        });
    });

    const result = matchDays.map((d, idx) => {
        const s = stats[d];
        const label = displayDays[idx] || d;
        return {
            day: label.substring(0, 3),
            fullDay: label,
            totalHabits: s.total,
            completedHabits: s.completed,
            rate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0
        };
    }).filter(d => d.totalHabits > 0); // Remove days with no data? Or keep them?

    // Radar charts need all axes usually.
    return result;
}

export function prepareHeatmapData(data: HabitData[], habit: string): { date: string, count: number }[] {
    // For GitHub calendar like view.
    // "count" usually maps to intensity. 
    // Here: 1 = Done, 0 = Not Done.

    // We need "YYYY-MM-DD" for many heatmap libs, but let's stick to our "DD/MM/YYYY" or standardized Date if using a lib.
    // Let's return generic value list.

    return data.map(row => {
        const val = row.habits[habit];
        const d = parseDate(row.date);
        if (!d) return null;

        // Format YYYY-MM-DD for consistency
        const dateStr = d.toISOString().split('T')[0];

        return {
            date: dateStr,
            count: val ? 1 : 0
        };
    }).filter(x => x !== null) as { date: string, count: number }[];
}
