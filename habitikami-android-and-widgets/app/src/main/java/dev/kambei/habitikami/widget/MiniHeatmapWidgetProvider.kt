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

class MiniHeatmapWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val ACTION_REFRESH = "dev.kambei.habitikami.REFRESH_MINI_HEATMAP"
        private const val PREFS_NAME = "habitikami_mini_heatmap_widget"

        fun refreshAll(context: Context) {
            val intent = Intent(context, MiniHeatmapWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                val mgr = AppWidgetManager.getInstance(context)
                val ids = mgr.getAppWidgetIds(ComponentName(context, MiniHeatmapWidgetProvider::class.java))
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }

        fun getSelectedHabit(context: Context, widgetId: Int): String? {
            return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString("habit_$widgetId", null)
        }

        fun saveSelectedHabit(context: Context, widgetId: Int, habit: String) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString("habit_$widgetId", habit)
                .apply()
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
        val loading = RemoteViews(context.packageName, R.layout.widget_mini_heatmap).apply {
            setTextViewText(R.id.tv_mini_habit_name, "Loading…")
            setImageViewResource(R.id.iv_mini_heatmap, android.R.color.transparent)
        }
        setupIntents(context, loading, widgetId)
        manager.updateAppWidget(widgetId, loading)

        scope.launch {
            val views = RemoteViews(context.packageName, R.layout.widget_mini_heatmap)
            val config = CounterWidgetProvider.getConfig(context)
            val habitName = getSelectedHabit(context, widgetId)

            if (config == null || habitName == null) {
                views.setTextViewText(R.id.tv_mini_habit_name, "Not configured")
            } else {
                try {
                    val (baseUrl, apiToken) = config
                    val export = HabitApiClient.fetchExport(baseUrl, apiToken, 14)
                    // Smart merge: only use sheets where habit is active
                    val merged = HabitStatsWidgetProvider.smartMerge(
                        export.weekdays, export.weekend, habitName
                    )
                    val sorted = merged.takeLast(14)

                    val habitColor = export.colors[habitName]

                    val dm = context.resources.displayMetrics
                    val bitmapW = (220 * dm.density).toInt()
                    val bitmapH = (36 * dm.density).toInt()
                    val bitmap = ChartRenderer.renderMiniHeatmap(
                        sorted.map { it.second }, bitmapW, bitmapH, habitColor
                    )

                    views.setTextViewText(R.id.tv_mini_habit_name, habitName)
                    if (habitColor != null) {
                        views.setTextColor(R.id.tv_mini_habit_name, habitColor)
                    }
                    views.setImageViewBitmap(R.id.iv_mini_heatmap, bitmap)
                } catch (_: Exception) {
                    views.setTextViewText(R.id.tv_mini_habit_name, habitName ?: "Error")
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
            views.setOnClickPendingIntent(R.id.widget_mini_heatmap_root, pending)
        }

        val refreshIntent = Intent(context, MiniHeatmapWidgetProvider::class.java).apply {
            action = ACTION_REFRESH
            data = android.net.Uri.parse("habitikami://refresh_mini_heatmap/$widgetId")
        }
        val refreshPending = PendingIntent.getBroadcast(
            context, widgetId + 9000, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btn_refresh_mini, refreshPending)
    }
}
