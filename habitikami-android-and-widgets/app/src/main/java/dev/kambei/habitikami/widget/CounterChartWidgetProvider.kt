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
        private const val ACTION_CYCLE_FILTER = "dev.kambei.habitikami.CYCLE_CHART_FILTER"
        private const val PREFS_NAME = "habitikami_widget"
        private const val FILTER_ALL = "__all__"

        fun refreshAll(context: Context) {
            val intent = Intent(context, CounterChartWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                val mgr = AppWidgetManager.getInstance(context)
                val ids = mgr.getAppWidgetIds(ComponentName(context, CounterChartWidgetProvider::class.java))
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }

        /** Get the current filter categoryId for a widget (or FILTER_ALL). */
        private fun getFilter(context: Context, widgetId: Int): String {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getString("chart_filter_$widgetId", FILTER_ALL) ?: FILTER_ALL
        }

        /** Save filter categoryId for a widget. */
        private fun setFilter(context: Context, widgetId: Int, categoryId: String) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString("chart_filter_$widgetId", categoryId).apply()
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) updateWidget(context, manager, id)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_REFRESH -> refreshAll(context)
            ACTION_CYCLE_FILTER -> {
                val widgetId = intent.getIntExtra(
                    AppWidgetManager.EXTRA_APPWIDGET_ID,
                    AppWidgetManager.INVALID_APPWIDGET_ID
                )
                if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return
                cycleFilter(context, widgetId)
            }
        }
    }

    /** Cycle through: All → Category1 → Category2 → … → All */
    private fun cycleFilter(context: Context, widgetId: Int) {
        val defs = CounterWidgetProvider.getCachedDefinitions(context)
            .ifEmpty { CounterWidgetProvider.DEFAULT_DEFINITIONS }
        val categories = defs.map { it.categoryId }.distinct()

        // If only one category, no cycling needed — stay on All
        if (categories.size <= 1) return

        val currentFilter = getFilter(context, widgetId)
        val options = listOf(FILTER_ALL) + categories
        val currentIndex = options.indexOf(currentFilter)
        val nextIndex = (currentIndex + 1) % options.size
        setFilter(context, widgetId, options[nextIndex])

        // Trigger a widget update
        val mgr = AppWidgetManager.getInstance(context)
        updateWidget(context, mgr, widgetId)
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

                    // Fetch definitions (use cached as fallback)
                    val defs = try {
                        CounterApiClient.fetchCounterDefinitions(baseUrl, apiToken)
                            .also { if (it.isNotEmpty()) CounterWidgetProvider.cacheDefinitions(context, it) }
                    } catch (_: Exception) { emptyList() }
                    val allDefs = defs.ifEmpty {
                        CounterWidgetProvider.getCachedDefinitions(context)
                            .ifEmpty { CounterWidgetProvider.DEFAULT_DEFINITIONS }
                    }

                    // Apply filter
                    val filter = getFilter(context, widgetId)
                    val filteredDefs = if (filter == FILTER_ALL) {
                        allDefs
                    } else {
                        allDefs.filter { it.categoryId == filter }
                    }

                    // Show filter label
                    val categories = allDefs.map { it.categoryId }.distinct()
                    if (categories.size > 1) {
                        val filterLabel = if (filter == FILTER_ALL) "All" else {
                            allDefs.firstOrNull { it.categoryId == filter }?.categoryLabel ?: filter
                        }
                        views.setTextViewText(R.id.tv_chart_filter, filterLabel)
                    } else {
                        views.setTextViewText(R.id.tv_chart_filter, "")
                    }

                    val counters = CounterApiClient.fetchCounterHistory(baseUrl, apiToken, 14)

                    val dm = context.resources.displayMetrics
                    val bitmapW = (280 * dm.density).toInt()
                    val bitmapH = (200 * dm.density).toInt()
                    val bitmap = ChartRenderer.renderCounterBars(counters, filteredDefs, bitmapW, bitmapH)

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
        // Tap chart → open app
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launchIntent != null) {
            val pending = PendingIntent.getActivity(
                context, widgetId, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.iv_counter_chart, pending)
        }

        // Refresh button
        val refreshIntent = Intent(context, CounterChartWidgetProvider::class.java).apply {
            action = ACTION_REFRESH
            data = android.net.Uri.parse("habitikami://refresh_counter_chart/$widgetId")
        }
        val refreshPending = PendingIntent.getBroadcast(
            context, widgetId + 4000, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btn_refresh_counter_chart, refreshPending)

        // Filter button — tap to cycle through categories
        val filterIntent = Intent(context, CounterChartWidgetProvider::class.java).apply {
            action = ACTION_CYCLE_FILTER
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
            data = android.net.Uri.parse("habitikami://cycle_chart_filter/$widgetId")
        }
        val filterPending = PendingIntent.getBroadcast(
            context, widgetId + 5000, filterIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.tv_chart_filter, filterPending)
    }
}
