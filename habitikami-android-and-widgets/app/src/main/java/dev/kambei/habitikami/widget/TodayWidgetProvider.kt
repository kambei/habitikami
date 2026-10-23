package dev.kambei.habitikami.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import dev.kambei.habitikami.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/** Last fetched row of today, shared between the provider and the list service. */
object TodayCache {
    private const val KEY = "today_cache"
    private const val KEY_DATE = "today_cache_date"

    fun write(context: Context, data: TodayData, isoDate: String) {
        WidgetConfigStore.plainPrefs(context).edit().putString(KEY, data.toJson()).putString(KEY_DATE, isoDate).apply()
    }

    /** The cached row, only if it belongs to [isoDate]. */
    fun read(context: Context, isoDate: String): TodayData? {
        val prefs = WidgetConfigStore.plainPrefs(context)
        if (prefs.getString(KEY_DATE, null) != isoDate) return null
        return prefs.getString(KEY, null)?.let { TodayData.fromJson(it) }
    }
}

/**
 * "Today" widget (issue #123): the habits of today's row as a list; a tap
 * cycles FALSE → TRUE → HALF → FALSE through POST /api/cell. Numeric habits
 * open the app, where the value is typed.
 */
class TodayWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_TOGGLE = "dev.kambei.habitikami.TODAY_TOGGLE"
        private const val ACTION_REFRESH = "dev.kambei.habitikami.REFRESH_TODAY"
        const val EXTRA_HABIT = "habit"
        const val EXTRA_VALUE = "value"
        const val EXTRA_TYPE = "type"
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        fun refreshAll(context: Context) {
            val intent = Intent(context, TodayWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                val mgr = AppWidgetManager.getInstance(context)
                val ids = mgr.getAppWidgetIds(ComponentName(context, TodayWidgetProvider::class.java))
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }

        fun todayIso(): String = LocalDate.now().toString()

        /** Next state after a tap: FALSE → TRUE → HALF → FALSE (SKIP and empty count as FALSE). */
        fun nextValue(current: String?): String = when (current?.trim()?.uppercase()) {
            "TRUE" -> "HALF"
            "HALF" -> "FALSE"
            else -> "TRUE"
        }

        /** Morning, afternoon, evening, then any time; pending habits before done ones. */
        fun ordered(habits: List<TodayHabit>): List<TodayHabit> {
            val slotRank = mapOf("morning" to 0, "afternoon" to 1, "evening" to 2, "any" to 3)
            return habits.sortedWith(compareBy({ it.done }, { slotRank[it.slot] ?: 3 }, { it.time ?: "99:99" }))
        }
    }

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) updateWidget(context, manager, id)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_REFRESH -> refreshAll(context)
            ACTION_TOGGLE -> {
                val habit = intent.getStringExtra(EXTRA_HABIT) ?: return
                val current = intent.getStringExtra(EXTRA_VALUE)
                val type = intent.getStringExtra(EXTRA_TYPE) ?: "check"
                if (type == "number") {
                    // Numeric habits are typed in the app
                    context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
                        it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        context.startActivity(it)
                    }
                    return
                }
                toggle(context, habit, nextValue(current))
            }
        }
    }

    private fun toggle(context: Context, habit: String, value: String) {
        val config = WidgetConfigStore.getConfig(context) ?: return
        val iso = todayIso()
        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(ComponentName(context, TodayWidgetProvider::class.java))

        // Optimistic: show the new state right away, the fetch below confirms it
        TodayCache.read(context, iso)?.let { cached ->
            val updated = cached.copy(habits = cached.habits.map { h ->
                if (h.name == habit) h.copy(value = value, done = value == "TRUE" || value == "HALF") else h
            })
            TodayCache.write(context, updated, iso)
            manager.notifyAppWidgetViewDataChanged(ids, R.id.lv_today)
            for (id in ids) render(context, manager, id, updated, null)
        }

        scope.launch {
            try {
                HabitApiClient.setCell(config.first, config.second, iso, habit, value)
            } catch (e: Exception) {
                for (id in ids) {
                    val partial = RemoteViews(context.packageName, R.layout.widget_today).apply {
                        setTextViewText(R.id.tv_today_status, WidgetErrors.statusText(context, e, "today"))
                    }
                    manager.partiallyUpdateAppWidget(id, partial)
                }
            }
            refreshAll(context)
        }
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
        WidgetErrors.showLoading(context, manager, widgetId, R.layout.widget_today, R.id.tv_today_status)

        scope.launch {
            val iso = todayIso()
            val config = WidgetConfigStore.getConfig(context)
            if (config == null) {
                val views = RemoteViews(context.packageName, R.layout.widget_today)
                WidgetErrors.applyNotConfigured(context, views, R.id.tv_today_status, widgetId)
                setupIntents(context, views, widgetId)
                manager.updateAppWidget(widgetId, views)
                return@launch
            }
            try {
                val data = HabitApiClient.fetchToday(config.first, config.second, iso)
                TodayCache.write(context, data, iso)
                WidgetErrors.markUpdated(context, "today")
                render(context, manager, widgetId, data, null)
                manager.notifyAppWidgetViewDataChanged(widgetId, R.id.lv_today)
            } catch (e: Exception) {
                val cached = TodayCache.read(context, iso)
                if (cached != null) {
                    render(context, manager, widgetId, cached, WidgetErrors.statusText(context, e, "today"))
                } else {
                    val views = RemoteViews(context.packageName, R.layout.widget_today)
                    WidgetErrors.applyFailure(context, views, R.id.tv_today_status, widgetId, e, "today")
                    setupIntents(context, views, widgetId)
                    manager.updateAppWidget(widgetId, views)
                }
            }
        }
    }

    /** Full widget: header (date, done/total), list adapter, status line. */
    private fun render(context: Context, manager: AppWidgetManager, widgetId: Int, data: TodayData, status: String?) {
        val views = RemoteViews(context.packageName, R.layout.widget_today)
        val dateLabel = try {
            LocalDate.parse(data.date, DateTimeFormatter.ofPattern("dd/MM/yyyy")).format(DateTimeFormatter.ofPattern("EEE d MMM"))
        } catch (_: Exception) {
            data.date
        }
        views.setTextViewText(R.id.tv_today_title, context.getString(R.string.widget_today_title))
        views.setTextViewText(R.id.tv_today_date, dateLabel)
        views.setTextViewText(R.id.tv_today_progress, context.getString(R.string.widget_today_progress, data.doneCount, data.habits.size))
        views.setTextViewText(
            R.id.tv_today_status,
            status ?: if (!data.found) context.getString(R.string.widget_today_no_row) else ""
        )

        val serviceIntent = Intent(context, TodayWidgetService::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
            setData(Uri.parse("habitikami://today/$widgetId"))
        }
        views.setRemoteAdapter(R.id.lv_today, serviceIntent)
        views.setEmptyView(R.id.lv_today, R.id.tv_today_status)

        // One template; each row fills in habit, value and type
        val toggleIntent = Intent(context, TodayWidgetProvider::class.java).apply { action = ACTION_TOGGLE }
        val template = PendingIntent.getBroadcast(
            context, widgetId + 11000, toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        views.setPendingIntentTemplate(R.id.lv_today, template)

        setupIntents(context, views, widgetId)
        manager.updateAppWidget(widgetId, views)
    }

    private fun setupIntents(context: Context, views: RemoteViews, widgetId: Int) {
        context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
            val pending = PendingIntent.getActivity(
                context, widgetId, launch,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.tv_today_title, pending)
        }
        val refreshIntent = Intent(context, TodayWidgetProvider::class.java).apply {
            action = ACTION_REFRESH
            setData(Uri.parse("habitikami://refresh_today/$widgetId"))
        }
        val refreshPending = PendingIntent.getBroadcast(
            context, widgetId + 12000, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btn_refresh_today, refreshPending)
    }
}
