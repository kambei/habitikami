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

class StreakFireWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val ACTION_REFRESH = "dev.kambei.habitikami.REFRESH_STREAK_FIRE"

        fun refreshAll(context: Context) {
            val intent = Intent(context, StreakFireWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                val mgr = AppWidgetManager.getInstance(context)
                val ids = mgr.getAppWidgetIds(ComponentName(context, StreakFireWidgetProvider::class.java))
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) updateWidget(context, manager, id)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) refreshAll(context)
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
        val loading = RemoteViews(context.packageName, R.layout.widget_streak_fire).apply {
            setTextViewText(R.id.tv_fire, "")
            setTextViewText(R.id.tv_streak_number, "…")
            setTextViewText(R.id.tv_streak_subtitle, "loading")
            setTextViewText(R.id.tv_streak_habit_name, "")
        }
        setupIntents(context, loading, widgetId)
        manager.updateAppWidget(widgetId, loading)

        scope.launch {
            val views = RemoteViews(context.packageName, R.layout.widget_streak_fire)
            val config = CounterWidgetProvider.getConfig(context)

            if (config == null) {
                views.setTextViewText(R.id.tv_fire, "")
                views.setTextViewText(R.id.tv_streak_number, "?")
                views.setTextViewText(R.id.tv_streak_subtitle, "no config")
                views.setTextViewText(R.id.tv_streak_habit_name, "")
            } else {
                try {
                    val (baseUrl, apiToken) = config
                    val export = HabitApiClient.fetchExport(baseUrl, apiToken, 90)
                    val allHabits = (export.weekdays + export.weekend)
                        .flatMap { it.habits.keys }.distinct()

                    var bestStreak = 0
                    var bestHabit = ""

                    for (habit in allHabits) {
                        val merged = HabitStatsWidgetProvider.smartMerge(
                            export.weekdays, export.weekend, habit
                        )
                        val streak = currentStreak(merged.map { it.second })
                        if (streak > bestStreak) {
                            bestStreak = streak
                            bestHabit = habit
                        }
                    }

                    val fire = when {
                        bestStreak == 0 -> "·"
                        bestStreak < 7 -> "\uD83D\uDD25"
                        bestStreak < 14 -> "\uD83D\uDD25\uD83D\uDD25"
                        bestStreak < 30 -> "\uD83D\uDD25\uD83D\uDD25\uD83D\uDD25"
                        else -> "\uD83D\uDD25\uD83D\uDD25\uD83D\uDD25\uD83D\uDD25"
                    }

                    views.setTextViewText(R.id.tv_fire, fire)
                    views.setTextViewText(R.id.tv_streak_number, "$bestStreak")
                    views.setTextViewText(R.id.tv_streak_subtitle, if (bestStreak == 1) "day streak" else "days streak")
                    views.setTextViewText(R.id.tv_streak_habit_name, bestHabit)

                    val habitColor = export.colors[bestHabit]
                    if (habitColor != null) {
                        views.setTextColor(R.id.tv_streak_habit_name, habitColor)
                    }
                } catch (_: Exception) {
                    views.setTextViewText(R.id.tv_fire, "")
                    views.setTextViewText(R.id.tv_streak_number, "!")
                    views.setTextViewText(R.id.tv_streak_subtitle, "error")
                    views.setTextViewText(R.id.tv_streak_habit_name, "")
                }
            }

            setupIntents(context, views, widgetId)
            manager.updateAppWidget(widgetId, views)
        }
    }

    private fun currentStreak(entries: List<Boolean>): Int {
        var streak = 0
        for (i in entries.indices.reversed()) {
            if (entries[i]) streak++ else break
        }
        return streak
    }

    private fun setupIntents(context: Context, views: RemoteViews, widgetId: Int) {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launchIntent != null) {
            val pending = PendingIntent.getActivity(
                context, widgetId, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_streak_fire_root, pending)
        }

        val refreshIntent = Intent(context, StreakFireWidgetProvider::class.java).apply {
            action = ACTION_REFRESH
            data = android.net.Uri.parse("habitikami://refresh_streak_fire/$widgetId")
        }
        val refreshPending = PendingIntent.getBroadcast(
            context, widgetId + 5000, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btn_refresh_streak, refreshPending)
    }
}
