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

class WorstHabitWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val ACTION_REFRESH = "dev.kambei.habitikami.REFRESH_WORST_HABIT"

        fun refreshAll(context: Context) {
            val intent = Intent(context, WorstHabitWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                val mgr = AppWidgetManager.getInstance(context)
                val ids = mgr.getAppWidgetIds(ComponentName(context, WorstHabitWidgetProvider::class.java))
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
        val loading = RemoteViews(context.packageName, R.layout.widget_worst_habit).apply {
            setTextViewText(R.id.tv_worst_title, "Needs attention")
            setTextViewText(R.id.tv_worst_habit_name, "Loading…")
            setTextViewText(R.id.tv_worst_rate, "—")
            setTextViewText(R.id.tv_worst_label, "30-day rate")
            setProgressBar(R.id.pb_worst_rate, 100, 0, false)
        }
        setupIntents(context, loading, widgetId)
        manager.updateAppWidget(widgetId, loading)

        scope.launch {
            val views = RemoteViews(context.packageName, R.layout.widget_worst_habit)
            val config = CounterWidgetProvider.getConfig(context)

            if (config == null) {
                views.setTextViewText(R.id.tv_worst_title, "Needs attention")
                views.setTextViewText(R.id.tv_worst_habit_name, "Not configured")
                views.setTextViewText(R.id.tv_worst_rate, "—")
                views.setTextViewText(R.id.tv_worst_label, "")
                views.setProgressBar(R.id.pb_worst_rate, 100, 0, false)
            } else {
                try {
                    val (baseUrl, apiToken) = config
                    val export = HabitApiClient.fetchExport(baseUrl, apiToken, 30)
                    val allHabits = (export.weekdays + export.weekend)
                        .flatMap { it.habits.keys }.distinct()

                    var worstRate = 101
                    var worstHabit = ""

                    for (habit in allHabits) {
                        val merged = HabitStatsWidgetProvider.smartMerge(
                            export.weekdays, export.weekend, habit
                        )
                        if (merged.isEmpty()) continue
                        val rate = (merged.count { it.second } * 100) / merged.size
                        if (rate < worstRate) {
                            worstRate = rate
                            worstHabit = habit
                        }
                    }

                    if (worstHabit.isEmpty()) {
                        views.setTextViewText(R.id.tv_worst_title, "All good!")
                        views.setTextViewText(R.id.tv_worst_habit_name, "No habits found")
                        views.setTextViewText(R.id.tv_worst_rate, "—")
                        views.setTextViewText(R.id.tv_worst_label, "")
                        views.setProgressBar(R.id.pb_worst_rate, 100, 0, false)
                    } else {
                        views.setTextViewText(R.id.tv_worst_title, "Needs attention")
                        views.setTextViewText(R.id.tv_worst_habit_name, worstHabit)
                        views.setTextViewText(R.id.tv_worst_rate, "$worstRate%")
                        views.setTextViewText(R.id.tv_worst_label, "30-day rate")
                        views.setProgressBar(R.id.pb_worst_rate, 100, worstRate, false)

                        val habitColor = export.colors[worstHabit]
                        if (habitColor != null) {
                            views.setTextColor(R.id.tv_worst_habit_name, habitColor)
                        }
                    }
                } catch (_: Exception) {
                    views.setTextViewText(R.id.tv_worst_title, "Needs attention")
                    views.setTextViewText(R.id.tv_worst_habit_name, "Error loading")
                    views.setTextViewText(R.id.tv_worst_rate, "!")
                    views.setTextViewText(R.id.tv_worst_label, "")
                    views.setProgressBar(R.id.pb_worst_rate, 100, 0, false)
                }
            }

            setupIntents(context, views, widgetId)
            manager.updateAppWidget(widgetId, views)
        }
    }

    private fun setupIntents(context: Context, views: RemoteViews, widgetId: Int) {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launchIntent != null) {
            val pending = PendingIntent.getActivity(
                context, widgetId, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_worst_habit_root, pending)
        }

        val refreshIntent = Intent(context, WorstHabitWidgetProvider::class.java).apply {
            action = ACTION_REFRESH
            data = android.net.Uri.parse("habitikami://refresh_worst_habit/$widgetId")
        }
        val refreshPending = PendingIntent.getBroadcast(
            context, widgetId + 6000, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btn_refresh_worst, refreshPending)
    }
}
