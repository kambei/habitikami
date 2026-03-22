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

class CounterWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val ACTION_INCREMENT = "dev.kambei.habitikami.INCREMENT"
        private const val EXTRA_COUNTER = "counter"
        private const val PREFS_NAME = "habitikami_widget"
        private const val KEY_BASE_URL = "base_url"
        private const val KEY_API_TOKEN = "api_token"

        fun getConfig(context: Context): Pair<String, String>? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val url = prefs.getString(KEY_BASE_URL, null) ?: return null
            val token = prefs.getString(KEY_API_TOKEN, null) ?: return null
            return url to token
        }

        /** Trigger update for all widget instances. */
        fun refreshAll(context: Context) {
            val intent = Intent(context, CounterWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                val mgr = AppWidgetManager.getInstance(context)
                val ids = mgr.getAppWidgetIds(ComponentName(context, CounterWidgetProvider::class.java))
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

        if (intent.action == ACTION_INCREMENT) {
            val counter = intent.getStringExtra(EXTRA_COUNTER) ?: return
            val pending = goAsync()

            scope.launch {
                try {
                    val (baseUrl, apiToken) = getConfig(context) ?: return@launch
                    CounterApiClient.incrementCounter(baseUrl, apiToken, counter)
                    // Refresh all widgets after increment
                    refreshAll(context)
                } finally {
                    pending.finish()
                }
            }
        }
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
        // Set loading state
        val loading = RemoteViews(context.packageName, R.layout.widget_counter).apply {
            setTextViewText(R.id.tv_smoke_val, "…")
            setTextViewText(R.id.tv_smoked_val, "…")
            setTextViewText(R.id.tv_coffee_val, "…")
        }
        setupClickIntents(context, loading, widgetId)
        manager.updateAppWidget(widgetId, loading)

        // Fetch real data in background
        scope.launch {
            val config = getConfig(context)
            val views = RemoteViews(context.packageName, R.layout.widget_counter)

            if (config == null) {
                views.setTextViewText(R.id.tv_smoke_val, "—")
                views.setTextViewText(R.id.tv_smoked_val, "—")
                views.setTextViewText(R.id.tv_coffee_val, "—")
            } else {
                try {
                    val (baseUrl, apiToken) = config
                    val counters = CounterApiClient.fetchTodayCounters(baseUrl, apiToken)
                    views.setTextViewText(R.id.tv_smoke_val, counters.smoke.toString())
                    views.setTextViewText(R.id.tv_smoked_val, counters.smoked.toString())
                    views.setTextViewText(R.id.tv_coffee_val, counters.coffee.toString())
                } catch (_: Exception) {
                    views.setTextViewText(R.id.tv_smoke_val, "!")
                    views.setTextViewText(R.id.tv_smoked_val, "!")
                    views.setTextViewText(R.id.tv_coffee_val, "!")
                }
            }

            setupClickIntents(context, views, widgetId)
            manager.updateAppWidget(widgetId, views)
        }
    }

    private fun setupClickIntents(context: Context, views: RemoteViews, widgetId: Int) {
        fun incrementIntent(counter: String): PendingIntent {
            val intent = Intent(context, CounterWidgetProvider::class.java).apply {
                action = ACTION_INCREMENT
                putExtra(EXTRA_COUNTER, counter)
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
                // Unique data URI so PendingIntents don't collapse
                data = android.net.Uri.parse("habitikami://increment/$counter/$widgetId")
            }
            return PendingIntent.getBroadcast(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        views.setOnClickPendingIntent(R.id.btn_smoke, incrementIntent("smoke"))
        views.setOnClickPendingIntent(R.id.btn_smoked, incrementIntent("smoked"))
        views.setOnClickPendingIntent(R.id.btn_coffee, incrementIntent("coffee"))

        // Tap title → open app
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launchIntent != null) {
            val launchPending = PendingIntent.getActivity(
                context, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.tv_title, launchPending)
        }
    }
}
