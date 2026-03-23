package dev.kambei.habitikami.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import dev.kambei.habitikami.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class HabitStatsWidgetProvider : AppWidgetProvider() {

    // ACTION_REFRESH and refreshAll are in the companion object below

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) updateWidget(context, manager, id)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) refreshAll(context)
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
        val loading = RemoteViews(context.packageName, R.layout.widget_habit_stats).apply {
            setTextViewText(R.id.tv_habit_name, "Loading…")
            setTextViewText(R.id.tv_streak, "—")
            setTextViewText(R.id.tv_streak_label, "streak")
            setTextViewText(R.id.tv_best_streak, "—")
            setTextViewText(R.id.tv_best_label, "best")
            setTextViewText(R.id.tv_rate, "—")
            setTextViewText(R.id.tv_rate_label, "30d")
            setTextViewText(R.id.tv_total, "—")
            setTextViewText(R.id.tv_total_label, "total")
        }
        setupIntents(context, loading, widgetId)
        manager.updateAppWidget(widgetId, loading)

        scope.launch {
            val views = RemoteViews(context.packageName, R.layout.widget_habit_stats)
            val config = CounterWidgetProvider.getConfig(context)
            val habitName = HabitStatsConfigActivity.getSelectedHabit(context, widgetId)

            if (config == null || habitName == null) {
                views.setTextViewText(R.id.tv_habit_name, "Not configured")
                views.setTextViewText(R.id.tv_streak, "—")
                views.setTextViewText(R.id.tv_streak_label, "streak")
                views.setTextViewText(R.id.tv_best_streak, "—")
                views.setTextViewText(R.id.tv_best_label, "best")
                views.setTextViewText(R.id.tv_rate, "—")
                views.setTextViewText(R.id.tv_rate_label, "30d")
                views.setTextViewText(R.id.tv_total, "—")
                views.setTextViewText(R.id.tv_total_label, "total")
            } else {
                try {
                    val (baseUrl, apiToken) = config
                    val export = HabitApiClient.fetchExport(baseUrl, apiToken, 365)

                    // Smart merge: only include sheets where the habit is active
                    val merged = smartMerge(export.weekdays, export.weekend, habitName)
                    val stats = calculateStats(merged)
                    val habitColor = export.colors[habitName]

                    views.setTextViewText(R.id.tv_habit_name, habitName)
                    if (habitColor != null) {
                        views.setTextColor(R.id.tv_habit_name, habitColor)
                        views.setInt(R.id.color_bar, "setBackgroundColor", habitColor)
                    }

                    views.setTextViewText(R.id.tv_streak, "${stats.currentStreak}")
                    views.setTextViewText(R.id.tv_streak_label, if (stats.currentStreak == 1) "day" else "days")
                    views.setTextViewText(R.id.tv_best_streak, "${stats.bestStreak}")
                    views.setTextViewText(R.id.tv_best_label, "best")
                    views.setTextViewText(R.id.tv_rate, "${stats.rate30d}%")
                    views.setTextViewText(R.id.tv_rate_label, "30d")
                    views.setTextViewText(R.id.tv_total, "${stats.totalDone}")
                    views.setTextViewText(R.id.tv_total_label, "total")
                } catch (_: Exception) {
                    views.setTextViewText(R.id.tv_habit_name, habitName ?: "Error")
                    views.setTextViewText(R.id.tv_streak, "!")
                    views.setTextViewText(R.id.tv_streak_label, "")
                    views.setTextViewText(R.id.tv_best_streak, "")
                    views.setTextViewText(R.id.tv_best_label, "")
                    views.setTextViewText(R.id.tv_rate, "")
                    views.setTextViewText(R.id.tv_rate_label, "")
                    views.setTextViewText(R.id.tv_total, "")
                    views.setTextViewText(R.id.tv_total_label, "")
                }
            }

            setupIntents(context, views, widgetId)
            manager.updateAppWidget(widgetId, views)
        }
    }

    companion object {
        private const val ACTION_REFRESH = "dev.kambei.habitikami.REFRESH_HABIT_STATS"

        fun refreshAll(context: Context) {
            val intent = Intent(context, HabitStatsWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                val mgr = AppWidgetManager.getInstance(context)
                val ids = mgr.getAppWidgetIds(
                    ComponentName(context, HabitStatsWidgetProvider::class.java)
                )
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }

        /**
         * Smart merge: only include data from sheets where the habit has TRUE entries.
         * This prevents a weekday-only habit from getting FALSE entries on weekends
         * (which would break the streak).
         */
        fun smartMerge(
            weekdays: List<DayEntry>,
            weekend: List<DayEntry>,
            habit: String
        ): List<Pair<String, Boolean>> {
            val weekdayHasTrue = weekdays.any { it.habits[habit] == true }
            val weekendHasTrue = weekend.any { it.habits[habit] == true }

            val sources = mutableListOf<List<DayEntry>>()
            if (weekdayHasTrue) sources.add(weekdays)
            if (weekendHasTrue) sources.add(weekend)
            // If neither has TRUE, use both (habit just started or all false)
            if (sources.isEmpty()) sources.addAll(listOf(weekdays, weekend))

            val byDate = mutableMapOf<String, Boolean>()
            for (days in sources) {
                for (day in days) {
                    val status = day.habits[habit] ?: continue
                    byDate[day.date] = byDate.getOrDefault(day.date, false) || status
                }
            }
            return byDate.entries.sortedBy { it.key }.map { it.key to it.value }
        }
    }

    data class HabitStats(
        val currentStreak: Int,
        val bestStreak: Int,
        val rate30d: Int,
        val totalDone: Int,
    )

    private fun calculateStats(entries: List<Pair<String, Boolean>>): HabitStats {
        if (entries.isEmpty()) return HabitStats(0, 0, 0, 0)

        val totalDone = entries.count { it.second }

        // Current streak: count backwards from the most recent entry.
        // Allow date gaps of up to 3 days (handles weekday-only or weekend-only habits).
        // If the most recent entry itself is false, streak is 0.
        var currentStreak = 0
        for (i in entries.indices.reversed()) {
            val (date, done) = entries[i]
            if (!done) break
            // Check for large date gap (habit stopped being tracked)
            if (i < entries.size - 1) {
                val prevDate = entries[i + 1].first
                val gapDays = daysBetween(date, prevDate)
                if (gapDays > 3) break
            }
            currentStreak++
        }

        // Best streak: same gap tolerance
        var bestStreak = 0
        var streak = 0
        for (i in entries.indices) {
            val (date, done) = entries[i]
            if (done) {
                // Check gap from previous entry
                if (i > 0 && streak > 0) {
                    val prevDate = entries[i - 1].first
                    val gapDays = daysBetween(prevDate, date)
                    if (gapDays > 3) streak = 0
                }
                streak++
                if (streak > bestStreak) bestStreak = streak
            } else {
                streak = 0
            }
        }

        // 30-day rate: filter to entries within the last 30 calendar days
        val cutoff = java.time.LocalDate.now().minusDays(30).toString()
        val last30 = entries.filter { it.first >= cutoff }
        val rate30d = if (last30.isNotEmpty()) {
            (last30.count { it.second } * 100) / last30.size
        } else 0

        return HabitStats(currentStreak, bestStreak, rate30d, totalDone)
    }

    /** Calculate days between two YYYY-MM-DD date strings. */
    private fun daysBetween(from: String, to: String): Long {
        return try {
            val d1 = java.time.LocalDate.parse(from)
            val d2 = java.time.LocalDate.parse(to)
            java.time.temporal.ChronoUnit.DAYS.between(d1, d2).let { kotlin.math.abs(it) }
        } catch (_: Exception) {
            0L
        }
    }

    private fun setupIntents(context: Context, views: RemoteViews, widgetId: Int) {
        // Tap → open app
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launchIntent != null) {
            val pending = PendingIntent.getActivity(
                context, widgetId, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_habit_stats_root, pending)
        }

        // Tap refresh
        val refreshIntent = Intent(context, HabitStatsWidgetProvider::class.java).apply {
            action = ACTION_REFRESH
            data = android.net.Uri.parse("habitikami://refresh_habit_stats/$widgetId")
        }
        val refreshPending = PendingIntent.getBroadcast(
            context, widgetId + 3000, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btn_refresh_habit, refreshPending)
    }
}
