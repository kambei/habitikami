package dev.kambei.habitikami.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.view.View
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
        private const val MAX_SLOTS = 5

        // Layout resource IDs for each slot (indexed 0..4)
        private val SLOT_IDS = intArrayOf(
            R.id.counter_slot_0, R.id.counter_slot_1, R.id.counter_slot_2,
            R.id.counter_slot_3, R.id.counter_slot_4,
        )
        private val LABEL_IDS = intArrayOf(
            R.id.tv_label_0, R.id.tv_label_1, R.id.tv_label_2,
            R.id.tv_label_3, R.id.tv_label_4,
        )
        private val VAL_IDS = intArrayOf(
            R.id.tv_val_0, R.id.tv_val_1, R.id.tv_val_2,
            R.id.tv_val_3, R.id.tv_val_4,
        )
        private val BTN_IDS = intArrayOf(
            R.id.btn_inc_0, R.id.btn_inc_1, R.id.btn_inc_2,
            R.id.btn_inc_3, R.id.btn_inc_4,
        )

        // Fallback definitions if the server doesn't return any
        val DEFAULT_DEFINITIONS = listOf(
            CounterDefinition("smoke", "Resist", "#22C55E", "positive"),
            CounterDefinition("smoked", "Smoked", "#EF4444", "negative"),
            CounterDefinition("coffee", "Coffee", "#F59E0B", "neutral"),
        )

        fun getConfig(context: Context): Pair<String, String>? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val url = prefs.getString(KEY_BASE_URL, null) ?: return null
            val token = prefs.getString(KEY_API_TOKEN, null) ?: return null
            return url to token
        }

        /** Cache counter definitions in SharedPreferences so the widget
         *  can show labels/colors even before the network call completes. */
        fun cacheDefinitions(context: Context, defs: List<CounterDefinition>) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = defs.joinToString(";") { "${it.id}|${it.label}|${it.color}|${it.type}" }
            prefs.edit().putString("counter_definitions", json).apply()
        }

        fun getCachedDefinitions(context: Context): List<CounterDefinition> {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val raw = prefs.getString("counter_definitions", null) ?: return emptyList()
            return raw.split(";").mapNotNull { entry ->
                val parts = entry.split("|")
                if (parts.size == 4) CounterDefinition(parts[0], parts[1], parts[2], parts[3])
                else null
            }
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
                    refreshAll(context)
                } finally {
                    pending.finish()
                }
            }
        }
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
        // Show loading with cached definitions (or defaults)
        val cached = getCachedDefinitions(context).ifEmpty { DEFAULT_DEFINITIONS }
        val loading = RemoteViews(context.packageName, R.layout.widget_counter)
        configureSlots(loading, cached, cached.associate { it.id to "…" })
        setupClickIntents(context, loading, widgetId, cached)
        manager.updateAppWidget(widgetId, loading)

        // Fetch real data in background
        scope.launch {
            val config = getConfig(context)
            val views = RemoteViews(context.packageName, R.layout.widget_counter)

            var activeDefs: List<CounterDefinition>

            if (config == null) {
                activeDefs = cached
                configureSlots(views, activeDefs, activeDefs.associate { it.id to "—" })
            } else {
                try {
                    val (baseUrl, apiToken) = config

                    // Fetch definitions and counter values in sequence
                    val defs = try {
                        CounterApiClient.fetchCounterDefinitions(baseUrl, apiToken)
                            .also { if (it.isNotEmpty()) cacheDefinitions(context, it) }
                    } catch (_: Exception) { emptyList() }
                    activeDefs = defs.ifEmpty { cached }

                    val counters = CounterApiClient.fetchTodayCounters(baseUrl, apiToken)
                    val displayValues = activeDefs.associate { def ->
                        def.id to (counters[def.id] ?: 0).toString()
                    }
                    configureSlots(views, activeDefs, displayValues)
                } catch (_: Exception) {
                    activeDefs = cached
                    configureSlots(views, activeDefs, activeDefs.associate { it.id to "!" })
                }
            }

            setupClickIntents(context, views, widgetId, activeDefs)
            manager.updateAppWidget(widgetId, views)
        }
    }

    /** Configure slot visibility, labels, colors, and values. */
    private fun configureSlots(
        views: RemoteViews,
        defs: List<CounterDefinition>,
        values: Map<String, String>,
    ) {
        for (i in 0 until MAX_SLOTS) {
            if (i < defs.size) {
                val def = defs[i]
                views.setViewVisibility(SLOT_IDS[i], View.VISIBLE)
                views.setTextViewText(LABEL_IDS[i], def.label)
                views.setTextColor(LABEL_IDS[i], parseColor(def.color))
                views.setTextViewText(VAL_IDS[i], values[def.id] ?: "0")
            } else {
                views.setViewVisibility(SLOT_IDS[i], View.GONE)
            }
        }
    }

    private fun setupClickIntents(
        context: Context,
        views: RemoteViews,
        widgetId: Int,
        defs: List<CounterDefinition>,
    ) {
        for (i in 0 until minOf(MAX_SLOTS, defs.size)) {
            val def = defs[i]
            val intent = Intent(context, CounterWidgetProvider::class.java).apply {
                action = ACTION_INCREMENT
                putExtra(EXTRA_COUNTER, def.id)
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
                data = android.net.Uri.parse("habitikami://increment/${def.id}/$widgetId")
            }
            val pending = PendingIntent.getBroadcast(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(BTN_IDS[i], pending)
        }

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

    private fun parseColor(hex: String): Int {
        return try {
            Color.parseColor(hex)
        } catch (_: Exception) {
            Color.parseColor("#888888")
        }
    }
}
