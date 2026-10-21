package dev.kambei.habitikami.widget

import java.time.LocalDate

/**
 * Streak rules shared with the web app (habitikami-web/src/utils/streaks.ts);
 * keep both in sync.
 *
 * Entries are (ISO date, done) pairs sorted by date, already stripped of
 * SKIP days (neutral): see [HabitStatsWidgetProvider.smartMerge].
 * - TRUE and HALF count as done.
 * - A day that is not done breaks the streak, except today and later: that
 *   day is still pending.
 * - Dates without a row are neutral (weekday-only habits have no weekend rows).
 */
object Streaks {

    fun bestStreak(entries: List<Pair<String, Boolean>>): Int {
        var best = 0
        var run = 0
        for ((_, done) in entries) {
            if (done) {
                run++
                if (run > best) best = run
            } else {
                run = 0
            }
        }
        return best
    }

    fun currentStreak(
        entries: List<Pair<String, Boolean>>,
        today: String = LocalDate.now().toString(),
    ): Int {
        var streak = 0
        for (i in entries.indices.reversed()) {
            val (date, done) = entries[i]
            if (done) {
                streak++
                continue
            }
            // Not done: pending if the day is not over yet (ISO dates compare lexically)
            if (date >= today) continue
            break
        }
        return streak
    }
}
