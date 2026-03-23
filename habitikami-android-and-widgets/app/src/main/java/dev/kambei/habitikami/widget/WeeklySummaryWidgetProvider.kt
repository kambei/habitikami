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
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters

class WeeklySummaryWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val ACTION_REFRESH = "dev.kambei.habitikami.REFRESH_WEEKLY_SUMMARY"

        fun refreshAll(context: Context) {
            val intent = Intent(context, WeeklySummaryWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                val mgr = AppWidgetManager.getInstance(context)
                val ids = mgr.getAppWidgetIds(ComponentName(context, WeeklySummaryWidgetProvider::class.java))
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
        val loading = RemoteViews(context.packageName, R.layout.widget_weekly_summary).apply {
            setImageViewResource(R.id.iv_weekly, android.R.color.transparent)
            setTextViewText(R.id.tv_weekly_status, "Loading…")
        }
        setupIntents(context, loading, widgetId)
        manager.updateAppWidget(widgetId, loading)

        scope.launch {
            val views = RemoteViews(context.packageName, R.layout.widget_weekly_summary)
            val config = CounterWidgetProvider.getConfig(context)

            if (config == null) {
                views.setTextViewText(R.id.tv_weekly_status, "Configure counter widget first")
            } else {
                try {
                    val (baseUrl, apiToken) = config
                    val export = HabitApiClient.fetchExport(baseUrl, apiToken, 14)

                    // Merge both sheets by date (weekday sheet has Mon-Fri, weekend has Sat-Sun)
                    val allDays = export.weekdays + export.weekend
                    val byDate = mutableMapOf<String, MutableMap<String, Boolean>>()
                    for (day in allDays) {
                        val map = byDate.getOrPut(day.date) { mutableMapOf() }
                        for ((habit, done) in day.habits) {
                            map[habit] = map.getOrDefault(habit, false) || done
                        }
                    }

                    val today = LocalDate.now()
                    val thisWeekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                    val lastWeekStart = thisWeekStart.minusWeeks(1)
                    val lastWeekEnd = thisWeekStart.minusDays(1)

                    val thisWeekEntries = byDate.filter {
                        val d = LocalDate.parse(it.key)
                        !d.isBefore(thisWeekStart) && !d.isAfter(today)
                    }
                    val lastWeekEntries = byDate.filter {
                        val d = LocalDate.parse(it.key)
                        !d.isBefore(lastWeekStart) && !d.isAfter(lastWeekEnd)
                    }

                    val thisWeekRate = weekRate(thisWeekEntries)
                    val lastWeekRate = weekRate(lastWeekEntries)

                    val dm = context.resources.displayMetrics
                    val bitmapW = (250 * dm.density).toInt()
                    val bitmapH = (150 * dm.density).toInt()
                    val bitmap = ChartRenderer.renderWeeklySummary(
                        thisWeekRate, lastWeekRate, bitmapW, bitmapH
                    )

                    views.setImageViewBitmap(R.id.iv_weekly, bitmap)
                    views.setTextViewText(R.id.tv_weekly_status, "")
                } catch (_: Exception) {
                    views.setTextViewText(R.id.tv_weekly_status, "Failed to load data")
                }
            }

            setupIntents(context, views, widgetId)
            manager.updateAppWidget(widgetId, views)
        }
    }

    private fun weekRate(entries: Map<String, MutableMap<String, Boolean>>): Int {
        var total = 0
        var done = 0
        for ((_, habits) in entries) {
            for ((_, completed) in habits) {
                total++
                if (completed) done++
            }
        }
        return if (total > 0) (done * 100) / total else 0
    }

    private fun setupIntents(context: Context, views: RemoteViews, widgetId: Int) {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launchIntent != null) {
            val pending = PendingIntent.getActivity(
                context, widgetId, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.iv_weekly, pending)
        }

        val refreshIntent = Intent(context, WeeklySummaryWidgetProvider::class.java).apply {
            action = ACTION_REFRESH
            data = android.net.Uri.parse("habitikami://refresh_weekly/$widgetId")
        }
        val refreshPending = PendingIntent.getBroadcast(
            context, widgetId + 8000, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btn_refresh_weekly, refreshPending)
    }
}
