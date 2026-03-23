package dev.kambei.habitikami.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.DisplayMetrics
import android.widget.RemoteViews
import dev.kambei.habitikami.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class StatsWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val ACTION_REFRESH = "dev.kambei.habitikami.REFRESH_STATS"

        fun refreshAll(context: Context) {
            val intent = Intent(context, StatsWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                val mgr = AppWidgetManager.getInstance(context)
                val ids = mgr.getAppWidgetIds(ComponentName(context, StatsWidgetProvider::class.java))
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) {
            updateWidget(context, manager, id)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) {
            refreshAll(context)
        }
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
        // Show loading state
        val loading = RemoteViews(context.packageName, R.layout.widget_stats).apply {
            setImageViewResource(R.id.iv_chart, android.R.color.transparent)
            setTextViewText(R.id.tv_status, "Loading…")
        }
        setupIntents(context, loading, widgetId)
        manager.updateAppWidget(widgetId, loading)

        scope.launch {
            val views = RemoteViews(context.packageName, R.layout.widget_stats)
            val config = CounterWidgetProvider.getConfig(context)

            if (config == null) {
                views.setTextViewText(R.id.tv_status, "Configure counter widget first")
            } else {
                try {
                    val (baseUrl, apiToken) = config
                    val export = HabitApiClient.fetchExport(baseUrl, apiToken, 30)

                    // Filter habits based on user selection
                    val selectedHabits = StatsWidgetConfigActivity.getSelectedHabits(context, widgetId)
                    val filteredExport = if (selectedHabits.isNotEmpty()) {
                        export.copy(
                            weekdays = export.weekdays.map { day ->
                                day.copy(habits = day.habits.filterKeys { it in selectedHabits })
                            },
                            weekend = export.weekend.map { day ->
                                day.copy(habits = day.habits.filterKeys { it in selectedHabits })
                            }
                        )
                    } else export

                    // Load custom habit order
                    val habitOrder = StatsWidgetConfigActivity.getOrderedHabits(context, widgetId)

                    // Render chart bitmap scaled for screen density
                    val dm = context.resources.displayMetrics
                    val bitmapW = (320 * dm.density).toInt()
                    val bitmapH = (380 * dm.density).toInt()
                    val bitmap = ChartRenderer.renderComposite(filteredExport, bitmapW, bitmapH, habitOrder)

                    views.setImageViewBitmap(R.id.iv_chart, bitmap)
                    views.setTextViewText(R.id.tv_status, "")
                } catch (_: Exception) {
                    views.setTextViewText(R.id.tv_status, "Failed to load data")
                }
            }

            setupIntents(context, views, widgetId)
            manager.updateAppWidget(widgetId, views)
        }
    }

    private fun setupIntents(context: Context, views: RemoteViews, widgetId: Int) {
        // Tap chart → open app
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launchIntent != null) {
            val launchPending = PendingIntent.getActivity(
                context, widgetId, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.iv_chart, launchPending)
        }

        // Tap refresh → refresh data
        val refreshIntent = Intent(context, StatsWidgetProvider::class.java).apply {
            action = ACTION_REFRESH
            data = android.net.Uri.parse("habitikami://refresh_stats/$widgetId")
        }
        val refreshPending = PendingIntent.getBroadcast(
            context, widgetId + 1000, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btn_refresh, refreshPending)
    }
}
