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

class CounterChartWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val ACTION_REFRESH = "dev.kambei.habitikami.REFRESH_COUNTER_CHART"

        fun refreshAll(context: Context) {
            val intent = Intent(context, CounterChartWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                val mgr = AppWidgetManager.getInstance(context)
                val ids = mgr.getAppWidgetIds(ComponentName(context, CounterChartWidgetProvider::class.java))
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
        val loading = RemoteViews(context.packageName, R.layout.widget_counter_chart).apply {
            setImageViewResource(R.id.iv_counter_chart, android.R.color.transparent)
            setTextViewText(R.id.tv_counter_status, "Loading…")
        }
        setupIntents(context, loading, widgetId)
        manager.updateAppWidget(widgetId, loading)

        scope.launch {
            val views = RemoteViews(context.packageName, R.layout.widget_counter_chart)
            val config = CounterWidgetProvider.getConfig(context)

            if (config == null) {
                views.setTextViewText(R.id.tv_counter_status, "Configure counter widget first")
            } else {
                try {
                    val (baseUrl, apiToken) = config
                    val counters = CounterApiClient.fetchCounterHistory(baseUrl, apiToken, 14)

                    val dm = context.resources.displayMetrics
                    val bitmapW = (280 * dm.density).toInt()
                    val bitmapH = (200 * dm.density).toInt()
                    val bitmap = ChartRenderer.renderCounterBars(counters, bitmapW, bitmapH)

                    views.setImageViewBitmap(R.id.iv_counter_chart, bitmap)
                    views.setTextViewText(R.id.tv_counter_status, "")
                } catch (_: Exception) {
                    views.setTextViewText(R.id.tv_counter_status, "Failed to load data")
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
            views.setOnClickPendingIntent(R.id.iv_counter_chart, pending)
        }

        val refreshIntent = Intent(context, CounterChartWidgetProvider::class.java).apply {
            action = ACTION_REFRESH
            data = android.net.Uri.parse("habitikami://refresh_counter_chart/$widgetId")
        }
        val refreshPending = PendingIntent.getBroadcast(
            context, widgetId + 4000, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btn_refresh_counter_chart, refreshPending)
    }
}
